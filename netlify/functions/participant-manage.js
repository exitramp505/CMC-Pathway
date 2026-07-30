const { createClient } = require('@supabase/supabase-js');

const STAGES = new Set(['discover', 'discern', 'develop', 'deploy']);
const PROFILE_FIELDS = new Set([
  'full_name',
  'phone',
  'state',
  'region',
  'church_name',
  'ministry_role',
  'pathway_interest',
  'married'
]);
const PATHWAY_ITEMS = [
  {
    key:'discernment_application',
    title:'Discernment Application',
    description:'The participant’s story, calling, and ministry context.',
    type:'form',
    stage_key:'discern'
  },
  {
    key:'ministry_readiness',
    title:'Ministry Readiness Inventory',
    description:'A structured reflection on current ministry readiness.',
    type:'assessment',
    stage_key:'discern'
  },
  {
    key:'ministry_style',
    title:'Ministry Style Inventory',
    description:'An inventory of leadership and ministry patterns.',
    type:'assessment',
    stage_key:'discern'
  },
  {
    key:'character_qualities',
    title:'Character Qualities Assessment',
    description:'Character qualities that support healthy ministry.',
    type:'assessment',
    stage_key:'discern'
  },
  {
    key:'pastoral_reference',
    title:'Pastoral Reference Form',
    description:'Feedback from a pastor or ministry leader.',
    type:'form',
    stage_key:'discern'
  }
];

function json(statusCode, body) {
  return {
    statusCode,
    headers:{ 'Content-Type':'application/json' },
    body:JSON.stringify(body)
  };
}

exports.handler = async (event) => {
  if (!['GET', 'POST'].includes(event.httpMethod)) {
    return json(405, { ok:false, error:'Method not allowed.' });
  }

  try {
    const { supabase, viewer } = await requireLeader(event);
    const body = event.httpMethod === 'POST' ? JSON.parse(event.body || '{}') : {};
    const participantId = String(
      body.participant_id || event.queryStringParameters?.participant_id || ''
    );
    if (!isUuid(participantId)) {
      return json(400, { ok:false, error:'A participant is required.' });
    }

    const participant = await loadParticipant(supabase, viewer, participantId);
    if (!participant) {
      return json(404, { ok:false, error:'Participant not found in your region.' });
    }

    if (event.httpMethod === 'GET') {
      const { data:assignments, error } = await supabase
        .from('candidate_assignments')
        .select('item_key,status,progress,external_status,assignment_source,completed_at')
        .eq('user_id', participant.id)
        .in('item_key', PATHWAY_ITEMS.map(item => item.key));
      if (error) throw error;
      const assignmentByKey = new Map((assignments || []).map(item => [item.item_key, item]));
      return json(200, {
        ok:true,
        viewer,
        participant,
        pathway_items:PATHWAY_ITEMS.map(item => {
          const assignment = assignmentByKey.get(item.key);
          return {
            ...item,
            assigned:Boolean(assignment && assignment.status === 'assigned'),
            automatic:assignment?.assignment_source === 'automatic',
            progress:Number(assignment?.progress || 0),
            completed:Boolean(
              assignment?.completed_at
              || assignment?.external_status === 'completed'
              || Number(assignment?.progress || 0) >= 100
            )
          };
        })
      });
    }

    if (body.action === 'update_stage') {
      const currentStage = String(body.current_stage || '').toLowerCase();
      if (!STAGES.has(currentStage)) {
        return json(400, { ok:false, error:'Choose a valid pathway stage.' });
      }
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('candidate_profiles')
        .update({
          current_stage:currentStage,
          stage_updated_at:now,
          updated_at:now
        })
        .eq('id', participant.id)
        .select('id,current_stage,stage_updated_at')
        .single();
      if (error) throw error;
      return json(200, { ok:true, participant:data });
    }

    if (body.action === 'set_archive') {
      if (participant.account_role !== 'participant') {
        return json(400, { ok:false, error:'Leader access is managed from the Leaders page.' });
      }
      const archived = Boolean(body.archived);
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('candidate_profiles')
        .update({
          archived_at:archived ? now : null,
          updated_at:now
        })
        .eq('id', participant.id)
        .select('id,archived_at,updated_at')
        .single();
      if (error) throw error;
      return json(200, { ok:true, participant:data });
    }

    if (body.action === 'update_profile') {
      const source = body.profile && typeof body.profile === 'object' ? body.profile : {};
      const updates = {};
      for (const [key, value] of Object.entries(source)) {
        if (!PROFILE_FIELDS.has(key)) continue;
        updates[key] = String(value ?? '').trim();
      }
      if (!Object.keys(updates).length) {
        return json(400, { ok:false, error:'No profile changes were provided.' });
      }
      if (updates.state && !updates.region) {
        updates.region = regionForState(updates.state);
      }
      updates.updated_at = new Date().toISOString();
      const { data, error } = await supabase
        .from('candidate_profiles')
        .update(updates)
        .eq('id', participant.id)
        .select('id,full_name,email,phone,state,region,church_name,ministry_role,pathway_interest,married,current_stage,stage_updated_at,created_at,updated_at')
        .single();
      if (error) throw error;
      return json(200, { ok:true, participant:data });
    }

    if (body.action === 'update_assignments') {
      const validKeys = new Set(PATHWAY_ITEMS.map(item => item.key));
      const desiredKeys = new Set(
        Array.isArray(body.item_keys)
          ? body.item_keys.map(String).filter(key => validKeys.has(key))
          : []
      );
      const { data:existing, error:existingError } = await supabase
        .from('candidate_assignments')
        .select('id,item_key,status,assignment_source')
        .eq('user_id', participant.id)
        .in('item_key', [...validKeys]);
      if (existingError) throw existingError;

      const existingByKey = new Map((existing || []).map(item => [item.item_key, item]));
      const removableIds = (existing || [])
        .filter(item => item.assignment_source === 'leader' && !desiredKeys.has(item.item_key))
        .map(item => item.id);
      if (removableIds.length) {
        const { error } = await supabase
          .from('candidate_assignments')
          .delete()
          .in('id', removableIds);
        if (error) throw error;
      }

      const now = new Date().toISOString();
      for (const item of PATHWAY_ITEMS.filter(item => desiredKeys.has(item.key))) {
        const current = existingByKey.get(item.key);
        if (current) {
          if (current.status !== 'assigned') {
            const { error } = await supabase
              .from('candidate_assignments')
              .update({ status:'assigned', hidden_at:null, updated_at:now })
              .eq('id', current.id);
            if (error) throw error;
          }
          continue;
        }
        const { error } = await supabase
          .from('candidate_assignments')
          .insert({
            user_id:participant.id,
            candidate_email:participant.email || '',
            candidate_name:participant.full_name || '',
            item_key:item.key,
            item_type:item.type,
            stage_key:item.stage_key,
            status:'assigned',
            progress:0,
            external_status:'',
            assignment_source:'leader',
            assigned_at:now,
            updated_at:now
          });
        if (error) throw error;
      }

      return json(200, { ok:true });
    }

    return json(400, { ok:false, error:'Choose a participant management action.' });
  } catch (error) {
    return json(error.statusCode || 500, {
      ok:false,
      error:error.message || 'Could not update this participant.'
    });
  }
};

async function requireLeader(event) {
  const token = String(event.headers.authorization || event.headers.Authorization || '')
    .replace(/^Bearer\s+/i, '');
  if (!token) throw httpError(401, 'Missing authorization token.');
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const { data:userData, error:userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) throw httpError(401, 'Invalid session.');
  const { data:viewer, error } = await supabase
    .from('candidate_profiles')
    .select('id,full_name,email,region,account_role')
    .eq('id', userData.user.id)
    .maybeSingle();
  if (error) throw error;
  if (!viewer || !['regional_leader', 'cmc_admin'].includes(viewer.account_role)) {
    throw httpError(403, 'Regional leader access is required.');
  }
  return { supabase, viewer };
}

async function loadParticipant(supabase, viewer, id) {
  let query = supabase
    .from('candidate_profiles')
    .select('id,full_name,email,state,region,current_stage,stage_updated_at,account_role,archived_at')
    .eq('id', id);
  if (viewer.account_role === 'regional_leader') {
    if (!viewer.region) throw httpError(403, 'Your leader account does not have a region.');
    query = query.eq('region', viewer.region);
  }
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) return null;
  if (viewer.account_role === 'regional_leader') {
    return ['participant','regional_leader'].includes(data.account_role) ? data : null;
  }
  return data.account_role !== 'cmc_admin' || data.id === viewer.id ? data : null;
}

function regionForState(state) {
  const regions = {
    WA:'Pacific',HI:'Pacific',AK:'Pacific',AZ:'Pacific',UT:'Pacific',CA:'Pacific',NV:'Pacific',ID:'Pacific',OR:'Pacific',
    TX:'Central',OK:'Central',AR:'Central',WI:'Central',MN:'Central',IA:'Central',IL:'Central',MO:'Central',KS:'Central',
    CO:'Mountain Plains',WY:'Mountain Plains',NE:'Mountain Plains',SD:'Mountain Plains',ND:'Mountain Plains',MT:'Mountain Plains',
    NH:'East',VT:'East',MA:'East',ME:'East',RI:'East',CT:'East',NJ:'East',DE:'East',MD:'East',WV:'East',PA:'East',OH:'East',VA:'East',KY:'East',TN:'East',IN:'East',MI:'East',NY:'East',
    FL:'Southeast',GA:'Southeast',AL:'Southeast',MS:'Southeast',LA:'Southeast',SC:'Southeast',NC:'Southeast',PR:'Southeast'
  };
  return regions[state] || 'Unassigned';
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(String(value || ''));
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}
