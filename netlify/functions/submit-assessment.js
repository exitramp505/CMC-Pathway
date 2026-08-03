const { Resend } = require('resend');
const { getStore } = require('@netlify/blobs');
const { createClient } = require('@supabase/supabase-js');
const { buildPdfBuffer, safeFileName, chartColor, STATES } = require('./pdf-generator');

function getAssessmentStore() {
  const name = 'discernment-assessments';
  const siteID = process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_AUTH_TOKEN;

  if (siteID && token) {
    return getStore({ name, siteID, token });
  }

  return getStore(name);
}

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function getUserFromAuthHeader(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return null;
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data || !data.user) return null;
  return data.user;
}


const QUALITY_DEFINITIONS = {
  "Resilience": "Resilience reflects the candidate’s capacity to keep moving faithfully when ministry becomes difficult. It includes emotional steadiness under pressure, the ability to recover after disappointment or criticism, and the maturity to learn from setbacks without becoming defeated, reactive, or withdrawn.",
  "Spousal Cooperation": "For married candidates, Spousal Cooperation reflects the health of shared calling and family alignment. It looks at whether ministry expectations are openly discussed, whether roles and boundaries are clear, and whether the couple can protect family life while serving together through the demands of ministry.",
  "Financial Responsibility": "Financial Responsibility reflects the candidate’s stewardship, discipline, and credibility with resources. It includes managing personal finances wisely, avoiding unnecessary financial pressure, living within realistic limits, and demonstrating the trustworthiness needed to handle church or ministry funds with integrity.",
  "Builds Group Cohesiveness": "Builds Group Cohesiveness reflects the ability to gather people into a unified ministry community. It includes helping newcomers belong, keeping a group focused on mission, building morale, encouraging collaboration, and addressing conflict in ways that preserve trust and move people forward together.",
  "Effectively Builds Relationships": "Effectively Builds Relationships reflects the candidate’s ability to form genuine, trust-building connections with people. It includes taking initiative relationally, listening well, responding to needs with compassion, helping others feel safe and valued, and relating wisely across different personalities and backgrounds.",
  "Flexible and Adaptable": "Flexible and Adaptable reflects the candidate’s ability to adjust without losing mission clarity. It includes handling ambiguity, changing methods when circumstances require it, responding creatively to challenges, and adapting leadership priorities through different seasons of ministry growth and pressure.",
  "Exercises Faith": "Exercises Faith reflects a pattern of leadership rooted in dependence on God rather than anxiety, control, or self-reliance. It includes conviction about calling, prayerful decision-making, expectancy that God is at work, willingness to obey before outcomes are guaranteed, and patience to wait on God’s timing.",
  "Cultural Agility": "Cultural Agility reflects the candidate’s ability to understand and serve people whose background, assumptions, or lived experience differ from their own. It includes humility, curiosity, cultural awareness, and the ability to adapt communication and ministry approaches to the actual people being reached.",
  "Visionizing Capacity": "Visionizing Capacity reflects the ability to see and communicate a compelling ministry future. It includes forming a clear picture of what God may be building, translating vision into practical next steps, helping others see beyond present limitations, and treating challenges as opportunities rather than dead ends.",
  "Utilizes Giftedness of Others": "Utilizes Giftedness of Others reflects the candidate’s ability to recognize, develop, and release the gifts of people around them. It includes matching people to meaningful opportunities, delegating wisely, equipping before assigning responsibility, and building ministry that does not depend entirely on one leader.",
  "Relates to the Lost and Unchurched": "Relates to the Lost and Unchurched reflects the candidate’s ability to build authentic connection with people outside the church. It includes communicating faith naturally, understanding questions and barriers unchurched people carry, creating welcoming pathways, and moving toward spiritually curious or disconnected people with confidence and care.",
  "Responsive to Community": "Responsive to Community reflects the candidate’s attentiveness to the real life, needs, culture, and pulse of the surrounding community. It includes listening before acting, identifying practical ways to serve, adapting ministry to the local context, and blessing the neighborhood rather than only serving insiders.",
  "Creates Ministry Ownership": "Creates Ministry Ownership reflects the ability to move people from attendance into shared responsibility. It includes helping people buy into the vision, giving away meaningful responsibility, equipping teams, building shared identity, and creating systems where ministry continues without everything depending on the primary leader.",
  "Committed to Kingdom Growth": "Committed to Kingdom Growth reflects a deep commitment to discipleship, mission, outreach, and multiplication. It includes resisting maintenance-only ministry, valuing growth as spiritual and relational transformation, celebrating Kingdom fruit beyond one organization, and seeking more and better disciples for the sake of God’s mission.",
  "Intrinsically Motivated": "Intrinsically Motivated reflects the candidate’s inner drive, initiative, and perseverance. It includes working from a sense of call rather than recognition, following through without constant external pressure, anticipating needed work, persisting through slow seasons, and being willing to build from little or nothing.",
};


const KNOCKOUT_QUALITIES = new Set(['Spousal Cooperation','Effectively Builds Relationships','Visionizing Capacity','Relates to the Lost and Unchurched','Creates Ministry Ownership','Intrinsically Motivated']);
function qualityHtmlName(name) {
  const safe = escapeHtml(name);
  return KNOCKOUT_QUALITIES.has(name) ? `<strong>${safe}*</strong>` : safe;
}


const STATE_REGIONS={WA:'Pacific',HI:'Pacific',AK:'Pacific',AZ:'Pacific',UT:'Pacific',CA:'Pacific',NV:'Pacific',ID:'Pacific',OR:'Pacific',TX:'Central',OK:'Central',AR:'Central',WI:'Central',MN:'Central',IA:'Central',IL:'Central',MO:'Central',KS:'Central',CO:'Mountain Plains',WY:'Mountain Plains',NE:'Mountain Plains',SD:'Mountain Plains',ND:'Mountain Plains',MT:'Mountain Plains',NH:'East',VT:'East',MA:'East',ME:'East',RI:'East',CT:'East',NJ:'East',DE:'East',MD:'East',WV:'East',PA:'East',OH:'East',VA:'East',KY:'East',TN:'East',IN:'East',MI:'East',NY:'East',FL:'South East',GA:'South East',AL:'South East',MS:'South East',LA:'South East',SC:'South East',NC:'South East',PR:'South East'};

const DEFAULT_STATE_LEADERS = {
  OH: 'leader-oh@example.com',
  MI: 'leader-mi@example.com',
  PA: 'leader-pa@example.com',
  NY: 'leader-ny@example.com'
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed' });
  }

  let savedRecord = null;

  try {
    const data = JSON.parse(event.body || '{}');
    const user = await getUserFromAuthHeader(event);
    const candidate = data.candidate || {};
    if (user) { data.userId = user.id; candidate.email = candidate.email || user.email; }
    const scores = data.scores || {};

    if (!candidate.name || !candidate.email || !candidate.state || !scores.results) {
      return json(400, { ok: false, error: 'Missing required report data.' });
    }

    const stateLeaders = getStateLeaders();
    const adminEmail = process.env.ADMIN_EMAIL;
    const leaderEmail = stateLeaders[candidate.state] || process.env.DEFAULT_LEADER_EMAIL || adminEmail;

    savedRecord = await saveSubmission(data, leaderEmail, data.userId || null);

    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.FROM_EMAIL;

    if (!apiKey || !fromEmail || !adminEmail) {
      return json(500, {
        ok: false,
        stored: true,
        submissionId: savedRecord.id,
        error: 'The report was stored, but email is not configured. Add RESEND_API_KEY, FROM_EMAIL, and ADMIN_EMAIL in Netlify environment variables.'
      });
    }

    const recipients = uniqueEmails([
      adminEmail,
      candidate.email,
      leaderEmail
    ]);

    const subject = `Discernment Assessment Report - ${candidate.name}`;
    const html = buildHtmlReport(data, leaderEmail, savedRecord.id);
    const text = buildTextReport(data, leaderEmail, savedRecord.id);
    const pdfBuffer = await buildPdfBuffer({ ...data, submittedAt: new Date().toISOString(), routedLeader: leaderEmail }, { leaderEmail });
    const pdfFilename = `${safeFileName(candidate.name)}-discernment-report.pdf`;

    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: fromEmail,
      to: recipients,
      subject,
      html,
      text,
      reply_to: adminEmail,
      attachments: [{
        filename: pdfFilename,
        content: pdfBuffer.toString('base64')
      }]
    });

    if (result.error) {
      await updateEmailStatus(savedRecord.key, {
        emailSent: false,
        emailError: result.error.message || 'Resend could not send the email.'
      });
      return json(500, {
        ok: false,
        stored: true,
        submissionId: savedRecord.id,
        error: result.error.message || 'Resend could not send the email.'
      });
    }

    await updateEmailStatus(savedRecord.key, {
      emailSent: true,
      messageId: result.data && result.data.id ? result.data.id : null,
      sentTo: recipients
    });

    return json(200, {
      ok: true,
      stored: true,
      emailSent: true,
      submissionId: savedRecord.id,
      sentTo: recipients,
      routedLeader: leaderEmail,
      messageId: result.data && result.data.id ? result.data.id : null
    });
  } catch (error) {
    return json(500, {
      ok: false,
      stored: Boolean(savedRecord),
      submissionId: savedRecord ? savedRecord.id : null,
      error: error.message || 'Unexpected server error.'
    });
  }
};

async function saveSubmission(data, leaderEmail, userId) {
  const store = getAssessmentStore();
  const now = new Date();
  const candidate = data.candidate || {};
  const id = `${now.toISOString().replace(/[:.]/g, '-')}-${slug(candidate.name || 'candidate')}`;
  const key = `${id}.json`;
  const record = {
    id,
    key,
    submittedAt: now.toISOString(),
    routedLeader: leaderEmail || '',
    emailSent: false,
    candidate,
    scores: data.scores || {},
    reflections: data.reflections || {},
    answers: data.answers || {}
  };
  await store.setJSON(key, record);
  await saveSupabaseSubmission(record, userId);
  return { id, key };
}

async function saveSupabaseSubmission(record, userId) {
  const admin = getSupabaseAdmin();
  if (!admin || !userId) return;
  const candidate = record.candidate || {};
  const state = candidate.state || '';
  const region = STATE_REGIONS[state] || candidate.region || '';
  await admin.from('candidate_profiles').upsert({
    id: userId,
    full_name: candidate.name || '',
    email: candidate.email || '',
    phone: candidate.phone || '',
    state,
    region,
    married: candidate.married || '',
    updated_at: new Date().toISOString()
  }, { onConflict: 'id' });
  await admin.from('assessment_results').insert({
    user_id: userId,
    candidate,
    scores: record.scores || {},
    answers: record.answers || {},
    state,
    region,
    overall: record.scores && record.scores.overall ? Number(record.scores.overall) : null,
    overall_label: record.scores && record.scores.overallLabel ? record.scores.overallLabel : '',
    routed_leader: record.routedLeader || '',
    email_sent: record.emailSent || false,
    blob_key: record.key || '',
    legacy_submission_id: record.id || ''
  });
}

async function updateEmailStatus(key, updates) {
  try {
    const store = getAssessmentStore();
    const existing = await store.get(key, { type: 'json' });
    if (!existing) return;
    await store.setJSON(key, { ...existing, ...updates, emailUpdatedAt: new Date().toISOString() });
    const admin = getSupabaseAdmin();
    if (admin) { await admin.from('assessment_results').update({ email_sent: Boolean(updates.emailSent), email_error: updates.emailError || null, message_id: updates.messageId || null }).eq('blob_key', key); }
  } catch (_) {
    // Do not fail the user flow if the status update fails.
  }
}

function slug(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'candidate';
}

function getStateLeaders() {
  if (!process.env.STATE_LEADER_EMAILS_JSON) return DEFAULT_STATE_LEADERS;
  try {
    return { ...DEFAULT_STATE_LEADERS, ...JSON.parse(process.env.STATE_LEADER_EMAILS_JSON) };
  } catch (_) {
    return DEFAULT_STATE_LEADERS;
  }
}

function uniqueEmails(emails) {
  return [...new Set((emails || []).filter(Boolean).map(e => String(e).trim()).filter(e => e.includes('@')))];
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildHtmlReport(data, leaderEmail, submissionId) {
  const c = data.candidate || {};
  const s = data.scores || {};
  const results = s.results || [];
  const stateName = STATES[c.state] || c.state || '';
  const region = STATE_REGIONS[c.state] || '';

  const profileRows = results.map(item => {
    const score = item.score;
    const hasScore = !(score === null || score === undefined);
    const pct = hasScore ? Math.max(0, Math.min(100, ((Number(score) - 1) / 4) * 100)) : 50;
    const color = hasScore ? chartColor(score) : '#94a3b8';
    const name = KNOCKOUT_QUALITIES.has(item.name) ? `<strong><em>${escapeHtml(item.name)}*</em></strong>` : `<strong>${escapeHtml(item.name)}</strong>`;
    return `<tr>
      <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;width:34%;font-size:13px;color:#172033;">${name}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;width:46%;">
        <div style="height:8px;background:#eef2f7;border-radius:999px;position:relative;">
          <div style="position:absolute;left:50%;top:-4px;width:1px;height:16px;background:#6b7280;"></div>
          ${hasScore ? `<div style="height:8px;border-radius:999px;background:${color};width:${Math.abs(pct-50)}%;margin-left:${Math.min(pct,50)}%;"></div>` : ''}
        </div>
      </td>
      <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px;color:#172033;"><strong>${escapeHtml(score ?? 'N/A')}</strong><br><span style="font-size:11px;color:#5b667a;">${escapeHtml(item.label || '')}</span></td>
    </tr>`;
  }).join('');

  const descriptionBlocks = results.map(item => {
    const isKo = KNOCKOUT_QUALITIES.has(item.name);
    const score = item.score ?? 'N/A';
    const label = item.label || 'N/A';
    const badgeFill = item.score === null || item.score === undefined ? '#f1f5f9' : Number(item.score) < 3 ? '#eef5ff' : Number(item.score) === 3 ? '#f8fafc' : '#edf8f3';
    return `<div style="border:1px solid #e2e8f0;border-radius:14px;padding:14px;margin:0 0 12px;background:#ffffff;">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
        <div>
          <div style="font-size:15px;font-weight:800;color:#111827;">${isKo ? `<em>${escapeHtml(item.name)}*</em>` : escapeHtml(item.name)}</div>
          ${isKo ? `<div style="display:inline-block;margin-top:5px;background:#eef7f1;border:1px solid #c9e7d4;color:#246b58;border-radius:999px;padding:3px 8px;font-size:11px;font-weight:700;">Knock-Out Factor</div>` : ''}
        </div>
        <div style="min-width:64px;text-align:center;border:1px solid #d8dee9;border-radius:12px;background:${badgeFill};padding:7px 8px;color:#172033;">
          <div style="font-weight:800;font-size:18px;line-height:18px;">${escapeHtml(score)}</div>
          <div style="font-size:10px;font-weight:700;color:#5b667a;line-height:12px;">${escapeHtml(label)}</div>
        </div>
      </div>
      <p style="margin:12px 0 0;color:#475569;font-size:13px;line-height:1.55;">${escapeHtml(QUALITY_DEFINITIONS[item.name] || '')}</p>
    </div>`;
  }).join('');

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#111827;line-height:1.5;max-width:780px;margin:0 auto;background:#f8fafc;padding:20px;">
    <div style="background:#ffffff;border:1px solid #dbe3ef;border-radius:20px;padding:28px;margin-bottom:18px;">
      <h1 style="font-size:28px;line-height:1.15;margin:0 0 8px;color:#172033;">CMC Pathway Character Qualities Report</h1>
      <p style="color:#5b667a;margin:0 0 22px;">Confidential assessment summary prepared for CMC leadership review.</p>
      <table style="width:100%;border-collapse:collapse;"><tr>
        <td style="vertical-align:top;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:16px;width:62%;">
          <div style="font-size:12px;font-weight:800;color:#5b667a;text-transform:uppercase;letter-spacing:.04em;">Candidate</div>
          <div style="font-size:20px;font-weight:800;color:#172033;margin:5px 0;">${escapeHtml(c.name)}</div>
          <div style="color:#5b667a;font-size:13px;">${escapeHtml(c.email || '')}${c.phone ? ` &nbsp; | &nbsp; ${escapeHtml(c.phone)}` : ''}</div>
          <div style="color:#5b667a;font-size:13px;margin-top:4px;">${escapeHtml(stateName)}${region ? ` / ${escapeHtml(region)} Region` : ''}</div>
        </td>
        <td style="width:18px;"></td>
        <td style="vertical-align:middle;background:#eef7f1;border:1px solid #c9e7d4;border-radius:14px;padding:16px;text-align:center;">
          <div style="font-size:12px;font-weight:800;color:#15945f;">Overall Readiness</div>
          <div style="font-size:34px;font-weight:900;color:#172033;line-height:1.05;margin-top:6px;">${escapeHtml(s.overall)}</div>
          <div style="font-size:13px;font-weight:800;color:#5b667a;">${escapeHtml(s.overallLabel)}</div>
        </td>
      </tr></table>
    </div>

    <div style="background:#ffffff;border:1px solid #dbe3ef;border-radius:20px;padding:22px;margin-bottom:18px;">
      <h2 style="font-size:20px;margin:0 0 8px;color:#172033;">Understanding the Character Qualities</h2>
      <p style="color:#334155;margin:0 0 10px;">The fifteen character qualities give CMC leaders a shared language for discussing readiness, strengths, and growth areas. This is not designed as a pass-or-fail scorecard. A score of <strong>3.0</strong> represents the baseline, meaning the quality is evident at a normal and expected level for this stage of discernment.</p>
      <p style="color:#334155;margin:0;">Categories marked with an asterisk (*) are knock-out factors and should receive special attention in discernment conversations.</p>
    </div>

    <div style="background:#ffffff;border:1px solid #dbe3ef;border-radius:20px;padding:22px;margin-bottom:18px;">
      <h2 style="font-size:20px;margin:0 0 6px;color:#172033;">Character Quality Score Profile</h2>
      <p style="color:#5b667a;margin:0 0 12px;font-size:13px;">The center line is the 3.0 baseline. Blue indicates below baseline; green indicates above baseline.</p>
      <table style="width:100%;border-collapse:collapse;">${profileRows}</table>
      <p style="font-size:12px;color:#5b667a;margin:12px 0 0;"><strong><em>* Knock-out Factor</em></strong></p>
    </div>

    <div style="background:#ffffff;border:1px solid #dbe3ef;border-radius:20px;padding:22px;">
      <h2 style="font-size:20px;margin:0 0 6px;color:#172033;">Character Quality Descriptions</h2>
      <p style="color:#5b667a;margin:0 0 16px;font-size:13px;">Each description explains what the category is intended to surface in the discernment process.</p>
      ${descriptionBlocks}
    </div>

    <p style="color:#6b7280;font-size:12px;margin:18px 0 0;text-align:center;">A polished PDF copy of this report is attached for saving, printing, and review.</p>
  </div>`;
}

function buildTextReport(data, leaderEmail, submissionId) {
  const c = data.candidate || {};
  const s = data.scores || {};
  const r = data.reflections || {};
  return `CMC Pathway Character Qualities Report

Submission ID: ${submissionId || ''}
Candidate: ${c.name || ''}
Email: ${c.email || ''}
Phone: ${c.phone || ''}
State: ${c.state || ''}
Married: ${c.married || ''}
Routed Regional Leader Email: ${leaderEmail || ''}

Overall Readiness: ${s.overall || ''} out of 5 - ${s.overallLabel || ''}

Category Scores:
${(s.results || []).map(item => `${KNOCKOUT_QUALITIES.has(item.name)?item.name+'*':item.name}: ${item.score ?? 'N/A'} - ${item.label}`).join('\n')}

Character Quality Descriptions:
${(s.results || []).map(item => `${KNOCKOUT_QUALITIES.has(item.name)?item.name+'*':item.name}: ${item.score ?? 'N/A'} - ${item.label}. ${QUALITY_DEFINITIONS[item.name] || ''}`).join('\n')}

This report is a discernment tool and should be reviewed alongside interviews, coach observations, and the broader CMC pathway.`;
}
