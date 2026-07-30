const { requireViewer, json, isUuid, httpError } = require('./_event-access');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { ok:false, error:'Method not allowed.' });
  try {
    const { supabase, user } = await requireViewer(event);
    const body = JSON.parse(event.body || '{}');
    const eventId = String(body.event_id || '');
    const rsvpStatus = String(body.rsvp_status || '');
    if (!isUuid(eventId)) throw httpError(400, 'Choose an event.');
    if (!['going', 'declined'].includes(rsvpStatus)) {
      throw httpError(400, 'Choose whether you are going or cannot attend.');
    }
    const { data:invitation, error } = await supabase.from('cmc_event_invitations')
      .select('id,event_id,user_id,rsvp_status,cmc_events(id,starts_at,ends_at,status)')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) throw error;
    if (!invitation) throw httpError(404, 'Event invitation not found.');
    const linkedEvent = Array.isArray(invitation.cmc_events)
      ? invitation.cmc_events[0]
      : invitation.cmc_events;
    if (!linkedEvent || linkedEvent.status !== 'published') {
      throw httpError(400, 'This event is no longer open for responses.');
    }
    if (new Date(linkedEvent.ends_at || linkedEvent.starts_at).getTime() < Date.now()) {
      throw httpError(400, 'This event has already ended.');
    }
    const timestamp = new Date().toISOString();
    const { data, error:updateError } = await supabase.from('cmc_event_invitations')
      .update({
        rsvp_status:rsvpStatus,
        responded_at:timestamp,
        updated_at:timestamp
      })
      .eq('id', invitation.id)
      .select('id,event_id,rsvp_status,attendance_status,responded_at')
      .single();
    if (updateError) throw updateError;
    return json(200, { ok:true, invitation:data });
  } catch (error) {
    return json(error.statusCode || 500, {
      ok:false,
      error:error.message || 'Could not save your response.'
    });
  }
};
