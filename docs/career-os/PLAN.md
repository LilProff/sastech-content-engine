# Career OS - approved plan (condensed snapshot)

> Condensed snapshot of the approved plan, rebuilt into the repo at handoff time. The original lived in a local Claude plan file that did not survive the move to another machine/account. Changes from the original: the obsolete Phase 0 revert steps and the embedded SQL listing are replaced by pointers, paths are normalized to the real layout (`career-os/src/app/...`, `career-os/src/lib/...`), and a "deviations as built" section is appended. Status at handoff: **Phases 0-4 built, Phases 5-7 not.** Current state lives in [HANDOFF.md](HANDOFF.md).

## Context

`sastech-content-engine` is a working content/lead-gen PWA for the "Sastech Consults" brand. AI Post Writer, Blog Editor, Video Scripts, Content Pipeline and Lead Finder/Outreach are real and stay untouched. Two docs (`docs/implementation_plan.md`, `docs/stack_guide.md`) describe a "Jarvis" vision (auto-updating CV/portfolio, job applicator, content publisher) that was never built: `orchestrator/*.py` nodes return hardcoded strings, the webhook dispatch in `api/orchestrator.js` is commented out, and the Memory tab's "autonomous agent" logs are `setTimeout`-staged UI theater.

The actual problem: the owner regularly gets sent links to apply for scholarships, jobs and internships and does not have the right document or up-to-date info ready each time. This phase builds the real thing: a document-grounded assistant that knows the full profile and history, can be updated by chatting, keeps a structured CV current and exportable, and helps prepare (not auto-submit) tailored applications. A live public portfolio site reads from the same data.

This supersedes `docs/implementation_plan.md` / `stack_guide.md` (the React/FastAPI/LangGraph vision), and also this plan's own first draft, which kept Career OS inside the vanilla `index.html`. That version (Phase 0) worked but the owner rejected the whole approach after two design/animation skill packs were installed (`emilkowalski/skills`, `leonxlnx/taste-skill`). Career OS became a real React/Next.js app, separate from the old dashboard.

### Locked decisions (made by the owner)

- OneDrive **and** Google Drive both get integrated.
- Chat **and** structured tabs both ship (not either/or).
- CV is structured data in-app, exported to PDF/DOCX.
- Portfolio site is a fresh build served at a Vercel URL for now (no custom domain).
- Google Drive starts with the picker-based `drive.file` scope (no Google app verification, connection never expires) rather than full `drive.readonly` folder sync (restricted-scope verification; unverified tokens expire every 7 days).
- OneDrive gets delegated `Files.Read` + delta-query folder sync (Microsoft personal-account consent does not carry that verification burden).
- Career OS is a **separate Next.js app** (`career-os/`, its own Vercel project). The old dashboard (`index.html` + `api/*.js`) stays unchanged apart from one sidebar link.

### Explicit non-goals

- No autonomous submission of applications to external sites (credential / bot-detection risk). Career OS prepares tailored materials for the owner to review and submit.
- No migrating the existing content-engine tabs off `localStorage`.
- No opportunity/relationship CRM (client / founder / employer outreach). That is the owner's stated *next* phase.

## Architecture

**Two Vercel projects, one Git repo.** The existing zero-build app stays deployed from the repo root as its own project (`sastech-content-engine`, unchanged). Career OS is a Next.js app in `career-os/`, deployed as a second, independent project with **Root Directory = `career-os`**. They share nothing at deploy time except, by choice, the same Supabase project's credentials entered separately into each project's settings. The old project redeploys on every push, which is harmless (no build step).

Dashboard steps for the second project (after `career-os/` is pushed): Add New > Project > Import the same repo > Edit Root Directory > `career-os` > name `sastech-career-os` > add env vars > Deploy.

**Stack**: Next.js (App Router), TypeScript, Tailwind CSS v4, Motion (`motion/react`, not the legacy `framer-motion` path).

**Auth**: password -> `jsonwebtoken`-signed token `{sub: APP_USER_ID, role: 'authenticated'}`, signed with Supabase's own JWT secret so `auth.uid()` resolves under RLS as if Supabase Auth had issued it.
- `career-os/src/app/api/auth-login/route.ts`: timing-safe password compare, `expiresIn: '30d'`.
- Token lives in `localStorage` (not a cookie / `middleware.ts`) deliberately: the browser Supabase client must read the raw JWT to attach `Authorization: Bearer`, which an httpOnly cookie would hide. Gating is client-side; **RLS + per-route JWT verification is the real security boundary.**
- `career-os/src/app/(authed)/layout.tsx` wraps the authed routes with the login gate. `career-os/src/app/site/**` (Phase 7) sits outside it, public by design.
- `src/lib/supabaseClient.ts` (browser client, token from `localStorage`), `src/lib/supabaseAdmin.ts` (service role, server-only), `src/lib/auth.ts` (`requireAuth(request)` wrapping `jsonwebtoken.verify`).

**Data access boundary**: ordinary CRUD (profile, document metadata, opportunities, chat history) goes browser -> Supabase directly, protected by RLS. `src/app/api/*/route.ts` is reserved for anything needing a secret (OpenRouter, Serper, OAuth client secrets, the service-role key) or a server-only npm dependency (PDF/DOCX/text extraction). Every such route verifies the caller's JWT via `requireAuth()` first. `oauth_connections` is **service-role-only, always**.

**Public portfolio site** = routes under `src/app/site/**` that query Supabase per request and render live. Mark them `export const dynamic = 'force-dynamic'` explicitly, otherwise App Router may statically render and freeze content at build time.

**Design-skill usage is mandatory per screen**: `design-taste-frontend` for visual direction (weight it most on the Assistant chat and the public site); `emil-design-eng` and `animate` for interaction craft and motion (hard "should this animate at all" gate, frequency tiers, transform/opacity only, curve/duration tables); `pick-ui-library` for component/toast/state decisions at implementation time. `emil-design-eng`'s SKILL.md has a stale `framer-motion` import sample: install `motion`, import from `motion/react`.

## Data model

Authoritative file: [`supabase-schema-career-os.sql`](../../supabase-schema-career-os.sql) (backend-agnostic SQL; not yet run against any Supabase project). Seven tables, all RLS-protected with `auth.uid() = user_id`:

| Table | Purpose |
|---|---|
| `profile` | One row per user: contact fields + jsonb arrays `education`, `work_history`, `skills`, `certifications`, `languages` |
| `documents` | Uploaded/synced files: `source` (upload/onedrive/googledrive), `extracted_text`, `extraction_status`, `doc_type`, unique index on `(user_id, source, external_id)` |
| `document_chunks` | ~800-char chunks with a generated `tsvector` (GIN index) for full-text search; `embedding vector(1536)` reserved, unused |
| `opportunities` | Jobs/internships/scholarships/grants with `status` pipeline, `fetched_content`, `gap_analysis` jsonb `{matched_skills, missing_skills, notes}` |
| `cv_versions` | Generated CVs: profile snapshot, `pdf_url`, `docx_url`, optional `opportunity_id` |
| `chat_messages` | Assistant history incl. tool calls (`role` user/assistant/tool/system) |
| `oauth_connections` | OneDrive/Google tokens, service-role access only |

Plus private storage buckets `documents` and `cv-exports`, and a storage policy keyed on the first path segment equalling `auth.uid()`.

**Why full-text search, not embeddings, for `search_documents`**: at single-user scale, `content_tsv @@ plainto_tsquery(...)` is instant and free. The `embedding` column is reserved so ANN search later needs no migration.

## Backend routes (`career-os/src/app/api/**/route.ts`)

- `documents-extract`: body `{documentId}` only (the browser uploads straight to Storage first). Downloads, extracts text by mime type (`unpdf` for PDF, `mammoth` for DOCX), chunks into `document_chunks`, updates `extraction_status`. Known gap: scanned/image-only PDFs yield empty text.
- `cv-export`: `{format, opportunityId?}`. Snapshots the profile into `cv_versions`, builds the file (`docx` and `pdf-lib`, pure JS, no headless Chromium), uploads to `cv-exports`, returns a URL.
- `lib/openrouter.ts`: free-model fallback loop (try each model, skip to the next on 429/402/error), reused by the assistant and gap analysis.
- `assistant-chat`: `requireAuth()` -> load recent `chat_messages` -> OpenRouter with `tools` -> execute `tool_calls` against Supabase (service role, scoped to the verified user) -> append `role:'tool'` results -> loop (cap ~6) -> persist every turn -> return the final message. Models: `openrouter/free` primary, `qwen/qwen3-coder:free` fallback (free-tier availability is volatile; re-check).
  - Tools: `get_profile`, `update_profile` (additive on array fields), `search_documents`, `list_opportunities`, `create_opportunity`, `update_opportunity`, `generate_cv`, `log_memory` (a tagged `chat_messages` row, no separate memories table).
- `scrape-url` + `gap-analysis` (Phase 4): Serper's `scrape.serper.dev` for the posting, then an LLM comparison against the profile. Cannot import the old app's `api/scrape.js` (separate Vercel project), so it is reimplemented.
- **OneDrive (Phase 5, not built)**: `onedrive-auth-start` (Microsoft identity platform, `/consumers` endpoint, scopes `openid profile offline_access Files.Read User.Read`, PKCE, `state` carries the user's JWT) -> `onedrive-auth-callback` (exchange code, verify state, upsert `oauth_connections`) -> `onedrive-sync` (Graph delta query `/me/drive/root/delta`, download new/changed files to Storage, upsert `documents`, call extraction). **Needs an Azure app registration** (external, one-time; redirect URI on the Career OS Vercel domain).
- **Google Drive (Phase 6, not built)**: no server-side OAuth. A client component loads Google Identity Services + the Picker API, `drive.file` scope; the browser downloads picked files and uploads them to Storage along the same path as manual upload. **Needs a Google Cloud OAuth client ID** (external, one-time, no verification at this scope).
- **Public site (Phase 7, not built)**: `src/app/site/page.tsx`, `src/app/site/projects/[slug]/page.tsx`, both `force-dynamic`, anon-key queries. **Portfolio-projects data source is decided at Phase 7**: the old dashboard's Portfolio tab can no longer feed it (old app stays untouched), so Career OS grows its own lightweight portfolio-projects model.

## Frontend

Scaffolded with `npx create-next-app@latest career-os --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm`. Authed screens under `src/app/(authed)/{assistant,profile,documents,cv,opportunities}`; every new screen goes through the design skills above. Component libraries are added when a screen needs one, not speculatively.

## Phased delivery

| Phase | Scope | Blocked on external setup? | Status |
|---|---|---|---|
| 0 Foundation | scaffold, auth gate, shell, one link added to the old dashboard | Supabase project + `auth.users` row + 2nd Vercel project (still outstanding) | built (against fake creds) |
| 1 Profile + Documents | profile editor, upload + extraction | no | built |
| 2 Assistant chat | `lib/openrouter.ts`, `assistant-chat`, chat UI | no | built |
| 3 CV export | `cvTemplate.ts` / `cvBuilder.ts`, `cv-export`, CV page | no | built |
| 4 Opportunities + gap analysis | tracker UI, `scrape-url`, `gap-analysis`, CV tailoring handoff | no | built |
| 5 OneDrive | Azure registration, OAuth routes, delta sync | **yes** (Azure app registration) | not started |
| 6 Google Drive | Google Cloud OAuth client, Picker flow | **yes** (OAuth client, no verification at `drive.file`) | not started |
| 7 Public portfolio site | `site/**`, own portfolio-projects model, light mode | no | not started |

Phases 1-4 deliver the full "chat with it, it knows my documents, it drafts my CV, it tracks opportunities" value with no OAuth dependency. Phases 5-7 are additive.

## Verification checklist (per phase)

- **0**: old dashboard unchanged apart from the one link; password gate appears, correct password signs in, wrong one is rejected, session survives refresh, and a direct `sb.from('profile').select()` fails before login and succeeds after (proves RLS keys off the minted JWT).
- **1**: edit profile fields, reload, confirm persistence. Upload a real PDF and DOCX; `extraction_status` reaches `ok` and `extracted_text` is non-empty.
- **2**: tell the assistant "I just finished a project using LangGraph for a logistics client"; confirm a `work_history`/`skills` update lands on the Profile page via a tool call, not just a chat reply.
- **3**: generate PDF and DOCX, open both, confirm content matches the profile.
- **4**: create an opportunity, paste a real posting URL, run gap analysis, confirm the output references real skills/history rather than generic filler.
- **5/6**: connect each provider, import one real file from each, confirm it appears in Documents with extracted text.
- **7**: open `/site` logged out/incognito, confirm current profile/projects render without auth; edit in-app, reload `/site`, confirm the change is live with no redeploy.

**None of these have been run against a real Supabase project yet.** Phases 0-4 were verified only up to the expected external-service failure with placeholder credentials (plus direct tests of the pure CV builders). See HANDOFF.md.

## Deviations from this plan (as built)

1. `src/` layout, so every path in the original plan gained a `src/` segment.
2. `cvBuilder.ts` was split: `src/lib/cvTemplate.ts` (pure `buildCvDocx`/`buildCvPdf`, testable standalone) and `src/lib/cvBuilder.ts` (Supabase orchestration, `import 'server-only'`).
3. Added `safeQuery()` to `src/lib/supabaseClient.ts` and retrofitted it everywhere: supabase-js throws on network failure instead of returning `{error}`.
4. Schema edit: every `user_id` column got `default auth.uid()` so client inserts need not know the user id.
5. Sonner chosen for toasts (via the `ask-sonner` skill), mounted top-center.
6. `generate_cv` was added to the assistant's tools in Phase 3 and gained `opportunity_id` in Phase 4.
7. Leftover: `src/components/PlaceholderScreen.tsx` (Phase 0 placeholder) is now unused.
