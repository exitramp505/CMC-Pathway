const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

const functionPath = path.resolve(__dirname, '../netlify/functions/participant-dashboard.js');

async function loadHandler(state) {
  const supabase = createMockSupabase(state);
  const originalLoad = Module._load;
  Module._load = function(request, parent, isMain) {
    if (request === '@supabase/supabase-js') return { createClient:() => supabase };
    return originalLoad.call(this, request, parent, isMain);
  };
  delete require.cache[functionPath];
  const loaded = require(functionPath);
  Module._load = originalLoad;
  return loaded.handler;
}

function createMockSupabase(state) {
  return {
    auth:{
      async getUser(token) {
        await delay(state.delay || 0);
        if (token !== 'valid-token') return { data:{ user:null }, error:new Error('Invalid session') };
        return { data:{ user:state.user }, error:null };
      }
    },
    from(table) {
      return new Query(table, state);
    }
  };
}

class Query {
  constructor(table, state) {
    this.table = table;
    this.state = state;
    this.operation = 'select';
    this.filters = [];
    this.values = null;
  }
  select() { return this; }
  eq(key, value) { this.filters.push(['eq', key, value]); return this; }
  in(key, value) { this.filters.push(['in', key, value]); return this; }
  order() { return this; }
  update(values) { this.operation = 'update'; this.values = values; return this; }
  insert(values) { this.operation = 'insert'; this.values = values; return this; }
  maybeSingle() { return this.execute(true); }
  then(resolve, reject) { return this.execute(false).then(resolve, reject); }
  async execute(single) {
    await delay(this.state.delay || 0);
    const forcedError = this.state.errors?.[this.table];
    if (forcedError) return { data:null, error:new Error(forcedError) };
    if (this.operation === 'update') {
      this.state.writes.push({ operation:'update', table:this.table, values:this.values, filters:this.filters });
      return { data:null, error:null };
    }
    if (this.operation === 'insert') {
      const rows = this.values.map((row, index) => ({ id:`inserted-${index + 1}`, ...row }));
      this.state.writes.push({ operation:'insert', table:this.table, values:rows, filters:this.filters });
      return { data:rows, error:null };
    }
    const value = tableData(this.table, this.state);
    return { data:single ? (value || null) : (value || []), error:null };
  }
}

function tableData(table, state) {
  const byTable = {
    candidate_profiles:state.profile,
    candidate_assignments:state.assignments,
    cmc_courses:state.courses,
    cmc_course_enrollments:state.enrollments,
    cmc_event_invitations:state.events,
    assessment_results:state.reports
  };
  return byTable[table];
}

function fixture(overrides = {}) {
  const future = new Date(Date.now() + 86400000).toISOString();
  return {
    delay:15,
    writes:[],
    user:{ id:'user-1', email:'george@example.org', user_metadata:{ full_name:'George Williams' } },
    profile:{
      id:'user-1', full_name:'George Williams', email:'george@example.org', phone:'4195550100',
      state:'OH', region:'East', married:'', account_role:'participant', church_name:'Open Bible',
      ministry_role:'Pastor', pathway_interest:'', current_stage:'discover', archived_at:null
    },
    assignments:[],
    courses:[{
      id:'course-1', slug:'discover', title:'Discover: Church Multiplication 101', subtitle:'A biblical introduction',
      description:'', stage_key:'discover', access_mode:'automatic', estimated_minutes:60, status:'published'
    }],
    enrollments:[{ course_id:'course-1', progress:100, completed_at:'2026-08-01T12:00:00.000Z', last_opened_at:'2026-08-01T12:00:00.000Z' }],
    events:[{
      id:'invite-1', event_id:'event-1', rsvp_status:'pending', attendance_status:'',
      invited_at:'2026-08-01T12:00:00.000Z', responded_at:null,
      cmc_events:{ id:'event-1', title:'CMC Gathering', summary:'', description:'', starts_at:future, ends_at:future,
        location_name:'Open Bible', address:'', rsvp_deadline:future, stage_key:'discern', region:'East', status:'published' }
    }],
    reports:[{ id:'report-1', created_at:'2026-08-01T12:00:00.000Z', scores:{ assessmentType:'isa_readiness' }, overall:80, overall_label:'Ready' }],
    errors:{},
    ...overrides
  };
}

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function run() {
  {
    const state = fixture();
    const handler = await loadHandler(state);
    const started = Date.now();
    const response = await handler({ httpMethod:'GET', headers:{ authorization:'Bearer valid-token' } });
    const elapsed = Date.now() - started;
    const body = JSON.parse(response.body);
    assert.equal(response.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(body.profile.full_name, 'George Williams');
    assert.equal(body.reports.length, 1);
    assert.equal(body.assignments.length, 2);
    const course = body.assignments.find(item => item.item_key === 'discover_course');
    assert.ok(course, 'automatic Discover assignment should be returned');
    assert.equal(course.progress, 100);
    assert.equal(course.external_status, 'completed');
    assert.equal(course.course.title, 'Discover: Church Multiplication 101');
    const event = body.assignments.find(item => item.item_type === 'event');
    assert.ok(event, 'active event invitation should be returned');
    assert.equal(event.event.title, 'CMC Gathering');
    assert.equal(state.writes.filter(write => write.operation === 'insert').length, 1);
    assert.ok(elapsed < 100, `parallel account reads should complete quickly; received ${elapsed}ms`);
  }

  {
    const existing = {
      id:'assignment-1', user_id:'user-1', item_key:'discover_course', item_type:'course', stage_key:'discover',
      status:'assigned', assignment_source:'automatic', hidden_at:null, progress:0, external_status:'',
      completed_at:null, updated_at:'2026-08-01T12:00:00.000Z', created_at:'2026-08-01T12:00:00.000Z'
    };
    const state = fixture({ assignments:[existing] });
    const handler = await loadHandler(state);
    const response = await handler({ httpMethod:'GET', headers:{ authorization:'Bearer valid-token' } });
    assert.equal(response.statusCode, 200);
    assert.equal(state.writes.length, 0, 'steady-state dashboard loads should not write automatic assignments');
  }

  {
    const state = fixture({ errors:{ cmc_course_enrollments:'Enrollment query failed' } });
    const handler = await loadHandler(state);
    const response = await handler({ httpMethod:'GET', headers:{ authorization:'Bearer valid-token' } });
    assert.equal(response.statusCode, 500);
    assert.match(JSON.parse(response.body).error, /Enrollment query failed/);
  }

  {
    const state = fixture();
    const handler = await loadHandler(state);
    const response = await handler({ httpMethod:'GET', headers:{} });
    assert.equal(response.statusCode, 401);
  }

  console.log('participant-dashboard: all tests passed');
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
