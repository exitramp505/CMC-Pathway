# CMC Pathway — Role-Based UX & Release Checklist

**Tracker:** [CMC UX improvement program #26](https://github.com/exitramp505/CMC-Pathway/issues/26)  
**Initial baseline (October 15, 2026):** GitHub `main` and Netlify production both at `1c67495979c21bfe2295e9a3ef5cbc0dfb3191ee` (`style.css?v=144`); the production deploy is locked.  
**Scope:** `https://pathway.openbiblecmc.org` (authenticated CMC Pathway), not the separate public CMC discovery website.

## How to use this checklist

- Use designated QA accounts for **participant, coach, regional leader, and national admin**. Never include credentials or private participant data in issue comments or screenshots.
- Test on a **preview deployment** first, with non-sensitive disposable drafts/test records. Do not send real invitations, publish actual courses or site content, or change someone's live progress as part of QA.
- Capture **expected behavior / observed result / screenshot or log / severity / issue or PR link** for failures. Mark a case **not tested** rather than passing it when authentication or test data is unavailable.
- Every changed workflow needs the targeted test, `npm run build:styles:check`, `npm test`, and green PR checks. CSS changes also require the responsive visual workflow.
- Production publishing requires a separate approval: record the old deploy ID and the tested new commit, publish deliberately, recheck, and retain a rollback route.

## Acceptance criteria

1. **Safety:** No accidental data changes or loss of drafts, course/lesson IDs, assignments, progress, approvals, or role boundaries. Draft and published statuses match server results.
2. **Clarity:** Every primary action has a clear result (saving, saved, published, waiting, failed, or retry). Empty and error states explain the next step.
3. **Responsiveness:** No whole-document horizontal scroll at 320, 390, 430, 820, 1024, and 1440px; intentional internal tables or tab strips may scroll. Visible iPhone text fields are at least 16px, useful touch targets at least 44px; safe areas and long labels remain usable.
4. **Accessibility:** Keyboard focus visible, Skip to main content works, mobile menu is reachable/closable, dialogs are operable, controls keep meaningful labels, and 200% text zoom does not hide essential actions.
5. **Speed:** For each investigated page or function, record request count, p50/p90 response time, loading-state behavior, and repeat behavior. Distinguish cold starts, backend latency, and perceived load. Do not declare a fix without before/after data.
6. **Visual harmony:** Compare headings, body text, cards, button hierarchy, form labels, loading/error states, navigation, and spacing against `STYLE-GUIDE.md`, without unnecessary redesign.

## Role scenarios

| Role | Journey to test | What good looks like |
| --- | --- | --- |
| Participant | Login → profile → My Pathway → next step → assigned course → lesson navigation → completion | Clear context/progress; correct next step; saving/completion is explicit; no lost work |
| Participant | Assigned Task Plan → details/dependencies → submit or complete permissible tasks | Prerequisites and approval states understandable; restricted actions remain restricted |
| Participant | Discernment Application → move among 8 sections → save draft → reload → submit **test-only** | Draft persists; progress understandable; submission locked intentionally; errors actionable |
| Coach | Login → My People → individual participant/coaching information | Clear role navigation; relevant records only; useful empty states |
| Regional leader | People → search/filter → individual record → course/task plan assignment → follow-up | Filters readable; stage/status/next action prominent; region permissions respected; changes confirmed |
| Regional leader | Events → invitation review / RSVP visibility | No duplicate actions; clear pending/accepted status; avoid sending live test invitations |
| National admin | Courses → Course Builder → edit/reorder → retry/conflict → preview → publish **test-only** | Correct auto-save; source data preserved; status matches server; mobile controls usable |
| National admin | Task Plans → Builder → phases/tasks/dependencies → preview → publish **test-only** | Clear draft state; touch-friendly selectors; dependency controls work without desktop-only instructions |
| National admin | Website → edit a disposable section → save draft → publish **test-only** | `Draft saved` vs `Published` vs `Unpublished edits` correct; no public production change |
| National admin | Team / roles and Events administration | Permissions respected; destructive actions explicit; navigation consistent |

## Responsive coverage

For each high-priority page, verify at **320px, 390px, 430px, 820px, 1024px, and 1440px**. At least one real **iPhone Safari** pass is required; the Playwright Chromium screenshots are supplementary, not a substitute. Test keyboard-only and 200% text zoom.

Prioritize these pages first: Login, My Pathway dashboard, Course reader, Course Builder, Task Plan Builder, People directory, Participant details, Discernment Application, Events, Website admin, Profile.

## Measurement log template

| Test / URL | Role + device | Baseline | After | Outcome | Link to evidence |
| --- | --- | --- | --- | --- | --- |
| Course admin load | National admin / desktop | p90 ~2.20s from small historical sample (not a controlled benchmark) | Pending | Not yet tested | — |
| Public content endpoint | Public content / desktop | p90 ~2.28s (14 requests, sampled) | Pending | Not yet tested | — |
| Public events endpoint | Public content / desktop | p90 ~2.31s (6 requests, sampled) | Pending | Not yet tested | — |
| Website admin mobile shell | Unauthenticated static shell / 320–430px | 0 overflow in the most recent 60-screenshot review | Pending authenticated QA | Static pass only | [PR #25](https://github.com/exitramp505/CMC-Pathway/pull/25) |

**Evidence limitation:** The existing `tests/css-responsive-screenshots.js` runs JavaScript-disabled local file shells. It cannot prove that signed-in interactions, loaded server data, rich-text editing, or iOS Safari behavior work. Record those separately.

## Sign-off / release gate

- [ ] PR tests all green; CSS output/source parity checked.
- [ ] Relevant role journeys above tested or explicitly noted as blocked.
- [ ] Mobile and desktop before/after evidence reviewed.
- [ ] No user data migrations or authorization changes hidden in visual patches.
- [ ] Production deploy ID and rollback procedure recorded.
- [ ] Publication explicitly approved and verified after release.

Never mark a step complete solely because a page compiled or an unauthenticated screenshot passed.
