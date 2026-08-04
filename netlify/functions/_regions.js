const REGION_BY_STATE = Object.freeze({
  WA:'Pacific', HI:'Pacific', AK:'Pacific', AZ:'Pacific', UT:'Pacific',
  CA:'Pacific', NV:'Pacific', ID:'Pacific', OR:'Pacific',
  TX:'Central', OK:'Central', AR:'Central', WI:'Central', MN:'Central',
  IA:'Central', IL:'Central', MO:'Central', KS:'Central',
  CO:'Mountain Plains', WY:'Mountain Plains', NE:'Mountain Plains',
  SD:'Mountain Plains', ND:'Mountain Plains', MT:'Mountain Plains',
  NH:'East', VT:'East', MA:'East', ME:'East', RI:'East', CT:'East',
  NJ:'East', DE:'East', MD:'East', WV:'East', PA:'East', OH:'East',
  VA:'East', KY:'East', TN:'East', IN:'East', MI:'East', NY:'East',
  FL:'Southeast', GA:'Southeast', AL:'Southeast', MS:'Southeast',
  LA:'Southeast', SC:'Southeast', NC:'Southeast', PR:'Southeast'
});

function regionForState(state) {
  return REGION_BY_STATE[String(state || '').trim().toUpperCase()] || 'Unassigned';
}

function canonicalRegion(region) {
  const value = String(region || '').trim();
  return value === 'South East' ? 'Southeast' : value;
}

module.exports = { REGION_BY_STATE, canonicalRegion, regionForState };
