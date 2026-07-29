# CMC Pathway setup

This build expands the Discernment Center into CMC Pathway.

## Deployment order

1. Run `supabase_cmc_pathway_schema.sql` in the existing Supabase project.
2. Set account roles in `candidate_profiles`.
3. Run `supabase_courses_schema.sql`.
4. Run `supabase_course_access_schema.sql`.
5. Add the required Netlify environment variables.
6. Deploy the repository.
7. Build and publish Discover from the Courses screen.
8. Test one participant, one regional leader, and one national administrator.

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

The old Pathwright functions can remain temporarily during migration, but the
native course flow does not call them and does not require Zapier or Pathwright
environment variables.

## Access

- Participants use `/dashboard.html`.
- Regional leaders and CMC administrators use `/leader.html`.
- Regional leaders assign optional courses at `/assign-courses.html`.
- National administrators build courses at `/courses.html`.
- Existing assessment administration remains at `/admin.html`.
