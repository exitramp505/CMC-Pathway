# CMC Pathway CSS sources

These fifteen files are the **authored CSS source**, loaded in `styles/manifest.json` order and combined into the checked-in `style.css` by `npm run build:styles`. Their ordering preserves the historical cascade and mobile overrides. **Do not link these modules individually in HTML** or add `@import` chains; this would add blocking requests and could reorder rules.

The `01-design-foundation.css` module contains the documented design tokens. Other files group the historic cascade into navigable page-family and compatibility sections. Some older styles overlap by design. Do not deduplicate selectors automatically; change those rules only after responsive visual comparison and automated checks.

Run `npm run build:styles`, then `npm run build:styles:check` and `npm test`. Commit both the edited source and compiled CSS.

See the canonical `STYLE-GUIDE.md` for the brand system and the CI visual-review workflow.
