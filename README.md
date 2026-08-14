# CMC Pathway

CMC Pathway is the authenticated workspace for Church Multiplication Collective participants, regional leaders, and national administrators. It includes courses, assignments, assessments, applications, reports, events, and role-based regional administration.

## Required Netlify environment variables

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (secret; server functions only)
- `RESEND_API_KEY`
- `FROM_EMAIL`
- `ADMIN_EMAIL`
- `DEFAULT_LEADER_EMAIL`
- `STATE_LEADER_EMAILS_JSON`
- `NETLIFY_SITE_ID` and `NETLIFY_AUTH_TOKEN` when Netlify Blobs are used

The retired shared `ADMIN_PASSWORD` variable is no longer used and should be deleted from Netlify.

## Required security migration

Before publishing this revision, run [`supabase_security_hardening.sql`](supabase_security_hardening.sql) once in the Supabase SQL Editor. It:

- protects account roles, pathway stages, archive status, email, and region routing from browser-side changes;
- normalizes the Southeast region name;
- locks submitted applications until a leader reopens them;
- records application submission and reopening history;
- limits candidate uploads to the authenticated user's folder and approved file types;
- removes direct browser write access to applications.
- rate-limits report and invitation emails to reduce accidental flooding or abuse.

Application photos accept JPEG, PNG, WebP, HEIC, and HEIF up to 25 MB. Common photo formats are reduced in the browser when useful. Résumés accept PDF, DOC, and DOCX up to 15 MB. The server verifies the stored object's real size and content type before attaching it to an application.

## Administration

There is no shared-password admin page. Administrators and regional leaders use their own Supabase accounts:

- People: `/leader.html`
- Courses: `/courses.html` (national administrators)
- Events: `/events.html`
- Leaders: `/manage-leaders.html`
- Individual records and assignments: open a person from the People page

Regional leaders are limited to their own region. National administrators can work across all regions.

## Task plans

Task Plans are reusable, versioned launch checklists for the Deploy stage. National administrators can create, duplicate, publish, archive, and revise master templates. Regional leaders can assign a published template to a pioneer, adjust that participant's copy, add custom tasks, and review a newer master version before applying it. A participant sees their priority work, dates, dependencies, progress, timeline, and completed work without being able to change the master.

Individual tasks can be participant-editable, leader-managed, or require leader approval. Approval-required submissions remain incomplete until a leader reviews and approves them.

Before deploying the Task Plans feature:

1. Run [`supabase_task_plans_schema.sql`](supabase_task_plans_schema.sql) once in the Supabase SQL Editor.
2. Run [`supabase_task_plans_seed.sql`](supabase_task_plans_seed.sql) once to import the supplied Asana project as a master template.
3. Open **Task Plans** in CMC Pathway, review the imported template, update outdated R.A.M., Asana, PlanterPlan, Jotform, link, and contact references, and publish it only when the content is ready.

The imported template intentionally remains a draft. Master changes never silently rewrite an assigned participant plan; leaders are shown a reviewable update instead.

## Sessions

Supabase persists and refreshes normal browser sessions. A person is asked to log in again only when no valid session remains, such as after signing out, clearing browser storage, revoking access, or an unrecoverable token refresh failure.

## Tests

```bash
npm test
```
