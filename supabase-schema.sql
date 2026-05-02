-- ══════════════════════════════════════════════════════════════════════
-- Sastech Content Engine — Supabase Schema
-- Run this in Supabase SQL Editor → New Query → Run
-- ══════════════════════════════════════════════════════════════════════

-- 1. Brand / user settings
create table if not exists brand_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  company_name text default 'Sastech Consults',
  owner_name text default '',
  phone text default '',
  email text default '',
  social_handle text default '',
  website text default '',
  tone_preset text default 'authentic',
  custom_instructions text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id)
);

-- 2. Generated content (posts, blogs, scripts, outreach)
create table if not exists generated_content (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  content_type text not null check (content_type in ('post','blog','video','outreach')),
  platform text default '',
  title text default '',
  body text not null,
  image_url text default '',
  image_prompt text default '',
  meta jsonb default '{}',
  is_favorite boolean default false,
  created_at timestamptz default now()
);

-- 3. Prospects / leads
create table if not exists prospects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  company text default '',
  email text default '',
  phone text default '',
  linkedin_url text default '',
  source text default 'manual',
  status text default 'new' check (status in ('new','contacted','responded','client','lost')),
  notes text default '',
  created_at timestamptz default now()
);

-- 4. Content pipeline / ideas
create table if not exists content_ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  text text not null,
  platform text default '',
  status text default 'idea' check (status in ('idea','draft','published')),
  created_at timestamptz default now()
);

-- 5. Portfolio projects
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text default '',
  stack text default '',
  status text default 'building',
  project_type text default 'Project',
  created_at timestamptz default now()
);

-- ── Row Level Security ──────────────────────────────────────────────
alter table brand_settings enable row level security;
alter table generated_content enable row level security;
alter table prospects enable row level security;
alter table content_ideas enable row level security;
alter table projects enable row level security;

-- Users can only access their own rows
create policy "Users own brand_settings" on brand_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users own generated_content" on generated_content
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users own prospects" on prospects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users own content_ideas" on content_ideas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users own projects" on projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Indexes ─────────────────────────────────────────────────────────
create index if not exists idx_content_user on generated_content(user_id, created_at desc);
create index if not exists idx_prospects_user on prospects(user_id, status);
create index if not exists idx_ideas_user on content_ideas(user_id, status);
create index if not exists idx_projects_user on projects(user_id);
