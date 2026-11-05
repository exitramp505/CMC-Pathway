// Role assignments are independent: one director can have regional responsibility
// and national reporting or administration under a single CMC Pathway account.
// account_role remains a backwards-compatible effective role for other modules.
const REGIONS=['Central','East','Mountain Plains','Pacific','Southeast'];
const NATIONAL_LEVELS=['none','viewer','admin'];
const regionOf=profile=>{
  const region=profile?.cmc_regional_director_region;
  if(REGIONS.includes(region))return region;
  // Legacy records not yet migrated can still be read safely.
  return profile?.account_role==='regional_leader'&&REGIONS.includes(profile.region)?profile.region:null;
};
const nationalOf=profile=>{
  const value=profile?.cmc_national_access;
  if(NATIONAL_LEVELS.includes(value))return value;
  return profile?.account_role==='cmc_admin'?'admin':profile?.account_role==='cmc_viewer'?'viewer':'none';
};
const nationalAdmin=profile=>nationalOf(profile)==='admin';
const nationalReporting=profile=>nationalOf(profile)!=='none';
const effectiveRole=(region,national)=>{
  if(national==='admin')return 'cmc_admin';
  if(region)return 'regional_leader';
  if(national==='viewer')return 'cmc_viewer';
  return 'participant';
};
const leadershipAccount=profile=>Boolean(regionOf(profile)||nationalReporting(profile));
module.exports={REGIONS,NATIONAL_LEVELS,regionOf,nationalOf,nationalAdmin,nationalReporting,effectiveRole,leadershipAccount};
