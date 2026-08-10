# Public website management migration

The public Church Multiplication Collective website and CMC Pathway remain
separate applications, but their administration now lives in CMC Pathway.
National administrators manage public content from **Website** in the Pathway
navigation. Regional leaders and participants cannot access these controls.

## One-time setup

1. In the existing CMC Pathway Supabase project, open **SQL Editor**.
2. Run the complete contents of `supabase_public_website_content_schema.sql`.
   It creates the protected content table, a public image bucket, and seeds the
   current website content without overwriting later changes.
3. Deploy CMC Pathway so `site-content-admin`, `site-media-upload`, and
   `public-site-content` are live.
4. Deploy the public website.
5. Log in to CMC Pathway with a national administrator account, open
   **Website**, review each section, and publish it.

No additional browser-side Supabase keys are required. Drafts and publishing
use authenticated Netlify functions with the service role already configured
for CMC Pathway.

## What moved

- About page team members, photos, and photo focal points
- Resources page introduction and resource cards
- Church model cards
- Discernment Center dates, location, copy, and contact link
- Public event publishing through the existing Pathway Events area

The former `/admin` page on the public website now redirects administrators to
CMC Pathway. The old Git-backed CMS configuration has been removed.

## Publishing behavior

- **Save draft** stores work without changing the public website.
- **Publish changes** replaces the published version for that section.
- The public site refreshes managed content on a five-minute cache cycle.
- Checked-in JSON remains a read-only outage fallback, so the public site can
  still render if the Pathway content endpoint is temporarily unavailable.
- Once the Pathway event feed responds, it is authoritative for the Events
  page. Events marked public and published appear there; past events disappear
  according to the existing event feed rules.

## Media rules

Team portraits accept JPG, PNG, WebP, and AVIF files up to 4 MB. Uploads are
stored in the `cmc-public-media` Supabase bucket. The editor includes a live
square preview and horizontal/vertical focus controls.

## Optional environment overrides

The public website defaults to the production CMC Pathway endpoints. A preview
or future custom domain can override them with `CMC_PATHWAY_CONTENT_URL` and
`CMC_PATHWAY_EVENTS_URL`.
