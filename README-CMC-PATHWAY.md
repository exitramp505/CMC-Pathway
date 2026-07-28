# CMC Pathway setup

This build expands the Discernment Center into CMC Pathway.

## Deployment order

1. Run `supabase_cmc_pathway_schema.sql` in the existing Supabase project.
2. Set account roles in `candidate_profiles`.
3. Configure the Pathwright enrollment and progress automations.
4. Add the required Netlify environment variables.
5. Deploy the repository.
6. Test one participant and one regional leader account.

## Account roles

- `participant`
- `regional_leader`
- `cmc_admin`

Participant is the database default. Role changes must be made with the Supabase
service role or in the Supabase SQL editor; browser clients cannot promote
themselves.

Example:

```sql
update public.candidate_profiles
set account_role = 'cmc_admin'
where lower(email) = lower('george@openbibleeast.org');
```

Regional leader example:

```sql
update public.candidate_profiles
set account_role = 'regional_leader',
    region = 'East'
where lower(email) = lower('leader@example.org');
```

## Discover enrollment

Every completed participant profile creates a `discover_course` assignment.
The profile then calls `/.netlify/functions/pathwright-enroll`.

Required Netlify variable:

```text
PATHWRIGHT_ENROLL_WEBHOOK_URL
```

Configure the receiving automation to create a Pathwright registration
invitation for `Discover: Church Multiplication 101`, automatically create the
user, and send the invitation email.

## Pathwright progress

The progress receiver is:

```text
https://discernmentcenter.netlify.app/.netlify/functions/pathwright-progress-webhook
```

Required Netlify variable:

```text
PATHWRIGHT_WEBHOOK_SECRET
```

The calling automation must send the same secret in the
`x-cmc-webhook-secret` header.

Supported payload fields:

```json
{
  "event": "registration | completion",
  "email": "participant@example.org",
  "progress": 100,
  "pathwright_user_id": "optional"
}
```

Create two Pathwright-triggered automations:

1. New Registration → POST event `registration`.
2. Student Course Completion → POST event `completion` with progress `100`.

## Access

- Participants use `/dashboard.html`.
- Regional leaders and CMC administrators use `/leader.html`.
- Existing assessment administration remains at `/admin.html`.
