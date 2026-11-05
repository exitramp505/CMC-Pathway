const {json,requireUser,httpError}=require('./_auth');
const {REGIONS,NATIONAL_LEVELS,regionOf,nationalOf,nationalAdmin,effectiveRole}=require('./_leadership-access');

const PROFILE_FIELDS='id,full_name,email,region,account_role,cmc_regional_director_region,cmc_national_access,created_at,archived_at';
function resolveAccessChange({viewer,target,regionalRegion,nationalAccess}){
  if(!target)throw httpError(404,'That account could not be updated.');
  if(target.id===viewer.id)throw httpError(400,'Your own leadership access cannot be changed here.');
  if(target.archived_at)throw httpError(400,'Restore this account before changing its access.');
  const region=regionalRegion==null||regionalRegion===''?null:String(regionalRegion);
  if(region!==null&&!REGIONS.includes(region))throw httpError(400,'Choose a valid Open Bible region.');
  const national=String(nationalAccess??'');
  if(!NATIONAL_LEVELS.includes(national))throw httpError(400,'Choose a valid national access level.');
  const administrator=nationalAdmin(viewer);
  const ownRegion=regionOf(viewer);
  if(!administrator){
    if(!ownRegion)throw httpError(403,'Regional director access is required.');
    if(national!=='none'||nationalOf(target)!=='none'){
      throw httpError(403,'Only a national administrator can change accounts with national access.');
    }
    if(target.region!==ownRegion){
      throw httpError(403,'You can only manage accounts within your own region.');
    }
    if(region!==null&&region!==ownRegion){
      throw httpError(403,'You can only assign directors within your own region.');
    }
  }
  const update={
    cmc_regional_director_region:region,
    cmc_national_access:national,
    account_role:effectiveRole(region,national),
    updated_at:new Date().toISOString()
  };
  // Legacy regional tools still use profile.region. Change affiliation only
  // when explicitly assigning regional responsibility, never on national grant.
  if(region)update.region=region;
  return update;
}

// Compatibility utility for established role-change regression tests.
function resolveRoleChange({viewer,target,accountRole,region}){
  if(!['participant','regional_leader','cmc_admin','cmc_viewer'].includes(accountRole))
    throw httpError(400,'Choose a valid access level.');
  if(!target)throw httpError(404,'That account could not be updated.');
  if(target.id===viewer.id)throw httpError(400,'You cannot change your own administrator access here.');
  if(target.archived_at)throw httpError(400,'Restore this person before changing leadership access.');
  if(viewer.account_role==='regional_leader'){
    if(['cmc_admin','cmc_viewer'].includes(target.account_role)||
       ['cmc_admin','cmc_viewer'].includes(accountRole))
      throw httpError(403,'Only a full administrator can manage full administrator access.');
    if(target.region!==viewer.region)throw httpError(403,'You can only manage leaders in your own region.');
  }
  const requested=viewer.account_role==='regional_leader'?viewer.region:region;
  if(accountRole==='regional_leader'&&!REGIONS.includes(requested))
    throw httpError(400,'Choose a valid Open Bible region.');
  const updates={account_role:accountRole,updated_at:new Date().toISOString()};
  if(accountRole==='regional_leader')updates.region=requested;
  return updates;
}
exports.handler=async event=>{
  if(!['GET','POST'].includes(event.httpMethod))
    return json(405,{ok:false,error:'Method not allowed.'});
  try{
    const {user,supabase}=await requireUser(event);
    const {data:viewer,error:viewerError}=await supabase.from('candidate_profiles')
      .select(PROFILE_FIELDS).eq('id',user.id).maybeSingle();
    if(viewerError)throw viewerError;
    if(!viewer||viewer.archived_at||(!nationalAdmin(viewer)&&!regionOf(viewer)))
      throw httpError(403,'CMC director access is required.');
    const fullAdmin=nationalAdmin(viewer);
    if(event.httpMethod==='POST'){
      const body=JSON.parse(event.body||'{}');
      const profileId=String(body.profile_id||'');
      if(!/^[0-9a-f-]{36}$/i.test(profileId))throw httpError(400,'Choose an existing account.');
      const {data:target,error:targetError}=await supabase.from('candidate_profiles')
        .select(PROFILE_FIELDS).eq('id',profileId).maybeSingle();
      if(targetError)throw targetError;
      const regional=body.regional_director_region;
      const national=body.national_access;
      const changes=resolveAccessChange({
        viewer,target,regionalRegion:regional,nationalAccess:national
      });
      const {data:updated,error:updateError}=await supabase.from('candidate_profiles')
        .update(changes).eq('id',profileId)
        .eq('account_role',target.account_role)
        .eq('cmc_national_access',target.cmc_national_access)
        .select(PROFILE_FIELDS).maybeSingle();
      if(updateError)throw updateError;
      if(!updated)throw httpError(409,'This person’s access changed while you were editing. Refresh and try again.');
      return json(200,{ok:true,profile:updated});
    }
    let query=supabase.from('candidate_profiles').select(PROFILE_FIELDS)
      .is('archived_at',null).order('full_name',{ascending:true}).limit(1000);
    if(!fullAdmin)query=query.eq('region',regionOf(viewer))
      .in('account_role',['participant','regional_leader']);
    const {data:profiles,error}=await query;
    if(error)throw error;
    const results=fullAdmin?profiles||[]:(profiles||[]).filter(x=>nationalOf(x)==='none');
    return json(200,{
      ok:true,viewer,profiles:results,
      regions:fullAdmin?REGIONS:[regionOf(viewer)],
      can_manage_national:fullAdmin
    });
  }catch(error){
    console.error('CMC leadership access update',error.statusCode||error.message);
    return json(error.statusCode||500,{
      ok:false,error:error.statusCode?error.message:'Could not manage CMC leadership access.'
    });
  }
};
exports._test={REGIONS,resolveRoleChange,resolveAccessChange};
