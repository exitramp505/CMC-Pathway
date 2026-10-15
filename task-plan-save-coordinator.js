/* Serialize Task Plan Builder saves and publishing.
 * This dependency has no DOM access and can be race-tested without a browser. */
(function(){
  'use strict';
  function create({getPayload,write,applyResponse,setStatus,hasExisting}){
    let revision=0;
    let savedRevision=hasExisting()?0:-1;
    let queue=Promise.resolve();
    let publishing=false;
    let lastTemplate=null;
    const dirty=()=>savedRevision!==revision;
    const errorMessage=(error,fallback)=>error?.message||fallback;
    const enqueue=operation=>{
      const result=queue.then(operation,operation);
      queue=result.then(()=>undefined,()=>undefined);
      return result;
    };

    function markDirty(){
      revision+=1;
      setStatus('Unsaved changes');
    }

    async function savePending(){
      while(dirty()||!hasExisting()){
        let payload;
        try{
          payload=getPayload();
          if(!payload?.template?.title?.trim()){
            setStatus('Add a task plan title before saving.',true);
            return false;
          }
        }catch(error){
          setStatus(errorMessage(error,'Could not prepare this task plan.'),true);
          return false;
        }
        const attemptedRevision=revision;
        setStatus('Saving…');
        try{
          const response=await write(payload);
          if(!response?.template?.id)throw new Error('The server did not confirm a saved task plan.');
          applyResponse(response,payload);
          lastTemplate=response.template;
          savedRevision=attemptedRevision;
        }catch(error){
          setStatus(errorMessage(error,'Could not save the task plan. Your edits remain available.'),true);
          return false;
        }
        if(dirty())setStatus('More changes waiting to save…');
      }
      if(lastTemplate?.published_at && lastTemplate.status!=='published'){
        setStatus('Draft saved · Unpublished edits');
      }else{
        setStatus('All changes saved');
      }
      return true;
    }

    function flush(){
      return enqueue(savePending);
    }

    function publish(){
      if(publishing)return Promise.resolve(false);
      publishing=true;
      return enqueue(async()=>{
        // Previously scheduled autosaves finish first; changes arriving during
        // a network request are included in the next serial save.
        if(!await savePending())return false;
        let payload;
        try{payload={...getPayload(),action:'publish'};}
        catch(error){
          setStatus(errorMessage(error,'Could not prepare this task plan for publishing.'),true);
          return false;
        }
        const attemptedRevision=revision;
        setStatus('Publishing…');
        try{
          const response=await write(payload);
          if(!response?.template?.id||response.template.status!=='published'){
            throw new Error('The server did not confirm publication of this task plan.');
          }
          applyResponse(response,payload);
          lastTemplate=response.template;
          savedRevision=attemptedRevision;
          setStatus(dirty()?'Unpublished edits after publishing':`Published · version ${response.template.version}`);
          return true;
        }catch(error){
          setStatus(errorMessage(error,'Could not publish the task plan. Your draft remains open.'),true);
          return false;
        }
      }).finally(()=>{
        publishing=false;
        // A person may keep typing while the publish request is in flight.
        // Persist those new edits *after* publication as an unpublished draft.
        if(dirty()&&hasExisting())void flush();
      });
    }

    return {markDirty,flush,publish,needsSave:dirty,isPublishing:()=>publishing};
  }
  window.CMCTaskPlanSave={create};
})();
