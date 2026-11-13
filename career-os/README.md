# Career OS

A personal, single-user career workspace: a structured profile, a document vault, and an AI assistant that can answer "do I have what this application needs?" for any scholarship, job or internship link.

Next.js 16 (App Router, `src/`) | React 19 | TypeScript | Tailwind CSS v4 | Motion | Supabase (Postgres + RLS + Storage) | OpenRouter | Serper

| Screen | What it does |
|---|---|
| Assistant | Chat that reads and updates your profile and tracked opportunities through tool calls |
| Profile | Structured editor: education, work history, skills, certifications, languages |
| Documents | Upload PDF/DOCX; text is extracted and chunked so the assistant can search it |
| CV | Generate a PDF or Word CV from the profile, optionally tailored to one opportunity |
| Opportunities | Track postings, fetch the page, get an LLM gap analysis against your profile |

Status: phases 0-4 are built. OneDrive sync, the Google Drive picker and the public portfolio site are planned. Nothing is deployed yet, and everything so far has only been exercised against placeholder credentials.

## Run it

```bash
npm install
cp .env.example .env.local   # real values for a real run; placeholders are enough to explore the UI
npm run dev                  # http://localhost:3000
```

Database: run `../supabase-schema-career-os.sql` in a Supabase project, create one user under Authentication, and set that user's UUID as `APP_USER_ID`.

## More

- Current state, architecture, file map, backlog: [`../docs/career-os/HANDOFF.md`](../docs/career-os/HANDOFF.md)
- Approved plan: [`../docs/career-os/PLAN.md`](../docs/career-os/PLAN.md)
- Conventions for AI agents working in this repo: [`../CLAUDE.md`](../CLAUDE.md) and [`AGENTS.md`](AGENTS.md)
