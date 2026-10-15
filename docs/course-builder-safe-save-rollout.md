# CMC Pathway — Safe Course Builder saving rollout

**Status:** Prepared and integration-tested, **NOT deployed** until the CMC Pathway Supabase project is accessible.

This upgrade protects existing courses and participant data. It never reseeds Discover 101.

## Preflight

1. Confirm the production Supabase project associated with `pathway.openbiblecmc.org`. Do not use the separate credentialing or genealogy Supabase projects.
2. Make a restorable database backup and confirm restoration is supported.
3. Review all recent edits in the Course Builder and ensure no one is actively editing during the cutover.
4. Confirm the production tables include `cmc_courses`, `cmc_course_modules`, `cmc_course_lessons`, `cmc_course_lesson_progress`, `cmc_course_lesson_responses`, `candidate_assignments`, and `candidate_profiles`.

## Enable the transactional save function

1. In the **correct** Supabase project's SQL Editor, review and run `db/course_builder_safe_save.sql`. The script adds only the `save_revision` column (default 0) and a service-role-only RPC. It does **not** delete, reseed, or rewrite course records.
2. Verify the function exists and that only the service role can execute it. Also check Supabase database advisors.
3. Verify current Discover 101 module, lesson, and participant progress counts before and after the migration. They must match.
4. Publish the latest `main` commit **only after** the function has been installed. Existing browser sessions may need to refresh.
5. Test from an actual authenticated CMC admin account: create a harmless draft course, type text, wait for autosave, reopen, edit video/text/reflection, rearrange a module, publish, reopen, and check the participant view. Use a disposable draft—not Discover 101.
6. Open the same test course in two admin tabs. Save in tab A, then try to save different edits in tab B. Tab B should show a conflict and **must not overwrite A**.
7. Test a transient connection failure: unsaved text should stay in the editor and a later edit should retry. Test removal of a lesson with progress: deletion must fail without affecting saved progress.
8. Confirm assignments for automatic published courses remain intact and no unexpected invitations are sent. This RPC does not send emails.

## Implementation

- `course-save-patch.js`: creates changed-only patches; unchanged lesson content is not transmitted.
- `netlify/functions/course-admin.js`: validates input and authorizes the admin, then calls `cmc_apply_course_patch`.
- `db/course_builder_safe_save.sql`: PostgreSQL transaction, course-level revision lock, rollback on any invalid row, and participant-progress deletion guards.
- `course-builder.js`: keeps a known-saved snapshot, tracks revisions, serializes saves, detects conflicts, and avoids false success messages.
- `tests/course-saving.test.js`: changed-only patch tests.
- `tests/sql/course-save-tests.sql`: tested against an ephemeral PostgreSQL 17 service via GitHub Actions.

## Failure and rollback

If the migration is not installed, the new UI **must not** activate. If the UI ships prematurely it shows a clear save error instead of using the unsafe old writer.

If a problem emerges after deployment, stop additional admin edits; preserve any unsaved editor text and publish the previous known-good Netlify deploy. **Do not drop the migration column or function to roll back the website.** Leaving the additive database objects in place is safe. Reconcile any concurrent edits before retrying.

This plan does not change or reset participant progress, course IDs, or existing saved lesson content.
