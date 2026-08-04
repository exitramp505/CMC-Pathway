const CHARACTER_NAMES = [
  'Resilience', 'Spousal Cooperation', 'Financial Responsibility',
  'Builds Group Cohesiveness', 'Effectively Builds Relationships',
  'Flexible and Adaptable', 'Exercises Faith', 'Cultural Agility',
  'Visionizing Capacity', 'Utilizes Giftedness of Others',
  'Relates to the Lost and Unchurched', 'Responsive to Community',
  'Creates Ministry Ownership', 'Committed to Kingdom Growth',
  'Intrinsically Motivated'
];

function characterLabel(value) {
  if (value < 2) return 'Not Yet Evident';
  if (value < 3) return 'Emerging';
  if (value < 3.8) return 'Evident';
  if (value < 4.5) return 'Strongly Evident';
  return 'Exceptionally Evident';
}

function scoreCharacterAssessment(answers, married) {
  const marriedYes = String(married || '').toLowerCase() === 'yes';
  const expected = marriedYes ? 75 : 70;
  const values = {};
  for (let section = 0; section < 15; section += 1) {
    if (section === 1 && !marriedYes) continue;
    for (let question = 0; question < 5; question += 1) {
      const key = `q_${section}_${question}`;
      const value = Number(answers?.[key]);
      if (!Number.isInteger(value) || value < 1 || value > 5) {
        throw validationError('Please complete every assessment question before submitting.');
      }
      values[key] = value;
    }
  }
  if (Object.keys(values).length !== expected) {
    throw validationError('The assessment response is incomplete.');
  }
  const results = CHARACTER_NAMES.map((name, section) => {
    if (section === 1 && !marriedYes) return { name, score:null, label:'N/A' };
    const sectionValues = Array.from({ length:5 }, (_, question) => values[`q_${section}_${question}`]);
    const score = Number((sectionValues.reduce((sum, value) => sum + value, 0) / 5).toFixed(2));
    return { name, score, label:characterLabel(score) };
  });
  const scored = results.filter(result => result.score !== null);
  const overall = Number((scored.reduce((sum, result) => sum + result.score, 0) / scored.length).toFixed(2));
  return {
    results,
    overall,
    overallLabel:characterLabel(overall),
    top:[...scored].sort((a, b) => b.score - a.score).slice(0, 3),
    growth:[...scored].sort((a, b) => a.score - b.score).slice(0, 3)
  };
}

const ISA_CATEGORY_META = {
  P:{ name:'Church Planting', benchmark:75, median:52, description:'Church Planting reflects exposure to pioneering new ministry, starting groups, raising resources, recruiting leaders, and building work that can continue beyond the original leader.' },
  E:{ name:'Entrepreneurial Leadership', benchmark:75, median:74, description:'Entrepreneurial Leadership reflects initiative, drive, risk tolerance, resilience, vision, ownership, and the ability to gather people around something that does not yet exist.' },
  M:{ name:'Ministry Experience', benchmark:75, median:59, description:'Ministry Experience reflects hands-on leadership in groups, events, teaching, training, supervising, evangelistic ministry, and growing ministry environments.' },
  R:{ name:'Relational Evangelism', benchmark:70, median:48, description:'Relational Evangelism reflects personal evangelism, discipling new believers, follow-up, time with unchurched people, and equipping others to engage people outside the church.' }
};

function isaQuestionMeta(id) {
  if (id >= 1 && id <= 4) return { group:'P', type:'yesno' };
  if (id >= 5 && id <= 8) return { group:'M', type:'yesno' };
  if (id >= 9 && id <= 19) return { group:'P', type:'yesno' };
  if (id >= 20 && id <= 23) return { group:'E', type:'yesno' };
  if (id >= 24 && id <= 36) return { group:'M', type:'yesno' };
  if (id >= 37 && id <= 42) return { group:'P', type:'yesno' };
  if (id >= 43 && id <= 56) return { group:'R', type:'count' };
  if (id >= 57 && id <= 60) return { group:'P', type:'count' };
  if (id >= 61 && id <= 85) return { group:'E', type:'agree' };
  return null;
}

function isaValue(type, answer) {
  const maps = {
    yesno:{ Yes:1, No:0 },
    count:{ None:0, '1-2':0.25, '3-6':0.5, '7-15':0.75, '16+':1 },
    agree:{ 'Strongly Disagree':0, Disagree:0.25, Neutral:0.5, Agree:0.75, 'Strongly Agree':1 }
  };
  return maps[type]?.[answer];
}

function readinessLabel(value) {
  if (value >= 85) return 'Very Strong';
  if (value >= 70) return 'Strong';
  if (value >= 50) return 'Developing';
  return 'Needs Development';
}

function scoreIsaAssessment(answers) {
  const sums = { P:0, E:0, M:0, R:0 };
  const counts = { P:0, E:0, M:0, R:0 };
  let total = 0;
  for (let id = 1; id <= 85; id += 1) {
    const meta = isaQuestionMeta(id);
    const row = answers?.[id] || answers?.[String(id)];
    const value = isaValue(meta.type, row?.answer);
    if (value === undefined) throw validationError('Please complete every inventory question before submitting.');
    sums[meta.group] += value;
    counts[meta.group] += 1;
    total += value;
  }
  const categories = Object.entries(ISA_CATEGORY_META).map(([key, meta]) => {
    const score = Math.round((sums[key] / counts[key]) * 100);
    return { key, ...meta, score, label:readinessLabel(score) };
  });
  const overall = Math.round((total / 85) * 100);
  return {
    assessmentType:'isa_readiness',
    assessmentTitle:'Ministry Readiness Inventory',
    overall,
    overallLabel:readinessLabel(overall),
    categories
  };
}

const MINISTRY_STYLES = ['pioneer', 'mobilizer', 'shepherd', 'steward'];
const MINISTRY_DOMAINS = new Set([
  'Church Multiplication', 'Leadership & Decision-Making', 'Conflict & Pressure',
  'Disciple-Making & Care', 'Team Dynamics', 'Communication & Influence',
  'Planning & Stewardship', 'Change & Innovation'
]);

function styleLabel(style) {
  return String(style || '').replace(/(^|\s)\S/g, match => match.toUpperCase());
}

function scoreMinistryStyle(answers) {
  const raw = Object.fromEntries(MINISTRY_STYLES.map(style => [style, 0]));
  const domainRaw = {};
  const styleDomainExpression = Object.fromEntries(MINISTRY_STYLES.map(style => [style, {}]));
  for (let id = 1; id <= 48; id += 1) {
    const row = answers?.[id] || answers?.[String(id)];
    if (!row || !MINISTRY_STYLES.includes(row.most) || !MINISTRY_STYLES.includes(row.least) || row.most === row.least) {
      throw validationError('Please complete every Ministry Style set before submitting.');
    }
    const domain = MINISTRY_DOMAINS.has(row.domain) ? row.domain : 'Other';
    if (!domainRaw[domain]) {
      domainRaw[domain] = {
        scoreRaw:0,
        count:0,
        mostByStyle:Object.fromEntries(MINISTRY_STYLES.map(style => [style, 0])),
        leastByStyle:Object.fromEntries(MINISTRY_STYLES.map(style => [style, 0]))
      };
    }
    domainRaw[domain].count += 1;
    raw[row.most] += 2;
    raw[row.least] -= 1;
    domainRaw[domain].scoreRaw += 1;
    domainRaw[domain].mostByStyle[row.most] += 1;
    domainRaw[domain].leastByStyle[row.least] += 1;
    for (const style of MINISTRY_STYLES) {
      if (!styleDomainExpression[style][domain]) styleDomainExpression[style][domain] = { raw:0, count:0, normalized:50 };
      const cell = styleDomainExpression[style][domain];
      cell.count += 1;
      if (row.most === style) cell.raw += 2;
      if (row.least === style) cell.raw -= 1;
    }
  }
  const normalized = Object.fromEntries(
    MINISTRY_STYLES.map(style => [style, Math.round(((raw[style] + 48) / 144) * 100)])
  );
  for (const domains of Object.values(styleDomainExpression)) {
    for (const value of Object.values(domains)) {
      value.normalized = Math.round(((value.raw + value.count) / (value.count * 3)) * 100);
    }
  }
  const domainScores = Object.fromEntries(Object.entries(domainRaw).map(([domain, value]) => [domain, {
    score:Math.round(((value.scoreRaw + value.count) / (value.count * 3)) * 100),
    ...value
  }]));
  const ranked = MINISTRY_STYLES
    .map(key => ({ key, score:normalized[key], raw:raw[key] }))
    .sort((a, b) => b.score - a.score);
  const primaryStyle = ranked[0].key;
  const secondaryStyle = ranked[1].key;
  return {
    assessmentType:'ministry_style',
    assessmentTitle:'Ministry Style Inventory',
    raw,
    normalized,
    ranked,
    domainScores,
    styleDomainExpression,
    primaryStyle,
    secondaryStyle,
    lowestStyle:ranked[ranked.length - 1].key,
    primarySecondaryGap:ranked[0].score - ranked[1].score,
    blendName:`${styleLabel(primaryStyle)}-${styleLabel(secondaryStyle)}`,
    blendDescription:'',
    overall:normalized[primaryStyle],
    overallLabel:`${styleLabel(primaryStyle)}-${styleLabel(secondaryStyle)}`,
    completedSets:48
  };
}

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

module.exports = {
  scoreCharacterAssessment,
  scoreIsaAssessment,
  scoreMinistryStyle
};
