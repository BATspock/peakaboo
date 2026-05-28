-- Sighting reports — users flag content as objectionable; admin reviews
-- via the Supabase dashboard (see docs/moderation.md). No automated
-- email warnings or thresholds in v1; we manually moderate at the
-- ~100-user scale we're targeting.

create type public.report_reason as enum (
  'spam',
  'inappropriate',
  'off_topic',
  'harassment',
  'misinformation',
  'other'
);

create type public.report_status as enum (
  'pending',
  'resolved',
  'dismissed'
);

create table if not exists public.reports (
  id               uuid primary key default gen_random_uuid(),
  sighting_id      uuid not null references public.sightings(id) on delete cascade,
  reporter_user_id uuid not null references public.profiles(id) on delete cascade,
  reason           public.report_reason not null,
  notes            text,
  status           public.report_status not null default 'pending',
  created_at       timestamptz not null default now(),
  -- Same reporter cannot report the same sighting twice; RLS plus this
  -- constraint defends against double-tap submissions.
  unique (sighting_id, reporter_user_id)
);

create index if not exists reports_status_idx
  on public.reports (status, created_at desc);
create index if not exists reports_sighting_idx
  on public.reports (sighting_id);

alter table public.reports enable row level security;

-- Authed users can submit a report — only as themselves.
create policy "reports: insert own"
  on public.reports for insert
  with check (auth.uid() = reporter_user_id);

-- Reporters can see their own reports (so the UI can disable the report
-- button for sightings they've already reported, if we want that later).
create policy "reports: read own"
  on public.reports for select
  using (auth.uid() = reporter_user_id);

-- No public read policy — admin moderation happens via the Supabase
-- dashboard with the service-role key, which bypasses RLS by design.
-- This keeps reports private from the reported user.

notify pgrst, 'reload schema';
