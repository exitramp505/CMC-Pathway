const { Resend } = require('resend');
const { enforceRateLimit } = require('./_rate-limit');

async function sendPathwaySummary({ supabase, participant, viewer, items }) {
  const cleanItems = (Array.isArray(items) ? items : [])
    .map(item => ({
      key:String(item.key || ''),
      type:String(item.type || 'assignment'),
      title:String(item.title || '').trim(),
      stage:String(item.stage || ''),
      detail:String(item.detail || '').trim()
    }))
    .filter(item => item.title);
  if (!cleanItems.length) return { sent:false, skipped:true, reason:'No new items.' };

  await enforceRateLimit(supabase, {
    actorId:viewer.id,
    action:'send_pathway_summary',
    limit:40,
    windowMinutes:60
  });

  const firstName = String(participant.full_name || '').trim().split(/\s+/)[0] || 'there';
  const subject = cleanItems.length === 1
    ? `A new item was added to your CMC Pathway`
    : `${cleanItems.length} new items were added to your CMC Pathway`;
  const batch = {
    user_id:participant.id,
    created_by:viewer.id,
    subject,
    items:cleanItems,
    item_count:cleanItems.length,
    status:'pending'
  };
  let batchId = null;
  const { data:batchRow } = await supabase
    .from('cmc_notification_batches')
    .insert(batch)
    .select('id')
    .maybeSingle();
  batchId = batchRow?.id || null;

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.FROM_EMAIL;
  if (!apiKey || !from || !participant.email) {
    await updateBatch(supabase, batchId, {
      status:'skipped',
      error:!participant.email
        ? 'Participant does not have an email address.'
        : 'RESEND_API_KEY or FROM_EMAIL is not configured.'
    });
    return {
      sent:false,
      skipped:true,
      reason:!participant.email ? 'Participant has no email address.' : 'Email is not configured.'
    };
  }

  const pathwayUrl = `${String(process.env.URL || process.env.SITE_URL || 'https://discernmentcenter.netlify.app').replace(/\/$/, '')}/dashboard.html`;
  const itemRows = cleanItems.map(item => `
    <tr>
      <td style="padding:14px 0;border-bottom:1px solid #eadfce">
        <div style="font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#4da79c">${escapeHtml(item.type)}${item.stage ? ` · ${escapeHtml(item.stage)}` : ''}</div>
        <div style="margin-top:4px;font-size:17px;font-weight:800;color:#293d48">${escapeHtml(item.title)}</div>
        ${item.detail ? `<div style="margin-top:4px;color:#65757c;line-height:1.5">${escapeHtml(item.detail)}</div>` : ''}
      </td>
    </tr>`).join('');
  const html = `<!doctype html><html><body style="margin:0;background:#fbf0de;font-family:Arial,sans-serif;color:#293d48">
    <div style="max-width:640px;margin:0 auto;padding:36px 22px">
      <div style="background:#293d48;border-radius:22px;padding:28px;color:#fbf0de">
        <div style="font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#ea9f43">CMC Pathway</div>
        <h1 style="margin:12px 0 8px;font-size:30px;line-height:1.1">New items in your pathway</h1>
        <p style="margin:0;color:#eadfce;line-height:1.55">Hi ${escapeHtml(firstName)}, ${escapeHtml(viewer.full_name || 'your CMC leader')} added the following ${cleanItems.length === 1 ? 'item' : 'items'} to your pathway.</p>
      </div>
      <table role="presentation" style="width:100%;border-collapse:collapse;margin:20px 0">${itemRows}</table>
      <a href="${escapeHtml(pathwayUrl)}" style="display:inline-block;padding:14px 22px;border-radius:999px;background:#ea9f43;color:#111;text-decoration:none;font-weight:800">Open My Pathway →</a>
      <p style="margin-top:26px;color:#65757c;font-size:12px;line-height:1.5">This email was sent because new work or an event invitation was added to your CMC Pathway account.</p>
    </div>
  </body></html>`;
  const text = [
    `Hi ${firstName},`,
    '',
    `${viewer.full_name || 'Your CMC leader'} added the following to your CMC Pathway:`,
    ...cleanItems.map(item => `- ${item.title}${item.stage ? ` (${item.stage})` : ''}${item.detail ? `: ${item.detail}` : ''}`),
    '',
    `Open My Pathway: ${pathwayUrl}`
  ].join('\n');

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from,
      to:[participant.email],
      subject,
      html,
      text,
      reply_to:viewer.email || process.env.ADMIN_EMAIL || undefined
    });
    if (result.error) throw new Error(result.error.message || 'Resend could not send the email.');
    const sentAt = new Date().toISOString();
    await updateBatch(supabase, batchId, { status:'sent', sent_at:sentAt, error:null });
    return { sent:true, batchId, messageId:result.data?.id || null, sentAt };
  } catch (error) {
    await updateBatch(supabase, batchId, { status:'failed', error:error.message || 'Email failed.' });
    return { sent:false, batchId, error:error.message || 'Email failed.' };
  }
}

async function updateBatch(supabase, id, updates) {
  if (!id) return;
  await supabase.from('cmc_notification_batches').update(updates).eq('id', id);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;'
  }[character]));
}

module.exports = { sendPathwaySummary };
