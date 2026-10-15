# CMC Pathway — Design System & Style Guide

**Single source of truth** for participant, coach, regional-leader, administrator, course, task-plan, assessment, and account screens. Last reviewed: October 15, 2026.

This guide consolidates the former typography rules with the visual and interaction patterns already used throughout CMC Pathway. It is a **consistency standard, not a redesign brief**. The primary CMC website handles public discovery; Pathway begins at login.

## 1. Identity and design principles

The recognizable CMC experience is **warm cream + confident slate + purposeful amber + calm sage**, with Montserrat throughout. It should feel clear, generous, welcoming, and competent—never crowded or like a different product from one page to the next.

1. **Clarity first:** the next action, current progress, and any error must be immediately understandable.
2. **One system, different tasks:** participant reading can be quieter and more spacious; admin editing can be denser, but the same visual language must hold.
3. **Content before decoration:** generous but purposeful whitespace; no duplicate headings or repetitive eyebrows.
4. **Accessible by default:** readable contrast, semantic headings, keyboard focus, 44px touch targets, and forms that work at mobile width.
5. **Protect what already works:** keep the existing lesson reader, collapsed course sidebar, saved-progress cues, and role-based navigation unless a separate redesign is approved.

## 2. Canonical tokens

The variables below are defined on `.cmcPathwayBody` in `style.css`. Prefer them over new hex colors and one-off dimensions.

### Brand colors and their jobs

| Token | Value | Appropriate use |
| --- | --- | --- |
| `--cmcInk` | `#151616` | Main text and text on amber/sage backgrounds |
| `--cmcSlate` | `#293d48` | Dark panels, navigation text, prominent structure |
| `--cmcSlate2` | `#20323b` | Darker slate surfaces and depth |
| `--cmcSand` | `#fbf0de` | Main warm page background |
| `--cmcPaper` | `#fffaf1` | Light cards and reading panels |
| `--cmcEmber` | `#ea9f43` | Primary amber buttons, decorative highlights on dark surfaces |
| `--cmcEmberText` | `#935312` | Small readable amber-toned text on cream/paper |
| `--cmcSage` | `#4da79c` | Progress, positive indicators, accents, badges |
| `--cmcSageText` | `#236f68` | Readable sage-toned text on light backgrounds |
| `--cmcTextMuted` | `#607078` | Secondary body and form guidance on light backgrounds |
| `--cmcBorder` | `rgba(41,61,72,.16)` | Subtle borders on light surfaces |
| `--cmcBorderStrong` | `rgba(41,61,72,.26)` | Field and emphasized panel borders |
| `--cmcPanelSoft` | `rgba(255,250,241,.72)` | Soft raised panels above the sand background |

**Contrast rule:** cream or white text on the *bright* sage (`#4da79c`) is not sufficiently legible for ordinary text. Use **Ink on Sage** (approximately 6.3:1 contrast), or use a verified darker sage surface if white text is essential. Use **Ink on Amber** (approximately 8.2:1). On slate, use sand or tested light text. Amber eyebrows on light paper use `--cmcEmberText` (approximately 5.3:1 against sand). Never use hue alone for progress, selection, success, or error.

### Typography: one family, named roles

Primary: **Montserrat**; fallback: **Arial**, then system sans-serif. Hierarchy comes from scale, weight, spacing, and contrast—not from mixing fonts.

| Role | Variable | Size | When to use |
| --- | --- | ---: | --- |
| Micro | `--cmc-type-micro` | 10px | *Optional* short micro-metadata only; never an action or required instruction |
| Label | `--cmc-type-label` | 12px | Eyebrows, status, dates, optional data labels |
| Caption | `--cmc-type-caption` | 13px | Helpful supporting descriptions |
| Small body | `--cmc-type-body-sm` | 14px | Navigation, tabs, buttons, form labels |
| Body | `--cmc-type-body` | 16px | Inputs, reading text, lesson descriptions, primary content |
| Large body | `--cmc-type-body-lg` | 18px | Introductory paragraphs and major guidance |
| Small title | `--cmc-type-title-sm` | 21px | Card and stage titles |
| Title | `--cmc-type-title` | 25px | Section subsections and dialog headings |
| Section | `--cmc-type-section` | 34px | Major section headings |
| Page | `--cmc-type-page` | `clamp(42px,4.2vw,60px)` | Standard primary page title |
| Display | `--cmc-type-display` | `clamp(50px,6vw,80px)` | Rare hero or course display title |

**Legibility rules:**

- Normal reading, instructions, names, and course titles are **16px or larger** wherever space allows; user-critical text is never 10px.
- Labels on forms and standard actions are **14px**. Supporting descriptions are at least **13px**.
- A mobile viewport must not force smaller fonts than the desktop role. Reflow the layout instead.
- Interactive inputs, selects, and textareas are **16px minimum on iPhone** to avoid input zoom.
- Weight guide: 600 prose, 700 controls or emphasis, 800 navigation and labels, 900 headlines and primary actions; 950 only for short high-impact statuses.
- Reading line-height **1.5–1.65** (slightly more for extended lesson content); headlines **0.95–1.15**; badges **1.1–1.3**.
- Avoid all caps beyond short categories/eyebrows. Never rely on letter-spacing to compensate for undersized text.

### Spacing, widths, and radii

| Scale | Token | Value | Use |
| --- | --- | ---: | --- |
| 1 | `--cmc-space-1` | 4px | Tight label/value relationship |
| 2 | `--cmc-space-2` | 8px | Inline controls |
| 3 | `--cmc-space-3` | 12px | Compact cards |
| 4 | `--cmc-space-4` | 16px | Default interior spacing |
| 5 | `--cmc-space-5` | 24px | Card padding and related groups |
| 6 | `--cmc-space-6` | 32px | Spacious cards/section groups |
| 7 | `--cmc-space-7` | 48px | Major section separation |
| 8 | `--cmc-space-8` | 64px | Exceptional hero-to-section separation |

Reading measures: `--cmc-measure-compact:48ch`, `--cmc-measure-reading:68ch`, `--cmc-measure-wide:80ch`.

#### Shared component dimensions

| Token | Value | Purpose |
| --- | --- | --- |
| `--cmcRadiusControl` | `13px` | Inputs, buttons and compact controls |
| `--cmcRadiusCard` | `24px` | Standard cards and form surfaces |
| `--cmcRadiusHero` | `32px` | Large page and feature panels |
| `--cmcTouchTarget` | `44px` | Minimum width and height for touch actions |
| `--cmcFocusRing` | `2px solid var(--cmcSage)` | Reusable focus outline |

Use the smaller space when things belong together and a larger step when the topic changes. Keep paragraph lines within their reading measure instead of stretching text across a large dashboard card. Existing specialty hero and lesson-card radii may differ intentionally; don't override them globally.

## 3. Component language

### Global header, brand, and navigation

- Shared shell: `.cmcPathwayBody`, `.cmcHeader`, `.cmcBrand`, `.cmcLogoImage`, and `.cmcNav`.
- All authenticated roles use the same brand lockup and role-aware navigation conventions. Do not invent a second menu style for administration.
- On tablets, collapse or wrap navigation before links collide. On phones, use the existing accessible mobile toggle and menu.
- A visible keyboard **Skip to main content** link should precede the header on full pages and target `#main-content`.
- Standard navigation actions use Small body (14px) and visible active/current state. A touchable target must be at least 44×44px.

### Page headers

Use a short **eyebrow (Label)**, a singular **h1 (Page)**, and a useful **intro (Body or Large body)**. An eyebrow should explain context, not repeat the headline. Administrator pages normally use `.cmcAdminPageHero`; the participant pathway uses its existing welcoming hero.

### Surfaces, cards, and panels

- **Paper card:** `--cmcPaper`, subtle `--cmcBorder`, a calm radius near `--cmcRadiusCard`.
- **Slate focus panel:** reserve `--cmcSlate` for core pathway, progress, people lists, and strong decision/workspace sections. Text must stay readable against it.
- **Course reading:** preserve the established warm lesson card, navy/slate sidebar, clear lesson heading and summary, and collapsed-state progress. Do not transplant dense admin cards into the lesson reader.
- **Administrator builders:** preserve the distinct workspace sidebar but share form typography, button treatment, labels, gaps, and statuses.
- Keep card shadows subtle and purposeful; avoid stacked dark gradients and heavy shadows on every panel.
- When a page contains many related cards, choose one radius and border treatment for that group.

### Buttons, links, focus, and state

- **Primary:** amber background, dark ink text. Hover/focus must **retain dark ink**; do not turn the text white.
- **Secondary:** paper/light surface or restrained slate outline, readable slate text.
- **Success/progress:** sage accent, but use dark ink for words or marks printed directly on bright sage.
- Disabled and loading states must be distinguishable without changing the layout. Avoid duplicate submissions.
- Keep text actions recognizably interactive, with hover and **keyboard focus-visible** treatment.
- Focus indicator: `--cmcFocusRing`, outside the control, with sufficient contrast against its backdrop.
- Every normal tap target is at least `--cmcTouchTarget` in both dimensions. A small icon may sit inside a larger invisible target; provide a usable accessible label.
- Communicate saved, failed, selected, complete, and blocked states with text or icon plus color.

### Forms and assessments

- `.cmcFormBody` + `forms.css` are the established form/assessment extension of the same system; the form aliases resolve to the shared CMC tokens.
- Keep the shared slate introduction, paper question surfaces, 14px labels, 16px inputs, meaningful helper/error text, and large answer choices.
- Preserve the ministry-style inventory's functional most/least selections; its separate `ministry-style.css` is a legacy component sheet, **not an alternative brand palette**.
- Group related inputs; make error messages actionable and associated with fields; do not clear user-entered answers on recoverable errors.

### Lists and status

- Names, lesson titles, and assignment titles are Body (16px) or larger.
- Secondary metadata may use Label, but don't shrink action links, progress or attention states to micro sizes.
- Use clear empty, loading, error, and success states. A spinner alone is not the message.
- In tables and dense people lists, prioritize the person's name, current stage, and actionable next step; move optional fields below on mobile.

## 4. Responsive and accessible behavior

Test the *same page* in participant and admin roles. The interface may reflow, but should never feel like two brands.

| Width / mode | What to check |
| --- | --- |
| 320–390px small phone | No horizontal clipping, 16px inputs, single-column cards, reachable controls, long names wrap |
| 430px large phone | Good rhythm and touch targets; no stretched compact cards |
| 768–820px tablet | Header collapse, usable builders, no crushed navigation or two-column form labels |
| 1024px tablet / laptop | Dense people lists remain readable; panels do not compete |
| 1440px desktop | Text measure stays sensible; no full-width paragraphs |
| 200% text zoom | No clipped buttons, progress percentages, tab labels, or modal actions |
| Keyboard / reduced motion | Skip link works; focus never disappears; animations are nonessential |

Additional rules:

- Reflow grids before reducing type. `min-width:0` and `overflow-wrap` may be needed for long email addresses and headings.
- Horizontal scrolling is acceptable for genuine tables or overflowing **tab strips**, not for the whole page. Preserve visible selection and 44px tab targets.
- Maintain mobile safe-area padding on sticky action bars; avoid covering the final form control.
- Respect `prefers-reduced-motion: reduce`. Never make an animation necessary for navigation or progress.
- Contrast targets: **4.5:1 normal text**, **3:1 large text**. Recheck hover, selected, disabled, and focus states, not only default colors.

## 5. Page-family reference

| Page family | Shared structure | Deliberate distinction |
| --- | --- | --- |
| Login, signup, recovery, profile | Brand header, warm paper form, legible controls | Simple onboarding and reassurance |
| Participant dashboard and pathway | Page title, stage/progress hierarchy, readable assignment cards | Primary action and progress first |
| Discover/course reading | Slate course rail, paper lesson, reflection and video content | Restrained reading width and generous prose spacing |
| Regional people, individual record, coaching | Admin hero, slate work panels, clear status/data rows | Higher density without smaller essential type |
| Course and Task Plan builders | Shared builder shell, calm fields, save state, clear sections | Editing tools; never silently hide unsaved content |
| Events and website administration | Admin hero, paper working cards, accessible tab strips | Search, review and management actions |
| Assessments and ministry application | Form hero, distinct questions, strong progress | Focus on one decision at a time |

The page family determines layout **density**, not a new color palette, typeface, or navigation language.

## 6. Source-of-truth and contribution workflow

1. **Read this document before styling a new component.** For historical references, `TYPOGRAPHY-GUIDE.md` now points here.
2. **Use current tokens from `style.css`** under `.cmcPathwayBody`. Avoid new arbitrary colors, sizes, border radii, shadows, and special breakpoints unless needed for a real component.
3. **Respect CSS ownership:** `style.css` = shared Pathway system and app layout. `forms.css` = form/assessment layer loaded *after* `style.css`. `ministry-style.css` = legacy inventory behavior. Don't build a second, competing theme in the latter two.
4. **Prefer editing an existing scoped component rule**, not appending another override of the same selector. Legacy stylesheet history contains overlapping overrides; incremental fixes should reduce that pattern, not compound it.
5. **Keep class names scoped** (e.g., `.cmc...Body`, `.cmc...Main` or a named component). Don't apply broad `h1`, `button`, `p` changes to the whole app.
6. Update the shared CSS cache version on **all** affected HTML pages when style files change; versions must match the CSS contract tests. Avoid piecemeal cache versions.
7. Run `npm test` (including `tests/design-harmony.test.js` and `tests/design-system-contract.test.js`) and manually check the responsive table above before publishing.
8. Use a preview deploy before releasing visual changes. Verify role-based pages while signed in, including empty/error/loading states and long real-world names. Never claim live visual QA from source-only checks.
9. Avoid changes to account authorization, database schema, course data, or progress as part of a styling patch.

### Deferred, larger refactor

The main legacy stylesheet is ~9,690 lines and contains numerous repeated component selectors. Splitting it into a token layer and reviewed component files could improve long-term maintenance, but this is **not** a safe incidental formatting change. Perform it only as a dedicated project with visual-regression screenshots at all breakpoints and a controlled release. The current style-guide consolidation deliberately preserves existing layouts and the functioning cascade.
