-- ══════════════════════════════════════════════════════════════════════
-- Sastech Career OS — Phase 2 Schema (Portfolio & Opportunity Management)
-- Sibling to supabase-schema.sql — run this separately in Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════════

create extension if not exists vector;

-- 1. Profile (single row per user — the "resume-shaped" source of truth)
create table if not exists profile (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade default auth.uid() not null unique,
  full_name text default '',
  headline text default '',
  email text default '',
  phone text default '',
  location text default '',
  website text default '',
  linkedin_url text default '',
  github_url text default '',
  summary text default '',
  education jsonb default '[]',      -- [{school,degree,field,start_date,end_date,gpa,notes}]
  work_history jsonb default '[]',   -- [{company,title,start_date,end_date,current,description,achievements:[]}]
  skills jsonb default '[]',         -- [{name,category,level}]
  certifications jsonb default '[]', -- [{name,issuer,date,credential_url}]
  languages jsonb default '[]',
  updated_at timestamptz default now()
);

-- 2. Documents (uploaded or synced from OneDrive/Google Drive)
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade default auth.uid() not null,
  source text default 'upload' check (source in ('upload','onedrive','googledrive')),
  external_id text default '',
  external_path text default '',
  file_name text not null,
  mime_type text default '',
  storage_path text default '',
  extracted_text text default '',
  extraction_status text default 'pending' check (extraction_status in ('pending','ok','failed','unsupported')),
  doc_type text default 'other' check (doc_type in ('cv','transcript','certificate','id','cover_letter','recommendation','other')),
  size_bytes bigint default 0,
  synced_at timestamptz default now(),
  created_at timestamptz default now()
);
create unique index if not exists idx_documents_external
  on documents(user_id, source, external_id) where external_id <> '';

-- 3. Document chunks (full-text search grounding for chat + gap analysis)
create table if not exists document_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade default auth.uid() not null,
  document_id uuid references documents(id) on delete cascade not null,
  chunk_index int not null default 0,
  content text not null,
  content_tsv tsvector generated always as (to_tsvector('english', content)) stored,
  embedding vector(1536),   -- unused at MVP (plain full-text search instead); reserved so no future migration is needed
  created_at timestamptz default now()
);
create index if not exists idx_chunks_fts on document_chunks using gin(content_tsv);

-- 4. Opportunities (job/scholarship/internship tracking, status pipeline)
create table if not exists opportunities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade default auth.uid() not null,
  title text not null,
  org_name text default '',
  opportunity_type text default 'job' check (opportunity_type in ('job','internship','scholarship','grant','other')),
  source_url text default '',
  deadline date,
  location text default '',
  remote boolean default false,
  status text default 'saved' check (status in ('saved','researching','drafting','applied','interview','offer','rejected','withdrawn')),
  fetched_content text default '',
  gap_analysis jsonb default '{}',   -- {matched_skills:[], missing_skills:[], notes:''}
  notes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 5. CV versions (structured snapshots + generated exports)
create table if not exists cv_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade default auth.uid() not null,
  label text default '',
  opportunity_id uuid references opportunities(id) on delete set null,
  profile_snapshot jsonb not null,
  pdf_url text default '',
  docx_url text default '',
  is_master boolean default false,
  created_at timestamptz default now()
);

-- 6. Chat messages (assistant conversation + tool-call trace)
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade default auth.uid() not null,
  role text not null check (role in ('user','assistant','tool','system')),
  content text default '',
  tool_calls jsonb default null,
  tool_call_id text default null,
  tool_name text default null,
  created_at timestamptz default now()
);

-- 7. OAuth connections — service-role access only, never queried from the browser
create table if not exists oauth_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade default auth.uid() not null,
  provider text not null check (provider in ('onedrive','googledrive')),
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scope text default '',
  account_email text default '',
  connected_at timestamptz default now(),
  unique(user_id, provider)
);

-- ── Storage buckets ──────────────────────────────────────────────────
insert into storage.buckets (id, name, public) values ('documents', 'documents', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('cv-exports', 'cv-exports', false) on conflict (id) do nothing;

-- ── Row Level Security ──────────────────────────────────────────────
alter table profile enable row level security;
alter table documents enable row level security;
alter table document_chunks enable row level security;
alter table opportunities enable row level security;
alter table cv_versions enable row level security;
alter table chat_messages enable row level security;
alter table oauth_connections enable row level security;

create policy "Users own profile" on profile for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users own documents" on documents for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users own document_chunks" on document_chunks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users own opportunities" on opportunities for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users own cv_versions" on cv_versions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users own chat_messages" on chat_messages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users own oauth_connections" on oauth_connections for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own doc files" on storage.objects for all
  using (bucket_id in ('documents','cv-exports') and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id in ('documents','cv-exports') and (storage.foldername(name))[1] = auth.uid()::text);

-- ── Indexes ─────────────────────────────────────────────────────────
create index if not exists idx_documents_user on documents(user_id, doc_type);
create index if not exists idx_chunks_user on document_chunks(user_id, document_id);
create index if not exists idx_opportunities_user on opportunities(user_id, status);
create index if not exists idx_cv_versions_user on cv_versions(user_id, opportunity_id);
create index if not exists idx_chat_user on chat_messages(user_id, created_at);
