# sastech-content-engine

Two independent apps share this repo. Each is its own Vercel project.

| App | Location | Stack | Rule |
|---|---|---|---|
| Content-engine dashboard (original) | repo root: `index.html`, `api/*.js`, `supabase-schema.sql` | vanilla HTML + Vercel serverless functions, no build step | Live. **Do not modify**, except the single "Career OS" sidebar link in `index.html`. Its "Jarvis/orchestrator" layer is mostly stubbed (see `docs/`); verify before trusting any of it. |
| **Career OS** (active work) | `career-os/` | Next.js 16 (App Router, `src/`), React 19, TypeScript, Tailwind v4, Motion, Supabase, OpenRouter | Phases 0-4 built. **Not deployed.** Only ever tested against fake credentials. |

Active branch: `career-os`. `master` is deliberately untouched until the real Vercel URL replaces the placeholder link in `index.html` and code + security review are done.

## Start here

1. `docs/career-os/HANDOFF.md` - current state, architecture, file map, verified-vs-unverified table, backlog, next steps. **Read this first.**
2. `docs/career-os/PLAN.md` - the approved plan (condensed; paths normalized to the real `career-os/src/...` layout, plus a "deviations as built" list at the end).
3. `career-os/AGENTS.md` - Next 16 has breaking changes vs. older versions. Read the relevant guide in `career-os/node_modules/next/dist/docs/` before writing Next.js code.

Treat the handoff as claims to spot-check (`git log`, `git status`, `career-os/package.json`), not as ground truth.

## Commands (run from `career-os/`)

`npm install` | `npm run dev` (port 3000) | `npm run build` (type-checks; run after every phase; passes on a clean checkout) | `npm run lint` (**currently fails**: 8 errors + 3 warnings on a clean install, table in HANDOFF section 15)

`.claude/launch.json` defines a `career-os` dev server for the preview tools. Copy `career-os/.env.example` to `career-os/.env.local`; fake values are fine for UI work.

## Code rules (learned the hard way, do not regress)

- Every browser-side Supabase call goes through `safeQuery()` in `src/lib/supabaseClient.ts`. supabase-js *throws* on network failure instead of returning `{error}`; an unguarded call leaves the page stuck on "Loading...".
- Browser -> Supabase directly for CRUD (RLS is the security boundary). `src/app/api/*/route.ts` only for secrets, the service-role key, or heavy server deps, and every route calls `requireAuth()` first.
- Auth is a self-issued JWT kept in `localStorage` (key `career_os_token`), signed with Supabase's JWT secret so `auth.uid()` resolves under RLS. It is not Supabase Auth and not cookies/middleware. `user_id` columns default to `auth.uid()`.
- `server-only` throws when imported outside Next. Keep pure logic (`src/lib/cvTemplate.ts`) separate from Supabase orchestration (`src/lib/cvBuilder.ts`) so it stays testable with `npx tsx`.
- Import motion from `motion/react`. Keep `<Toaster position="top-center">` (bottom toasts blocked the chat input). Pages using `useSearchParams` need a `<Suspense>` wrapper.
- Never commit `.env*` (except `.env.example`) or real credentials. The owner supplies real keys later.

## UI work

Design skills are mandatory per screen: `design-taste-frontend` (direction), `emil-design-eng` + `animate` (motion: transform/opacity only, `cubic-bezier(0.23,1,0.32,1)`, under 300ms, honour reduced motion, no animation on 100+/day actions), `ask-sonner` (toasts). `pick-ui-library` is user-invocable only (`disable-model-invocation`). Dark-first tokens live in `src/app/globals.css`. Skills are git-ignored (third-party content); reinstall with the commands in HANDOFF section 10.

## Verifying

Build, then check pages through `document.body.innerText` (screenshots can show stale frames). Verify typed input through `.value`; `read_page` shows the placeholder instead. State plainly what is unverified.

## Working agreement

Work phase by phase. End each phase with: what was built, bugs found and fixed, verified vs. not verified, then ask whether to continue. Do not commit, push, merge to `master`, or deploy unless asked. Run code review and a security review before merging anything touching auth or uploads.
