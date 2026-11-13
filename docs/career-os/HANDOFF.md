# Career OS - Handoff

Written 2026-11-13, at the end of the Phase 4 build session, so a fresh Claude session (any account or machine) can resume without the owner re-explaining anything. Treat every claim here as something to spot-check against the repo (`git log`, `git status`, `career-os/package.json`), not as ground truth. Companion files: [`../../CLAUDE.md`](../../CLAUDE.md) (short rules, auto-loaded) and [`PLAN.md`](PLAN.md) (the approved plan).

Suggested first message for the new session: *"Read CLAUDE.md and docs/career-os/HANDOFF.md, spot-check them against the repo, then tell me where we are and propose the next step."*

## 1. What this is

Career OS is a personal, single-user career workspace. The owner keeps getting sent scholarship / job / internship links and never has the right documents, CV or up-to-date info ready. Career OS fixes that with:

- **Profile**: structured data (education, work history, skills, certifications, languages), editable by form.
- **Documents**: PDF/DOCX upload, text extraction, chunking, so an assistant can search them.
- **Assistant**: a chat that reads and updates the profile and tracked opportunities through tool calls ("I just finished a project with X" -> profile updated).
- **CV**: PDF and Word generated from the profile, optionally tailored to one opportunity.
- **Opportunities**: a tracker; paste a link, the page is scraped, and an LLM lists matched/missing skills against the profile.

It is a **separate Next.js app in `career-os/`** with its own Vercel project. The original vanilla-HTML content-engine dashboard (repo root: `index.html`, `api/*.js`) is intentionally untouched except for one sidebar link. Longer-term vision (the owner's words, paraphrased): an AI-assisted platform for "every aspect of life" reachable by chatting "like a friend". Explicit phase order from the owner, do not build ahead of it: (1) content system [done], (2) portfolio and opportunity management [this work], (3) opportunity/relationship management (prospective employers, clients, founders), (4) full multi-platform personal content management.

## 2. State at a glance

| Item | State |
|---|---|
| Phases 0-4 (auth shell, Profile, Documents, Assistant, CV, Opportunities) | Built |
| Phase 5 OneDrive, Phase 6 Google Drive, Phase 7 public portfolio site | **Not started** (5 and 6 are blocked on the owner registering OAuth apps) |
| Deployed | **No.** No Supabase project and no second Vercel project exist yet |
| Real credentials | **None.** `career-os/.env.local` (git-ignored) holds throwaway fake values. The owner said they will supply real ones later |
| Branch | `career-os` (based on `master` at `a079809`). `master` is deliberately untouched |
| Old dashboard changes | One added sidebar link in `index.html` pointing at a **placeholder** URL `https://sastech-career-os.vercel.app` |
| Build / lint at handoff | Build **passes** on a clean checkout (exit 0, 13 routes). Lint **fails**: 8 errors + 3 warnings, listed in section 15 |

### Verified vs. not verified (be honest about this with the owner)

Everything was exercised against `next dev` with fake env values, up to the point where the real external service would be needed.

| Feature | Verified | NOT verified |
|---|---|---|
| Login gate + JWT mint | Gate renders; correct password mints a token; wrong password rejected; shell + nav work | That Supabase's PostgREST accepts the self-signed JWT (the load-bearing assumption of the whole auth design; see section 7) |
| Profile editor | UI, add/remove list entries, responsive layout, error toasts | Save/load round trip against real Postgres + RLS |
| Documents | UI, drag/drop + picker, upload path up to the expected Supabase failure | Real PDF/DOCX -> `extracted_text` + `document_chunks`; scanned PDFs yield empty text by design |
| Assistant | UI, request path up to the expected `OPENROUTER_API_KEY is not set` error | Actual LLM tool-calling with free models (reliability unknown), tool side effects on real data |
| CV export | **`src/lib/cvTemplate.ts` was run directly** (standalone `npx tsx` script, realistic sample data): clean one-page PDF, valid OOXML DOCX, both inspected | Upload to the `cv-exports` bucket, signed URL, `cv_versions` insert on a real project |
| Opportunities + gap analysis | UI, add/status/delete paths, error handling | Serper scraping, LLM returning the strict JSON shape, quality of the analysis |
| Network-failure handling | `safeQuery()` retrofitted everywhere; all five pages load to real content or a clean error toast (checked via DOM text) | n/a |

## 3. Resume in 10 minutes

1. Open the **repo root** in Claude Code (not just `career-os/`), so the root `CLAUDE.md` loads.
2. Fresh clone? `git fetch origin && git checkout career-os`.
3. `cd career-os && npm install`.
4. `copy .env.example .env.local` (or `cp`). Placeholder values are enough for UI work; see section 6 for real ones.
5. `npm run dev` (http://localhost:3000), or use the `career-os` config in `.claude/launch.json` with the preview tools.
6. Sign in with whatever `APP_PASSWORD` you put in `.env.local`. Without real Supabase credentials every data page ends in a "Could not load ..." toast. That is expected.
7. Reinstall the design skills if the folder lacks them (section 10).
8. Note: the Next version here is 16.3.6 and `career-os/AGENTS.md` says its APIs differ from older training data. Read `career-os/node_modules/next/dist/docs/` before writing Next code.

## 4. Architecture

- **Two Vercel projects, one repo.** Root project = old dashboard (no build). Second project = `career-os/` with Root Directory `career-os`. They share nothing at deploy time except, by choice, the same Supabase credentials entered separately into each project.
- **Auth** is a self-issued JWT, not Supabase Auth: `POST /api/auth-login {password}` -> timing-safe compare against `APP_PASSWORD` -> `jwt.sign({sub: APP_USER_ID, role: 'authenticated'}, SUPABASE_JWT_SECRET, {expiresIn: '30d'})` -> `{token}`. The token is stored in `localStorage` under `career_os_token`. `getSupabaseClient()` builds a fresh client per call with `Authorization: Bearer <token>`, so RLS's `auth.uid()` resolves. Gating in the UI is client-side only; **RLS and per-route JWT verification are the real boundary.** localStorage (vs. httpOnly cookie) was a deliberate trade-off: the browser client must read the raw token.
- **Data boundary.** Ordinary CRUD goes browser -> Supabase directly, always through `safeQuery()`. `src/app/api/*/route.ts` exists only for secrets (OpenRouter, Serper, service-role key) or heavy server dependencies (`unpdf`, `mammoth`, `docx`, `pdf-lib`), and every route calls `requireAuth(request)` first.
- **`user_id` columns default to `auth.uid()`** in Postgres, so inserts need not carry a user id. Only Storage paths need it client-side (`getUserId()` decodes the JWT payload), because the storage policy matches the first path segment.
- **Storage**: private buckets `documents` and `cv-exports`; objects live under `<userId>/...`. CV links stored in `cv_versions` are 7-day signed URLs.
- **LLM**: OpenRouter via `src/lib/openrouter.ts`: tries `['openrouter/free', 'qwen/qwen3-coder:free']` in order, skipping on 429/402/error. Assistant tool loop is capped at 6 iterations, history at 30 messages, every turn persisted to `chat_messages`.
- **Search**: Postgres full-text (`tsvector` + GIN), not embeddings. The `embedding` column is reserved and unused.
- **Function timeouts** (`maxDuration`): assistant-chat 60s, documents-extract 60s, gap-analysis 45s, scrape-url 30s, cv-export 30s.
- **Routes**: `/` redirects to `/assistant`. Authed screens: `/assistant`, `/profile`, `/documents`, `/cv`, `/opportunities` (nav order as listed; sign-out clears the token).

## 5. Where the code is

Everything below is under `career-os/`. Config files (`package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`) are stock `create-next-app`.

```
src/app/
  layout.tsx                 root layout, fonts, <Toaster position="top-center">
  globals.css                design tokens (@theme inline), .animate-shake, .thinking-dot keyframes
  page.tsx                   redirect('/assistant')
  (authed)/layout.tsx        LoginGate + AppShell wrapper for all authed pages
  (authed)/assistant|profile|documents|cv|opportunities/page.tsx   thin wrappers around the components below
  api/auth-login/route.ts          password -> JWT
  api/assistant-chat/route.ts      tool-calling loop, persists chat_messages
  api/documents-extract/route.ts   PDF/DOCX -> text -> chunks (800 chars, 100 overlap)
  api/cv-export/route.ts           thin wrapper over generateAndStoreCv
  api/scrape-url/route.ts          Serper scrape of a posting
  api/gap-analysis/route.ts        scrape-if-needed + LLM JSON {matched_skills, missing_skills, notes}
src/components/
  LoginGate.tsx, AppShell.tsx      auth UI + sidebar shell (sidebar has NO mobile collapse yet)
  PlaceholderScreen.tsx            DEAD CODE (Phase 0 leftover; remove)
  ui/                              Field, Button, SectionCard, AnimatedListItem primitives
  profile/                         ProfileEditor + Education/WorkHistory/Skills/Certifications/Languages sections
  documents/                       DocumentsManager, StatusBadge
  assistant/ChatView.tsx           chat UI, MessageBubble (Motion), ThinkingIndicator (CSS), tool-used pills
  cv/CvManager.tsx                 generate buttons, history, reads ?opportunityId=
  opportunities/OpportunitiesManager.tsx   add form, status pipeline, Analyze fit, Tailor CV
src/lib/
  supabaseClient.ts          browser client, token helpers, getUserId(), safeQuery()
  supabaseAdmin.ts           service-role client ('server-only')
  auth.ts                    requireAuth(request) ('server-only')
  openrouter.ts              callOpenRouter({messages, tools, models, maxTokens})
  assistantTools.ts          ASSISTANT_TOOLS (8) + executeTool(name, args, userId)
  cvTemplate.ts              PURE buildCvDocx / buildCvPdf (no Supabase, unit-testable)
  cvBuilder.ts               generateAndStoreCv(userId, format, opportunityId?) ('server-only')
  scrape.ts                  scrapeUrl(url) via scrape.serper.dev
  types.ts                   Profile, DocumentRow, Opportunity, GapAnalysis, ...
  useListField.ts            add/update/remove hook for jsonb array fields
src/types/mammoth.d.ts       hand-written declaration (no official types exist)
```

Repo root (outside `career-os/`): `supabase-schema-career-os.sql` (schema, not yet run anywhere), `CLAUDE.md`, `docs/career-os/*`, `.claude/launch.json`, `index.html` (one link added). The assistant's 8 tools: `get_profile`, `update_profile`, `search_documents`, `list_opportunities`, `create_opportunity`, `update_opportunity`, `generate_cv`, `log_memory`.

## 6. Environment variables

Template: `career-os/.env.example`. Set the same names in the second Vercel project.

| Variable | Used by | Where to get it |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser client, admin client | Supabase > Project Settings > API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser client | same page |
| `SUPABASE_SERVICE_ROLE_KEY` | `supabaseAdmin.ts` (server only, never expose) | same page |
| `SUPABASE_JWT_SECRET` | signs tokens in `auth-login`, verifies in `auth.ts` | Supabase JWT settings ("legacy JWT secret"; see section 7 caveat) |
| `APP_USER_ID` | JWT `sub` | UUID of the one `auth.users` row you create by hand |
| `APP_PASSWORD` | `auth-login` | choose a long random one |
| `OPENROUTER_API_KEY` | `openrouter.ts` | openrouter.ai (free key) |
| `SERPER_API_KEY` | `scrape.ts` | serper.dev (free tier, 2,500 searches) |

Phase 5/6 will add Microsoft and Google client IDs/secrets (names decided at build time).

## 7. Database setup (not done yet)

1. Create a Supabase project. In the SQL editor run `supabase-schema-career-os.sql` (7 tables, RLS, 2 private buckets, indexes; it enables the `vector` extension).
2. Authentication > Users > Add user (any email/password). Copy its UUID into `APP_USER_ID`. The schema's `user_id` foreign keys require this row to exist.
3. Fill the env vars from section 6.

**Load-bearing risk to check first.** The auth design assumes PostgREST accepts an HS256 token signed with the project's JWT secret. Supabase has been moving projects toward asymmetric JWT signing keys, so the "legacy JWT secret" may be hidden or disabled on new projects. If the first real run shows RLS rejecting the token (empty reads, 401/permission errors), stop and switch strategy rather than fighting it: keep a single Supabase Auth email+password user, call `signInWithPassword`, and use its session JWT instead of `jsonwebtoken`. Only `auth-login`, `auth.ts` and the token helpers would change. Verify current Supabase behavior before assuming either way.

## 8. What each phase built

- **0 Foundation**: scaffold, design tokens, login gate, shell, `supabaseClient/Admin`, `auth.ts`, `auth-login`. The first attempt (hand-CSS inside the old `index.html`) was rejected by the owner and reverted; only the sidebar link survived.
- **1 Profile + Documents**: full profile editor (all five jsonb sections), document upload to Storage, `documents-extract` (`unpdf`/`mammoth`, 800/100 chunking, `maxDuration` 60).
- **2 Assistant**: OpenRouter client with model fallback, 8-tool executor, tool-calling loop, chat UI with Motion entrances, CSS thinking indicator, tool-used pills.
- **3 CV**: `cvTemplate.ts` (pure builders) + `cvBuilder.ts` (orchestration) + `cv-export` + CV page with history.
- **4 Opportunities**: `scrape.ts`, `scrape-url`, `gap-analysis`, tracker UI with status pipeline, "Tailor CV" handoff via `?opportunityId=`, and the systemic `safeQuery()` fix.

## 9. Bugs found and fixed (the do-not-regress list)

1. **supabase-js throws on network failure** instead of returning `{error}` (confirmed: a raw `fetch` to a dead URL throws `TypeError: Failed to fetch` in ~260 ms). Unguarded calls left pages on "Loading..." forever. Fix: `safeQuery()` in `supabaseClient.ts`, used at every call site. Never call `sb.from(...)` or `sb.storage...` without it.
2. **Query builders are `PromiseLike`, not `Promise`**: no `.catch()`. Wrap in an async IIFE with `safeQuery` (this broke a build once).
3. **`server-only` throws outside Next**: standalone scripts cannot import files that use it. Hence the `cvTemplate.ts` / `cvBuilder.ts` split.
4. **Upsert missing `user_id`** in the profile save: solved with `default auth.uid()` on every `user_id` column.
5. **`.gitignore` swallowed `.env.example`**: the blanket `.env*` needed `!.env.example` (now in `career-os/.gitignore`).
6. **Sonner's default bottom-right toasts ate clicks on the bottom-anchored chat input.** `<Toaster position="top-center">` fixes it; keep any new bottom-anchored input in mind.
7. **Unresponsive `grid-cols-2`** forms: use `grid-cols-1 sm:grid-cols-2`.
8. **`useSearchParams()` needs `<Suspense>`** (CV page).

## 10. Design, motion and skills

- **Direction**: dark-first, deliberately distinct from the old app's cyan/violet: near-black `--background: #0c0c0b`, warm amber `--accent: #e8a33d`, Geist font, tokens in `src/app/globals.css`. Light mode is deferred until before Phase 7.
- **Mandatory per screen**: `design-taste-frontend` for visual direction; `emil-design-eng` + `animate` for motion; `ask-sonner` for toast setup; `pick-ui-library` for component choices (it sets `disable-model-invocation`, so only the owner can invoke `/pick-ui-library`; otherwise read its `SKILL.md`).
- **Motion rules in force** (from the `animate` skill): gate by frequency tier, name the purpose, cheapest tool first, `transform`/`opacity` only, import from `motion/react`, easing `cubic-bezier(0.23, 1, 0.32, 1)`, UI durations under 300 ms, honour `prefers-reduced-motion`, never `ease-in` or `scale(0)`, no animation on 100+/day actions.
- **Skills are not committed** (third-party content, absolute-path symlinks, a local path in the lock file). They live in `.agents/skills/` with symlinks in `.claude/skills/`. To restore on a clean checkout: `npx skills@latest add emilkowalski/skills` (installs `emil-design-eng`, `animate`, `ask-sonner`, `pick-ui-library`, `mobile-native`, `review-animations`, `improve-animations`, `find-animation-opportunities`, and a few unrelated ones such as `animate-expo`, `write-swift`). `design-taste-frontend` came from the owner's global install of `leonxlnx/taste-skill`; if missing, `npx skills@latest add leonxlnx/taste-skill`. A session's skill list is fixed at startup, so start a new session after installing.

## 11. How things were verified, and the traps

- After each phase: `npm run build` (type-checks every route) and a pass through the pages in the browser pane against `next dev` with the fake `.env.local`.
- **Trust DOM text over screenshots.** Screenshots sometimes showed a stale "Loading..." frame after the DOM had already resolved. Check `document.body.innerText` via `javascript_tool` before concluding a page is broken.
- **`read_page`'s textbox line shows the placeholder, not the typed value.** Check `document.querySelector('textarea').value`.
- **Do not use `resize_window` with custom width/height**: clicks silently landed on nothing. Use the `mobile`/`tablet`/`desktop` presets and reset to `desktop`.
- Pure logic can be tested outside Next with `npx tsx` (that is how the CV builders were verified). Anything importing `server-only` cannot.
- **This repo sits inside a OneDrive-synced folder.** At handoff time `next build` failed *inside* that folder with `Error: UNKNOWN: unknown error, read (errno -4094)` while node read its own CLI entry file: an environment problem, not a code problem (see section 15 for what was verified instead). If you hit it, build from a clone outside OneDrive, or run `attrib +P /s /d` on `career-os\node_modules` to keep it local. Cloning outside OneDrive is the better fix.

## 12. Improvement backlog (prioritized)

**P0, before real use or merging to `master`**
1. Run the whole thing against a real Supabase project (section 13A). Nothing here is proven end to end.
2. Resolve the JWT-signing question (section 7).
3. Code review plus security review (auth, service-role routes, uploads, signed URLs) before merging; the owner's global rules require it for auth/PII code.
4. Brute-force protection on `/api/auth-login` (rate limit or Vercel Firewall rule) and a long random `APP_PASSWORD`.
5. Replace the placeholder URL in `index.html` with the real Vercel domain, or drop the link. An unclaimed `*.vercel.app` name can be registered by anyone, so confirm it is the owner's before merging.

**P1**
6. Make `npm run lint` pass on a clean install: 8 errors + 3 warnings, table in section 15. Not a deploy blocker (the Next 16 build output has no lint step), but it is the repo's quality gate.
7. Mobile nav for `AppShell` (fixed `w-56` sidebar, no collapse). Use the `mobile-native` skill.
8. Automated tests: there is no test runner. Add Vitest; first targets: `cvTemplate.ts`, `safeQuery`, chunking in `documents-extract`, `executeTool`, gap-analysis JSON parsing.
9. CV history links die after 7 days (signed URLs stored in the DB). Store storage paths and sign on demand, or add a regenerate endpoint.
10. Scanned/image-only PDFs extract to empty text. Add OCR or surface a clear "unsupported" state.
11. Assistant reliability: verify tool-calling with the free models, choose a paid fallback, validate tool arguments, add basic evals.
12. Delete dead `src/components/PlaceholderScreen.tsx`.

**P2**
13. Light mode (before Phase 7). 14. Streaming assistant replies. 15. More upload types (txt/md/images). 16. The old dashboard's "Autonomous Agents" panel and `orchestrator/*` are stubs/UI theater; the owner decides whether to label or remove them.

## 13. Next steps

**A. First real run** (the owner supplies credentials; never ask them to paste secrets into chat and never commit them)
1. Section 7 setup, then fill `career-os/.env.local`, `npm run dev`, sign in.
2. Profile: fill it in, save, reload, confirm it persists. Confirm an unauthenticated `sb.from('profile').select()` returns nothing (RLS) and an authenticated one returns the row.
3. Documents: upload one real PDF and one real DOCX; status should go pending -> ok; check `document_chunks` rows exist.
4. Assistant: say "I just finished a project using LangGraph for a logistics client". Expect an `update_profile` tool call and a new entry on the Profile page. If the free models do not call tools reliably, change the model list in `openrouter.ts` defaults.
5. CV: generate PDF and Word, download via the signed URL, open both.
6. Opportunities: add one with a real posting URL, run "Analyze fit", check that matched/missing skills reflect the actual profile.

**B. Deploy**: create the second Vercel project (Root Directory `career-os`, same env vars), fix the `index.html` link, run reviews, then merge `career-os` into `master`. Opening a PR for the branch is the natural route.

**C. Phase 5, OneDrive** (needs the owner): Azure portal > App registrations > new registration supporting personal Microsoft accounts, a Web redirect URI at `<career-os domain>/api/onedrive-auth-callback` (plus a localhost one for dev), a client secret, delegated permissions `Files.Read`, `User.Read`, `offline_access`. Then build `onedrive-auth-start`, `onedrive-auth-callback`, `onedrive-sync` per `PLAN.md` (consumers endpoint, PKCE, `state` carries the user's JWT, delta query, tokens in `oauth_connections` via service role only). Check the current Azure UI; steps drift.

**D. Phase 6, Google Drive** (needs the owner): Google Cloud project, enable Drive API and Picker API, OAuth consent screen in Testing with the owner as test user, Web OAuth client ID with the localhost and production JS origins, an API key restricted to Picker. Client-side Identity Services + Picker with the `drive.file` scope; picked files upload through the same path as manual upload. No server OAuth route.

**E. Phase 7, public portfolio**: `src/app/site/**` with `export const dynamic = 'force-dynamic'`, anon-key reads, and a new portfolio-projects data model (decide at that phase; the old dashboard's Portfolio tab cannot feed it). Do light mode first. Run `design-taste-frontend` hard: this is the external-facing surface.

## 14. Working agreement with the owner

- Phase by phase, explicit "continue" between phases. Close each phase with: what was built, bugs found and fixed, verified vs. not verified, then ask whether to continue.
- They rejected a hand-written-CSS vanilla UI outright and asked for a real React/Next.js build driven by the design skills. Do not regress to placeholder-looking UI.
- Be candid about what is unverified. Report test failures with output; do not hedge things that are verified.
- Credentials arrive later from the owner. Test against placeholders and say so.
- Do not commit, push, merge to `master`, or deploy unless asked.
- Skill routing in their global rules: brainstorming/writing-plans for new features, systematic-debugging for bugs, verification-before-completion before declaring done, requesting-code-review and a security review before merging.

## 15. Build and lint at handoff

Verified 2026-11-13 from a **clean clone of this branch outside OneDrive** (`git clone`, `npm ci`, no `.env.local`):

- `npm run build`: **passes** (exit 0). Next.js 16.3.6 (Turbopack) compiled, type-checked and generated 15 pages. All 13 routes registered: `/`, `/_not-found`, `/assistant`, `/cv`, `/documents`, `/opportunities`, `/profile` (static) and `/api/assistant-chat`, `/api/auth-login`, `/api/cv-export`, `/api/documents-extract`, `/api/gap-analysis`, `/api/scrape-url` (dynamic). The build needs no env vars.
- `npm run lint`: **fails with 11 problems (8 errors, 3 warnings)** on the pinned toolchain (`eslint` 9.39.5, `eslint-config-next` 16.3.6, `eslint-plugin-react-hooks` 7.1.1). The Next 16 build output has no lint step, so deploys are unaffected, but a lint gate would fail. All of it is code from phases 1-4:

| File:line | Rule | Fix direction |
|---|---|---|
| `src/app/(authed)/layout.tsx:12` | `react-hooks/set-state-in-effect` | read the token without an effect, e.g. `useSyncExternalStore` over localStorage (server snapshot `'checking'` to avoid a hydration mismatch) |
| `src/components/assistant/ChatView.tsx:166` | `react-hooks/refs` | `isInitialLoad.current` is read during render for the stagger delay; derive it from state instead |
| `src/components/cv/CvManager.tsx:28` and `:57` | `react-hooks/set-state-in-effect` | derive `opportunityTitle` instead of resetting it inside the effect; load history without a synchronous setState path |
| `src/components/documents/DocumentsManager.tsx:55` | `react-hooks/set-state-in-effect` | fetch-on-mount effect |
| `src/components/opportunities/OpportunitiesManager.tsx:61` | `react-hooks/set-state-in-effect` | fetch-on-mount effect |
| `src/components/profile/ProfileEditor.tsx:146` (2 errors) | `react/no-unescaped-entities` | replace `'` with `&apos;` in the JSX text |
| `src/components/profile/ProfileEditor.tsx:49` (3 warnings) | `@typescript-eslint/no-unused-vars` | the `_id`, `_userId`, `_updatedAt` destructure-to-omit in `handleSave`; use an omit helper or an ignore pattern |

The fetch-on-mount flags may partly be false positives of the v7 React-Compiler rules on async loaders (their setState runs after an await). Decide per site, prefer a real fix over blanket `eslint-disable`, test the auth gate and each loader in the browser after changing them, and re-run lint on a clean install.

Caveats on the verification itself:
- An earlier `npm run lint` inside the OneDrive folder printed nothing and exited 0 even though tool versions are identical to the clean clone. Treat that run as unreliable (OneDrive cloud placeholders in `node_modules`, section 11) and trust the clean-checkout result.
- Inside the OneDrive folder `next build` itself failed with `errno -4094` while reading placeholder files, which is why the clean-clone check exists.
- `npm ci` printed many `TAR_ENTRY_ERROR ENOENT` warnings in the scratch directory (a Windows extraction-race pattern) yet exited 0 and the build passed. If a clean install misbehaves on this machine, retry it before suspecting the code.
- Runtime behavior is still unverified against real services (section 2).
