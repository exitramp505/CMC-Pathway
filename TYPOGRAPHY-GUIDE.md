# CMC Pathway Typography Guide

This guide is the source of truth for typography in the CMC Pathway interface. Its purpose is to keep the application readable and consistent without reducing every screen to the same visual treatment.

## Typeface

- Primary family: Montserrat
- Fallbacks: Arial, then the system sans-serif
- Use one font family throughout the interface. Hierarchy should come from size, weight, spacing, and color rather than changing typefaces.

## Approved type roles

All new interface styles must use one of the CSS variables below. Do not introduce a one-off font size when an existing role communicates the same level of importance.

| Role | Variable | Size | Use |
| --- | --- | ---: | --- |
| Micro | `--cmc-type-micro` | 10px | Short badges, compact status text, and nonessential metadata only |
| Label | `--cmc-type-label` | 12px | Eyebrows, field labels, counts, dates, and categories |
| Caption | `--cmc-type-caption` | 13px | Supporting descriptions and secondary card information |
| Small body | `--cmc-type-body-sm` | 14px | Tabs, controls, helper text, and compact paragraphs |
| Body | `--cmc-type-body` | 16px | Default reading text and primary card descriptions |
| Large body | `--cmc-type-body-lg` | 18px | Introductions and high-priority explanatory text |
| Small title | `--cmc-type-title-sm` | 21px | Stage names and compact card titles |
| Title | `--cmc-type-title` | 25px | Section subsections, modal titles, and major card headings |
| Section | `--cmc-type-section` | 34px | Primary section headings |
| Page | `--cmc-type-page` | 42–60px responsive | Standard page titles |
| Display | `--cmc-type-display` | 50–80px responsive | Rare high-impact landing or course titles |

## Readability rules

1. Ordinary reading text must never use Micro or Label sizes.
2. Micro is the absolute minimum and is reserved for very short, optional metadata that can be removed without changing a user's understanding or next action.
3. Information a user must understand uses Label (12px) or larger. Supporting explanations use Caption (13px) or larger.
4. Assignment titles, names, course titles, and event titles use Body or larger.
5. Descriptions that help someone make a decision use Caption at minimum; use Body when space permits.
6. Navigation and standard interactive controls use Small body at minimum. Very compact controls may use Caption when their surrounding context is unambiguous.
7. Mobile layouts may change wrapping and spacing, but should not reduce important text below its desktop role.
8. Avoid using all caps for sentences. Reserve it for short eyebrows, categories, and statuses.

## Weight and line height

- 600: supporting prose
- 700: standard emphasis and controls
- 800: labels and navigation
- 900: headings and critical actions
- 950: compact statuses only when additional emphasis is necessary
- Body text line height: 1.5–1.65
- Headings line height: 0.95–1.15
- Labels and badges line height: 1.1–1.3

## Spacing scale

Typography and spacing must follow the same rhythm. Use these variables instead of inventing a new gap or padding value for each component.

| Step | Variable | Size | Typical use |
| --- | --- | ---: | --- |
| 1 | `--cmc-space-1` | 4px | Tight label-to-value spacing |
| 2 | `--cmc-space-2` | 8px | Related inline elements |
| 3 | `--cmc-space-3` | 12px | Compact card content and list gaps |
| 4 | `--cmc-space-4` | 16px | Standard internal spacing |
| 5 | `--cmc-space-5` | 24px | Card padding and grouped sections |
| 6 | `--cmc-space-6` | 32px | Major card padding and section separation |
| 7 | `--cmc-space-7` | 48px | Page section separation |
| 8 | `--cmc-space-8` | 64px | Large page transitions only |

Use the smaller value when two elements belong together and the larger value when they represent a change in subject or task.

## Reading width

Long lines weaken readability even when the font size is correct. Text containers should use one of these measures:

| Measure | Variable | Width | Use |
| --- | --- | ---: | --- |
| Compact | `--cmc-measure-compact` | 48 characters | Helper text, summaries, and narrow cards |
| Reading | `--cmc-measure-reading` | 68 characters | Standard paragraphs, assignment descriptions, and form guidance |
| Wide | `--cmc-measure-wide` | 80 characters | Tables, reports, and layouts that genuinely need more width |

Do not stretch ordinary paragraphs across the full width of a large desktop card.

## Hierarchy patterns

### Standard page header

- Eyebrow: Label
- Page title: Page
- Introductory sentence: Body or Large body

### Standard section

- Optional eyebrow: Label
- Section heading: Section
- Supporting sentence: Body small or Body

### Cards and list items

- Category or status: Micro or Label
- Title: Body or Small title
- Description: Caption or Body
- Secondary metadata: Label

### Forms and assessments

- Field label: Body small
- Input text: Body
- Helper or validation text: Caption
- Question text: Body large or Small title
- Button text: Body small or Body

## Responsive behavior

- Preserve the assigned role on mobile instead of shrinking it to make a desktop layout fit.
- Reflow columns, stack controls, or shorten optional copy before reducing type.
- Page and Display roles scale through their approved `clamp()` values. Other roles remain stable across breakpoints.
- A mobile layout should never require horizontal scrolling to preserve a heading.

## Duplication and hierarchy

Do not stack an eyebrow and heading that repeat the same word or idea. For example, use one heading that says “Assigned work,” not an eyebrow saying “Assigned work” followed by a heading saying “Assigned.” Eyebrows should add context, not repeat it.

## Implementation rule

Typography variables are defined on `.cmcPathwayBody` in `style.css`. New or revised components should reference those variables directly. Existing components should be moved to the scale whenever they are touched, with priority given to participant-facing reading text and leader workflow controls.
