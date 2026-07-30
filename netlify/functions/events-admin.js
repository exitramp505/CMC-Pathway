const {
  STAGES,
  requireViewer,
  loadParticipant,
  eventVisibleToRegion,
  canManageEvent,
  json,
  isUuid,
  httpError
} = require('./_event-access');
const { sendPathwaySummary } = require('./_notifications');

exports.handler = async (event) => {
  if (!['GET', 'POST'].includes(event.httpMethod)) {
    return json(405, { ok:false, error:'Method not allowed.' });
  }
  try {
    const { supabase, viewer } = await requireViewer(event, { leader:true });
    if (event.httpMethod === 'GET') {
      return json(200, await loadAdminData(supabase, viewer, event.queryStringParameters || {}));
    }

    const body = JSON.parse(event.body || '{}');
    if (body.action === 'save_event') {
      const saved = await saveEvent(supabase, viewer, body.event || {});
      return json(200, { ok:true, event:saved });
    }
    if (body.action === 'set_invitees') {
      const result = await setInvitees(supabase, viewer, body);
      return json(200, { ok:true, ...result });
    }
    if (body.action === 'set_participant_invitations') {
      const result = await setParticipantInvitations(supabase, viewer, body);
      return json(200, { ok:true, ...result });
    }
    if (body.action === 'update_attendance') {
      const result = await updateAttendance(supabase, viewer, body);
      return json(200, { ok:true, invitation:result });
    }
    if (body.action === 'cancel_event') {
      const result = await cancelEvent(supabase, viewer, body.event_id);
      return json(200, { ok:true, event:result });
    }
    return json(400, { ok:false, error:'Choose an event management action.' });
  } catch (error) {
    return json(error.statusCode || 500, {
      ok:false,
      error:error.message || 'Could not manage events.'
    });
  }
};

async function loadAdminData(supabase, viewer, query) {
  const participantId = String(query.participant_id || '');
  let eventQuery = supabase
    .from('cmc_events')
    .select('*')
    .order('starts_at', { ascending:true });
  if (viewer.account_role === 'regional_leader') {
    eventQuery = eventQuery.eq('region', viewer.region);
  }
  const { data:events, error:eventError } = await eventQuery;
  if (eventError) throw eventError;

  if (participantId) {
    if (!isUuid(participantId)) throw httpError(400, 'A valid participant is required.');
    const participant = await loadParticipant(supabase, viewer, participantId);
    if (!participant) throw httpError(404, 'Participant not found in your region.');
    const { data:invitations, error } = await supabase
      .from('cmc_event_invitations')
      .select('id,event_id,rsvp_status,attendance_status,invited_at,responded_at,notification_sent_at')
      .eq('user_id', participant.id);
    if (error) throw error;
    const invitationByEvent = new Map((invitations || []).map(item => [item.event_id, item]));
    const now = Date.now();
    const availableEvents = (events || [])
      .filter(item => item.status === 'published')
      .filter(item => eventVisibleToRegion(item, participant.region))
      .filter(item => new Date(item.ends_at || item.starts_at).getTime() >= now)
      .map(item => ({ ...item, invitation:invitationByEvent.get(item.id) || null }));
    return { ok:true, viewer, participant, events:availableEvents };
  }

  let participantQuery = supabase
    .from('candidate_profiles')
    .select('id,full_name,email,state,region,church_name,current_stage')
    .eq('account_role', 'participant')
    .is('archived_at', null)
    .order('full_name');
  if (viewer.account_role === 'regional_leader') {
    participantQuery = participantQuery.eq('region', viewer.region);
  }
  const { data:participants, error:participantError } = await participantQuery;
  if (participantError) throw participantError;

  const eventIds = (events || []).map(item => item.id);
  let invitations = [];
  if (eventIds.length) {
    const { data, error } = await supabase
      .from('cmc_event_invitations')
      .select('id,event_id,user_id,rsvp_status,attendance_status,invited_at,responded_at,notification_sent_at')
      .in('event_id', eventIds);
    if (error) throw error;
    invitations = data || [];
  }
  return { ok:true, viewer, events:events || [], participants:participants || [], invitations };
}

async function saveEvent(supabase, viewer, source) {
  const id = String(source.id || '');
  const startsAt = validDate(source.starts_at, 'Choose a valid event start date and time.');
  const endsAt = source.ends_at ? validDate(source.ends_at, 'Choose a valid event end date and time.') : null;
  if (endsAt && new Date(endsAt) < new Date(startsAt)) {
    throw httpError(400, 'The event end must be after its start.');
  }
  const title = String(source.title || '').trim();
  if (!title) throw httpError(400, 'Event title is required.');
  const stageKey = String(source.stage_key || 'discern').toLowerCase();
  if (!STAGES.has(stageKey)) throw httpError(400, 'Choose a valid pathway stage.');
  const status = ['draft', 'published'].includes(source.status) ? source.status : 'draft';
  const region = viewer.account_role === 'regional_leader'
    ? viewer.region
    : String(source.region || '').trim() || null;
  const values = {
    title,
    summary:String(source.summary || '').trim(),
    description:String(source.description || '').trim(),
    starts_at:startsAt,
    ends_at:endsAt,
    location_name:String(source.location_name || '').trim(),
    address:String(source.address || '').trim(),
    rsvp_deadline:source.rsvp_deadline ? validDate(source.rsvp_deadline, 'Choose a valid RSVP deadline.') : null,
    stage_key:stageKey,
    region,
    status,
    updated_at:new Date().toISOString()
  };

  if (id) {
    if (!isUuid(id)) throw httpError(400, 'Invalid event.');
    const current = await getEvent(supabase, id);
    if (!current || !canManageEvent(viewer, current)) throw httpError(404, 'Event not found.');
    const { data, error } = await supabase.from('cmc_events')
      .update(values).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase.from('cmc_events')
    .insert({ ...values, created_by:viewer.id })
    .select('*').single();
  if (error) throw error;
  return data;
}

async function setInvitees(supabase, viewer, body) {
  const eventId = String(body.event_id || '');
  const event = await getEvent(supabase, eventId);
  if (!event || !canManageEvent(viewer, event)) throw httpError(404, 'Event not found.');
  if (event.status !== 'published') throw httpError(400, 'Publish the event before inviting people.');
  if (new Date(event.ends_at || event.starts_at).getTime() < Date.now()) {
    throw httpError(400, 'Past invitation history is retained and cannot be replaced.');
  }
  const desired = [...new Set((Array.isArray(body.participant_ids) ? body.participant_ids : [])
    .map(String).filter(isUuid))];
  const participants = await allowedParticipants(supabase, viewer, desired);
  if (participants.length !== desired.length) throw httpError(400, 'One or more participants are outside your region.');

  const { data:existing, error } = await supabase
    .from('cmc_event_invitations')
    .select('id,user_id,notification_sent_at')
    .eq('event_id', event.id);
  if (error) throw error;
  const existingByUser = new Map((existing || []).map(item => [item.user_id, item]));
  const removable = (existing || []).filter(item => !desired.includes(item.user_id)).map(item => item.id);
  if (removable.length) {
    const { error:deleteError } = await supabase.from('cmc_event_invitations').delete().in('id', removable);
    if (deleteError) throw deleteError;
  }

  const newParticipants = participants.filter(item => !existingByUser.has(item.id));
  if (newParticipants.length) {
    const now = new Date().toISOString();
    const { error:insertError } = await supabase.from('cmc_event_invitations').insert(
      newParticipants.map(item => ({
        event_id:event.id,
        user_id:item.id,
        invited_by:viewer.id,
        rsvp_status:'pending',
        attendance_status:'pending',
        invited_at:now,
        updated_at:now
      }))
    );
    if (insertError) throw insertError;
  }

  const notificationResults = [];
  if (body.notify !== false) {
    for (const participant of newParticipants) {
      const result = await sendPathwaySummary({
        supabase,
        participant,
        viewer,
        items:[eventNotificationItem(event)]
      });
      notificationResults.push({ participant_id:participant.id, ...result });
      if (result.sent) {
        await supabase.from('cmc_event_invitations')
          .update({ notification_sent_at:result.sentAt, updated_at:result.sentAt })
          .eq('event_id', event.id).eq('user_id', participant.id);
      }
    }
  }
  return {
    invited:desired.length,
    added:newParticipants.length,
    removed:removable.length,
    notifications:notificationResults
  };
}

async function setParticipantInvitations(supabase, viewer, body) {
  const participantId = String(body.participant_id || '');
  if (!isUuid(participantId)) throw httpError(400, 'A participant is required.');
  const participant = await loadParticipant(supabase, viewer, participantId);
  if (!participant) throw httpError(404, 'Participant not found in your region.');
  const desiredIds = [...new Set((Array.isArray(body.event_ids) ? body.event_ids : [])
    .map(String).filter(isUuid))];
  const now = new Date();

  let availableQuery = supabase.from('cmc_events').select('*')
    .eq('status', 'published')
    .gte('starts_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString());
  if (viewer.account_role === 'regional_leader') availableQuery = availableQuery.eq('region', viewer.region);
  const { data:available, error:availableError } = await availableQuery;
  if (availableError) throw availableError;
  const availableById = new Map((available || [])
    .filter(item => eventVisibleToRegion(item, participant.region))
    .map(item => [item.id, item]));
  if (desiredIds.some(id => !availableById.has(id))) {
    throw httpError(400, 'One or more events are no longer available.');
  }

  const { data:existing, error } = await supabase.from('cmc_event_invitations')
    .select('id,event_id')
    .eq('user_id', participant.id);
  if (error) throw error;
  const activeEventIds = new Set([...availableById.keys()]);
  const currentActive = (existing || []).filter(item => activeEventIds.has(item.event_id));
  const currentIds = new Set(currentActive.map(item => item.event_id));
  const removable = currentActive.filter(item => !desiredIds.includes(item.event_id)).map(item => item.id);
  if (removable.length) {
    const { error:deleteError } = await supabase.from('cmc_event_invitations').delete().in('id', removable);
    if (deleteError) throw deleteError;
  }
  const addIds = desiredIds.filter(id => !currentIds.has(id));
  if (addIds.length) {
    const timestamp = new Date().toISOString();
    const { error:insertError } = await supabase.from('cmc_event_invitations').insert(
      addIds.map(eventId => ({
        event_id:eventId,
        user_id:participant.id,
        invited_by:viewer.id,
        rsvp_status:'pending',
        attendance_status:'pending',
        invited_at:timestamp,
        updated_at:timestamp
      }))
    );
    if (insertError) throw insertError;
  }
  return {
    added_events:addIds.map(id => availableById.get(id)),
    removed:removable.length
  };
}

async function updateAttendance(supabase, viewer, body) {
  const invitationId = String(body.invitation_id || '');
  const status = String(body.attendance_status || '');
  if (!isUuid(invitationId)) throw httpError(400, 'Choose an event record.');
  if (!['pending', 'attended', 'did_not_attend', 'excused'].includes(status)) {
    throw httpError(400, 'Choose a valid attendance status.');
  }
  const { data:invitation, error } = await supabase.from('cmc_event_invitations')
    .select('id,event_id,user_id,rsvp_status,attendance_status')
    .eq('id', invitationId).maybeSingle();
  if (error) throw error;
  if (!invitation) throw httpError(404, 'Event invitation not found.');
  const event = await getEvent(supabase, invitation.event_id);
  if (!event || !canManageEvent(viewer, event)) throw httpError(403, 'You cannot update this event.');
  const timestamp = new Date().toISOString();
  const { data, error:updateError } = await supabase.from('cmc_event_invitations')
    .update({ attendance_status:status, updated_at:timestamp })
    .eq('id', invitation.id)
    .select('*').single();
  if (updateError) throw updateError;
  return data;
}

async function cancelEvent(supabase, viewer, eventId) {
  if (!isUuid(eventId)) throw httpError(400, 'Choose an event.');
  const event = await getEvent(supabase, eventId);
  if (!event || !canManageEvent(viewer, event)) throw httpError(404, 'Event not found.');
  const { data, error } = await supabase.from('cmc_events')
    .update({ status:'cancelled', updated_at:new Date().toISOString() })
    .eq('id', event.id).select('*').single();
  if (error) throw error;
  return data;
}

async function allowedParticipants(supabase, viewer, ids) {
  if (!ids.length) return [];
  let query = supabase.from('candidate_profiles')
    .select('id,full_name,email,state,region,church_name,current_stage')
    .eq('account_role', 'participant')
    .is('archived_at', null)
    .in('id', ids);
  if (viewer.account_role === 'regional_leader') query = query.eq('region', viewer.region);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function getEvent(supabase, id) {
  if (!isUuid(id)) return null;
  const { data, error } = await supabase.from('cmc_events').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data || null;
}

function eventNotificationItem(event) {
  const starts = new Date(event.starts_at);
  return {
    key:`event:${event.id}`,
    source:'event',
    type:'Event invitation',
    stage:event.stage_key,
    title:event.title,
    detail:`${starts.toLocaleString('en-US', {
      weekday:'short', month:'short', day:'numeric', hour:'numeric', minute:'2-digit',
      timeZone:'America/New_York'
    })}${event.location_name ? ` · ${event.location_name}` : ''}`
  };
}

function validDate(value, message) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) throw httpError(400, message);
  return date.toISOString();
}
