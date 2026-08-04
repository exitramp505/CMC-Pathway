# Supabase Portal Setup

This version adds candidate accounts and dashboard pages.

## 1. Run the SQL schema
In Supabase, go to SQL Editor and run `supabase_schema.sql`.

## 2. Add Netlify environment variables
Keep all existing variables, then add:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-public-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

`SUPABASE_ANON_KEY` is safe for browser use. `SUPABASE_SERVICE_ROLE_KEY` is private and must be marked secret in Netlify.

## 3. Auth settings
In Supabase Authentication settings, set your site URL to your Netlify URL. Add redirects for:

```
https://your-site.netlify.app/login.html
https://your-site.netlify.app/dashboard.html
```

## 4. Pages included
- `/signup.html` candidate sign up
- `/login.html` candidate login
- `/profile.html` profile editor
- `/dashboard.html` candidate dashboard
- `/assessment.html` Character Qualities Assessment
- `/report.html?id=...` completed report view
- `/leader.html` regional or national People dashboard
- `/manage-leaders.html` role administration

The previous shared-password admin dashboard has been removed. All management uses individual authenticated accounts.

## 5. Notes
Reports are still emailed through Resend. They are stored in Supabase and also stored in Netlify Blobs as a fallback.

## Ministry Readiness Inventory

This version adds a second assessment at `/isa-assessment.html` and links it from the candidate dashboard. Results are stored in the existing `assessment_results` table with `scores.assessmentType = "isa_readiness"`.
