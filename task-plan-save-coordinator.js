/* Serialize Task Plan Builder saves and publishes so older writes never overtake new edits.
 * Keep this small dependency independent of the DOM to test races and failures. */
(function(){
  'use strict';
  function create({ getPayload, write, applyResponse, setStatus, hasExisting }){
    let revision=0;
    let savedRevision=hasExisting()?0:-1;
    let inFlight=null;
    let publishing=false;

    const message=(error,fallback)=>error?.message||fallback;
    const markDirty=()=>{
      revision+=1;
      setStatus('Unsaved changes');
    };
    const needsSave=()=>savedRevision!==revision;

    async function flush(){
      if(inFlight) return inFlight;
      inFlight=(async()=>{
        while(needsSave()||!hasExisting()){
          let payload;
          try{
            payload=getPayload();
            if(!payload?.template?.title?.trim()){
              setStatus('Add a task plan title before saving.',true);
              return false;
            }
          }catch(error){
            setStatus(message(error,'Could not prepare the task plan for saving.'),true);
            return false;
          }
          const attemptedRevision=revision;
          setStatus('Saving…');
          try{
            const data=await write(payload);
            if(!data?.template?.id) throw new Error('The server did not confirm a saved task plan.');
            applyResponse(data,payload);
            savedRevision=attemptedRevision;
          }catch(error){
            setStatus(message(error,'Could not save the task plan. Your edits remain on screen.'),true);
            return false;
          }
          // A newer edit during the request must be saved before preview/publish.
          if(needsSave()) setStatus('More changes waiting to save…');
        }
        setStatus('All changes saved');
        return true;
      })();
      try{return await inFlight;}
      finally{inFlight=null;}
    }

    async function publish(){
      if(publishing)return false;
      publishing=true;
      try{
        if(!await flush())return false;
        const attemptedRevision=revision;
        let payload;
        try{payload={...getPayload(),action:'publish'};}
        catch(error){
          setStatus(message(error,'Could not prepare the plan for publishing.'),true);
          return false;
        }
        setStatus('Publishing…');
        try{
          const data=await write(payload);
          if(!data?.template?.id||data.template.status!=='published'){
            throw new Error('The server did not confirm publication of this task plan.');
          }
          applyResponse(data,payload);
          savedRevision=attemptedRevision;
          setStatus(needsSave()?'Unpublished edits after publishing':`Published · version ${data.template.version}`);
          return true;
        }catch(error){
          setStatus(message(error,'Could not publish the task plan. Your draft remains open.'),true);
          return false;
        }
      }finally{publishing=false;}
    }
    return { markDirty, flush, publish, needsSave, isPublishing:()=>publishing };
  }
  window.CMCTaskPlanSave={create};
})();
