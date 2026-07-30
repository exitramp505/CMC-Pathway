const { requireViewer, loadParticipant, json, isUuid } = require('./_event-access');
const { sendPathwaySummary } = require('./_notifications');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { ok:false, error:'Method not allowed.' });
  try {
    const { supabase, viewer } = await requireViewer(event, { leader:true });
    const body = JSON.parse(event.body || '{}');
    const participantId = String(body.participant_id || '');
    if (!isUuid(participantId)) return json(400, { ok:false, error:'A participant is required.' });
    const participant = await loadParticipant(supabase, viewer, participantId);
    if (!participant) return json(404, { ok:false, error:'Participant not found in your region.' });

    const items = Array.isArray(body.items) ? body.items.slice(0, 30) : [];
    if (!items.length) return json(200, { ok:true, sent:false, skipped:true });
    const result = await sendPathwaySummary({ supabase, participant, viewer, items });

    if (result.sent) {
      const sentAt = result.sentAt;
      const assignmentKeys = items
        .filter(item => item.source !== 'event')
        .map(item => String(item.key || ''))
        .filter(Boolean);
      const eventIds = items
        .filter(item => item.source === 'event')
        .map(item => String(item.key || '').replace(/^event:/, ''))
        .filter(isUuid);
      if (assignmentKeys.length) {
        await supabase.from('candidate_assignments')
          .update({ first_assigned_email_sent_at:sentAt, email_error:null })
          .eq('user_id', participant.id)
          .in('item_key', assignmentKeys);
      }
      if (eventIds.length) {
        await supabase.from('cmc_event_invitations')
          .update({ notification_sent_at:sentAt, updated_at:sentAt })
          .eq('user_id', participant.id)
          .in('event_id', eventIds);
      }
    }

    return json(200, { ok:true, ...result });
  } catch (error) {
    return json(error.statusCode || 500, {
      ok:false,
      error:error.message || 'Could not send the pathway notification.'
    });
  }
};
