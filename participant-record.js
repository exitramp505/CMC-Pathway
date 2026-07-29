(async function(){
  dcAuth.setupLogout();
  const user = await dcAuth.requireUser();
  if (!user) return;

  const query = new URLSearchParams(window.location.search);
  const participantId = query.get('participant') || '';
  const type = query.get('type') || '';
  const recordId = query.get('record') || '';
  const shell = document.getElementById('participantRecordShell');
  document.getElementById('backToParticipant').href =
    participantId ? `participant.html?id=${encodeURIComponent(participantId)}#records` : 'leader.html';

  try {
    const sb = await dcAuth.getSupabaseClient();
    const session = await sb.auth.getSession();
    const token = session.data?.session?.access_token || '';
    const params = new URLSearchParams({ participant_id:participantId, type });
    if (recordId) params.set('record_id', recordId);
    const response = await fetch(`/.netlify/functions/participant-record?${params.toString()}`, {
      headers:{ Authorization:`Bearer ${token}` }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Could not load this record.');
    }

    dcAuth.renderRoleNavigation(data.viewer, 'people');
    const participantName = data.participant?.full_name || data.participant?.email || 'Participant';
    document.title = `${recordTitle(data)} | ${participantName}`;
    shell.innerHTML = data.type === 'application'
      ? renderApplication(data.record, data.participant)
      : data.type === 'course_reflection'
        ? renderCourseReflection(data.record, data.participant)
        : renderAssessment(data.record, data.participant);
  } catch (error) {
    shell.innerHTML = `<div class="cmcParticipantDetailError">
      <strong>Unable to open this record.</strong>
      <p>${escapeHtml(error.message || 'Unexpected error.')}</p>
    </div>`;
  }

  function renderAssessment(row, participant) {
    const scores = row.scores || {};
    const record = {
      candidate:row.candidate || {
        name:participant.full_name,
        email:participant.email,
        phone:participant.phone,
        state:participant.state,
        region:participant.region
      },
      scores,
      answers:row.answers || {},
      overall:row.overall,
      overallLabel:row.overall_label,
      region:row.region || participant.region,
      audience:'coach'
    };
    const assessmentType = scores.assessmentType || 'character_qualities';
    if (assessmentType === 'isa_readiness' && typeof isaReportHtml === 'function') {
      return isaReportHtml(record);
    }
    if (assessmentType === 'ministry_style' && window.MinistryStyleReport) {
      return window.MinistryStyleReport.buildCoachReportHtml(record);
    }
    return renderCharacterAssessment(record, row.created_at);
  }

  function renderCharacterAssessment(record, createdAt) {
    const candidate = record.candidate || {};
    const scores = record.scores || {};
    const results = Array.isArray(scores.results) ? scores.results : [];
    return `<article class="cmcRecordDocument">
      <header class="cmcRecordDocumentHeader">
        <div>
          <p class="cmcEyebrow">CHARACTER QUALITIES ASSESSMENT</p>
          <h1>${escapeHtml(candidate.name || candidate.full_name || 'Participant')}</h1>
          <p>${escapeHtml([candidate.email, candidate.phone, candidate.region && `${candidate.region} Region`].filter(Boolean).join(' · '))}</p>
        </div>
        <div class="cmcRecordOverall">
          <span>Overall</span>
          <strong>${escapeHtml(scores.overall ?? record.overall ?? '—')}</strong>
          <small>${escapeHtml(scores.overallLabel || record.overallLabel || '')}</small>
        </div>
      </header>
      <p class="cmcRecordDate">Completed ${escapeHtml(formatDate(createdAt))}</p>
      <section class="cmcCharacterResultGrid">
        ${results.map(result => `<article>
          <span>${escapeHtml(result.name)}</span>
          <strong>${escapeHtml(result.score ?? 'N/A')}</strong>
          <small>${escapeHtml(result.label || '')}</small>
          <div><i style="width:${scoreWidth(result.score)}%"></i></div>
        </article>`).join('') || '<p>No scored categories were found in this report.</p>'}
      </section>
    </article>`;
  }

  function renderApplication(row, participant) {
    const app = row.application || {};
    return `<article class="cmcRecordDocument cmcApplicationRecord">
      <header class="cmcRecordDocumentHeader">
        <div>
          <p class="cmcEyebrow">DISCERNMENT APPLICATION</p>
          <h1>${escapeHtml(app.fullName || participant.full_name || 'Participant')}</h1>
          <p>${escapeHtml([
            app.email || participant.email,
            app.phone || participant.phone,
            (app.region || participant.region) && `${app.region || participant.region} Region`
          ].filter(Boolean).join(' · '))}</p>
        </div>
        <div class="cmcRecordStatus">
          <strong>${escapeHtml(titleCase(row.status || 'In progress'))}</strong>
          <span>${escapeHtml(formatDate(row.submitted_at || row.updated_at))}</span>
        </div>
      </header>
      <section class="applicationReportGrid">
        ${applicationBlock('Personal Information', [
          ['Full name', app.fullName],
          ['Date of birth', app.birthDate],
          ['Email', app.email],
          ['Phone', app.phone],
          ['Address', [app.address, app.city, app.state, app.zip].filter(Boolean).join(', ')],
          ['Citizenship', app.citizenship],
          ['Marital status', app.maritalStatus]
        ])}
        ${applicationBlock('Faith and Calling', [
          ['Conversion story', app.conversionStory],
          ['Call to ministry', app.callToMinistry]
        ])}
        ${applicationBlock('Ministerial Experience', [
          ['Sponsoring church?', app.hasSponsor],
          ['Sponsoring church', app.sponsoringOrg],
          ['License status', app.licenseStatus],
          ['Planting experience / training', listValue(app.plantingExperience)],
          ['Recent ministry roles', roleValue(app.roles)]
        ])}
        ${applicationBlock('Church Planting Plan and Vision', [
          ['Why do you want to plant a church?', app.whyPlant],
          ['Type of church plant', app.plantType],
          ['Target community', app.targetAudience],
          ['Financial plan', app.financialPlan],
          ['Timing', app.plantTiming],
          ['Pastor counsel', app.pastorCounsel],
          ['Pastor support', app.pastorSupport],
          ['Support network', app.supportNetwork],
          ['Spouse involvement', app.spouseInvolvement]
        ])}
        ${applicationBlock('Family Information', [
          ['Spouse name', app.spouseName],
          ['Spouse birth date', app.spouseBirthDate],
          ['Spouse marital history', app.spouseMaritalHistory],
          ['Children', childValue(app.children)]
        ])}
        ${applicationBlock('Financial Information', [
          ['Last year household income', app.lastYearIncome],
          ['Five-year average income', app.averageIncome],
          ['Personal bankruptcy', app.bankruptcy],
          ['School loans', debt(app, 'school')],
          ['Mortgage', debt(app, 'mortgage')],
          ['Car loans', debt(app, 'car')],
          ['Credit card balance', debt(app, 'credit')],
          ['Other loans', debt(app, 'other')]
        ])}
        ${applicationBlock('Statement of Faith and Core Convictions', [
          ['Waiver agreement', app.waiverAgreement ? 'Agreed' : 'Not checked'],
          ['Statement of faith', app.statementOfFaith === 'Yes' ? 'In harmony' : app.statementOfFaith === 'No' ? 'Objected' : 'Not answered'],
          ['Statement explanation', app.statementFaithExplanation],
          ['Core convictions', app.coreConvictions ? 'Read' : 'Not checked']
        ])}
      </section>
    </article>`;
  }

  function renderCourseReflection(row, participant) {
    return `<article class="cmcRecordDocument cmcCourseReflectionRecord">
      <header class="cmcRecordDocumentHeader">
        <div>
          <p class="cmcEyebrow">COURSE REFLECTION</p>
          <h1>${escapeHtml(row.lesson_title || 'Course reflection')}</h1>
          <p>${escapeHtml(row.course_title || 'CMC Course')} · ${escapeHtml(participant.full_name || participant.email || 'Participant')}</p>
        </div>
        <div class="cmcRecordStatus">
          <strong>Saved</strong>
          <span>${escapeHtml(formatDate(row.updated_at))}</span>
        </div>
      </header>
      ${row.reflection_prompt ? `<section class="cmcCourseReflectionPrompt">
        <p class="cmcEyebrow">PROMPT</p>
        <h2>${escapeHtml(row.reflection_prompt)}</h2>
      </section>` : ''}
      <section class="cmcCourseReflectionAnswer">
        <p class="cmcEyebrow">PARTICIPANT RESPONSE</p>
        <p>${escapeHtml(row.response_text || 'No response was recorded.').replace(/\n/g, '<br>')}</p>
      </section>
    </article>`;
  }

  function applicationBlock(title, rows) {
    return `<article class="applicationReportBlock">
      <h2>${escapeHtml(title)}</h2>
      ${rows.map(([label, value]) => `<div class="applicationReportRow">
        <strong>${escapeHtml(label)}</strong>
        <div><p>${escapeHtml(value || '—').replace(/\n/g, '<br>')}</p></div>
      </div>`).join('')}
    </article>`;
  }

  function listValue(value) {
    return Array.isArray(value) ? value.filter(Boolean).join(', ') : value || '';
  }

  function childValue(children) {
    if (!Array.isArray(children)) return '';
    return children
      .map(child => [child.name, child.age, child.sex].filter(Boolean).join(' · '))
      .filter(Boolean)
      .join('\n');
  }

  function roleValue(roles) {
    if (!Array.isArray(roles)) return '';
    return roles
      .map(role => [role.title, role.ministry, role.years && `${role.years} years`].filter(Boolean).join(' · '))
      .filter(Boolean)
      .join('\n');
  }

  function debt(app, key) {
    return [
      app[`debt_${key}_type`],
      app[`debt_${key}_amount`] && `Amount: ${app[`debt_${key}_amount`]}`,
      app[`debt_${key}_interest`] && `Interest: ${app[`debt_${key}_interest`]}`,
      app[`debt_${key}_payment`] && `Payment: ${app[`debt_${key}_payment`]}`
    ].filter(Boolean).join(' · ');
  }

  function scoreWidth(score) {
    if (score === null || score === undefined) return 0;
    return Math.max(0, Math.min(100, ((Number(score) - 1) / 4) * 100));
  }

  function recordTitle(data) {
    if (data.type === 'application') return 'Discernment Application';
    if (data.type === 'course_reflection') return data.record?.lesson_title || 'Course Reflection';
    return data.record?.scores?.assessmentTitle || 'Assessment Report';
  }

  function formatDate(value) {
    if (!value) return 'Not recorded';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Not recorded';
    return date.toLocaleDateString([], { month:'long', day:'numeric', year:'numeric' });
  }

  function titleCase(value) {
    return String(value || '').replace(/_/g, ' ').replace(/\b\w/g, character => character.toUpperCase());
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#039;'
    })[character]);
  }
})();
