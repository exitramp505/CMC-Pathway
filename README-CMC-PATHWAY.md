# CMC Pathway setup

CMC Pathway is the authenticated platform for Church Multiplication Collective participants, regional leaders, and national administrators.

Public CMC website administration is documented in
[`PUBLIC-WEBSITE-MIGRATION.md`](PUBLIC-WEBSITE-MIGRATION.md).

## Deployment order

1. Run `supabase_cmc_pathway_schema.sql` in the existing Supabase project.
2. Set account roles in `candidate_profiles`.
3. Run `supabase_courses_schema.sql`.
4. Run `supabase_course_access_schema.sql`.
5. Run `supabase_pathway_archive_schema.sql`.
6. Run `supabase_security_hardening.sql`.
7. Run `supabase_public_website_content_schema.sql`.
8. Add the required Netlify environment variables.
9. Deploy the repository.
10. Build and publish Discover from the Courses screen.
11. Test one participant, one regional leader, and one national administrator.

## Account roles

- `participant`
- `regional_leader`
- `cmc_admin`

Participant is the database default. National administrators can grant access
across all regions from `/manage-leaders.html`. Regional leaders can grant
access only to accounts in their own region. No one can promote themselves.

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

## Native courses

Every completed participant profile receives a `discover_course` assignment.
The Discover card opens the published course with the slug `discover`.

National administrators can:

- open `/courses.html`;
- create draft courses;
- place each course in Discover, Discern, Develop, or Deploy;
- make a course automatic for every participant or leader-assigned;
- add ordered modules and lessons;
- add written content, video links, and reflection prompts;
- preview drafts;
- publish or unpublish courses.

Participant lesson completion is stored in Supabase. Completing all required
lessons updates the existing `discover_course` assignment to 100 percent so
regional leaders can see that the participant is ready for follow-up.

Published automatic courses are added to all current participants and to new
participants when they first open their pathway. Courses marked
leader-assigned remain hidden until a regional or national leader selects them
from the participant's Courses screen.

CMC courses, participant progress, and written reflections are handled directly
inside CMC Pathway and Supabase.

## Access

- Participants use `/dashboard.html`.
- Regional leaders and CMC administrators use `/leader.html`.
- Leaders can archive participant accounts without deleting their records.
- Archived people remain available through the Archived filter and can be restored.
- Regional leaders assign courses, forms, assessments, and events from each participant dashboard. New items can be reviewed and sent in one consolidated notification.
- Regional leaders manage additional leaders in their own region from `/manage-leaders.html`.
- National administrators build courses at `/courses.html`.
- Assessment reports are available from each person's dashboard. There is no shared-password admin page.
