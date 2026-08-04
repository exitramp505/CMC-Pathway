(async function(){
  dcAuth.setupLogout();
  const user = await dcAuth.requireUser();
  if (!user) return;

  const shell = document.getElementById('applicationReport');
  const sb = await dcAuth.getSupabaseClient();
  const session = await sb.auth.getSession();
  const token = session.data?.session?.access_token || '';

  try {
    const res = await fetch('/.netlify/functions/application-get', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok || !data.application) {
      shell.innerHTML = `<div class="card"><h1>No Submitted Application Found</h1><p class="muted">You have not submitted an application yet.</p><a class="buttonLink" href="application.html">Start Application</a></div>`;
      return;
    }

    const row = data.application;
    const app = row.application || {};
    if (row.status !== 'submitted') {
      shell.innerHTML = `<div class="card"><h1>Application In Progress</h1><p class="muted">Your application has been started but not submitted yet.</p><a class="buttonLink" href="application.html">Finish Application</a></div>`;
      return;
    }

    shell.innerHTML = renderApplicationReport(row, app);
  } catch (error) {
    shell.innerHTML = `<div class="card"><h1>Could Not Load Application</h1><p class="warningText">${esc(error.message || 'Unexpected error.')}</p></div>`;
  }

  function renderApplicationReport(row, app) {
    const children = Array.isArray(app.children) && app.children.length
      ? `<ul>${app.children.map(c => `<li>${esc(c.name || '')} ${esc(c.age || '')} ${esc(c.sex || '')}</li>`).join('')}</ul>`
      : '<p>None listed</p>';

    const roles = Array.isArray(app.roles) && app.roles.length
      ? `<ul>${app.roles.map(r => `<li><strong>${esc(r.title || '')}</strong>${r.ministry ? ` — ${esc(r.ministry)}` : ''}${r.years ? ` (${esc(r.years)})` : ''}</li>`).join('')}</ul>`
      : '<p>None listed</p>';

    const plantingExperience = Array.isArray(app.plantingExperience) && app.plantingExperience.length
      ? `<ul>${app.plantingExperience.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`
      : '<p>None selected</p>';

    return `<div class="applicationReportHeader">
      <div>
        <div class="eyebrow">Submitted Application</div>
        <h1>${esc(app.fullName || row.candidate_name || 'Candidate')}</h1>
        <p>${esc(app.email || row.email || '')} · ${esc(app.phone || row.phone || '')} · ${esc(app.state || row.state || '')} / ${esc(app.region || row.region || '')} Region</p>
      </div>
      <div class="applicationReportStatus">
        <strong>Submitted</strong>
        <span>${formatDate(row.submitted_at || row.updated_at)}</span>
      </div>
    </div>

    <div class="applicationReportActions">
      <a class="buttonLink secondary" href="dashboard.html">Back to Dashboard</a>
      <a class="buttonLink" href="application.html">View Application</a>
    </div>

    <section class="applicationReportGrid">
      ${block('Personal Information', [
        ['Full Name', app.fullName],
        ['Date of Birth', app.birthDate],
        ['Email', app.email],
        ['Phone', app.phone],
        ['Address', [app.address, app.city, app.state, app.zip].filter(Boolean).join(', ')],
        ['Citizenship', app.citizenship],
        ['Marital Status', app.maritalStatus]
      ])}

      ${block('Family Information', [
        ['Spouse Name', app.spouseName],
        ['Spouse Birth Date', app.spouseBirthDate],
        ['Spouse Marital History', app.spouseMaritalHistory],
        ['Children', children, true]
      ])}

      ${block('Faith and Calling', [
        ['Conversion Story', app.conversionStory],
        ['Call to Ministry', app.callToMinistry]
      ])}

      ${block('Ministerial Experience', [
        ['Sponsoring Church?', app.hasSponsor],
        ['Sponsoring Church', app.sponsoringOrg],
        ['License Status', app.licenseStatus],
        ['Planting Experience / Training', plantingExperience, true],
        ['Recent Ministry Roles', roles, true]
      ])}

      ${block('Financial Information', [
        ['Last Year Household Income', app.lastYearIncome],
        ['Five-Year Average Income', app.averageIncome],
        ['Personal Bankruptcy', app.bankruptcy],
        ['School Loans', debt(app, 'school')],
        ['Mortgage', debt(app, 'mortgage')],
        ['Car Loans', debt(app, 'car')],
        ['Credit Card Balance', debt(app, 'credit')],
        ['Other Loans', debt(app, 'other')]
      ])}

      ${block('Church Planting Plan and Vision', [
        ['Why do you want to plant a church?', app.whyPlant],
        ['Type of church plant', app.plantType],
        ['Target Community', app.targetAudience],
        ['Financial plan for family and church', app.financialPlan],
        ['Timing', app.plantTiming],
        ['Pastor Counsel', app.pastorCounsel],
        ['Pastor Support', app.pastorSupport],
        ['Support Network', app.supportNetwork],
        ['Spouse Involvement', app.spouseInvolvement]
      ])}

      ${block('Statement of Faith and Core Convictions', [
        ['Waiver Agreement', app.waiverAgreement ? 'Agreed' : 'Not checked'],
        ['Statement of Faith', app.statementOfFaith === 'Yes' ? 'In harmony' : app.statementOfFaith === 'No' ? 'Objected' : 'Not answered'],
        ['Statement Explanation', app.statementFaithExplanation],
        ['Core Convictions', app.coreConvictions ? 'Read' : 'Not checked']
      ])}
    </section>`;
  }

  function debt(app, key) {
    const type = app[`debt_${key}_type`] || '';
    const amount = app[`debt_${key}_amount`] || '';
    const interest = app[`debt_${key}_interest`] || '';
    const payment = app[`debt_${key}_payment`] || '';
    if (!type && !amount && !interest && !payment) return '';
    return [type, amount && `Amount: ${amount}`, interest && `Interest: ${interest}`, payment && `Payment: ${payment}`].filter(Boolean).join(' · ');
  }

  function block(title, rows) {
    return `<article class="applicationReportBlock">
      <h2>${esc(title)}</h2>
      ${rows.map(([label, value, html]) => {
        const clean = value || '';
        return `<div class="applicationReportRow">
          <strong>${esc(label)}</strong>
          <div>${html ? clean : `<p>${esc(clean || '—')}</p>`}</div>
        </div>`;
      }).join('')}
    </article>`;
  }

  function formatDate(value) {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
    } catch (_) {
      return '—';
    }
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, m => ({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#039;'
    }[m]));
  }
})();
