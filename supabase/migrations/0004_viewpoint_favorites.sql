-- Per-user favorites. Used today to highlight pins on the map; later as the
-- watchlist for proximity alerts on native builds.

create table if not exists public.viewpoint_favorites (
  user_id      uuid not null references public.profiles(id) on delete cascade,
  viewpoint_id uuid not null references public.viewpoints(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (user_id, viewpoint_id)
);

create index if not exists viewpoint_favorites_user_idx
  on public.viewpoint_favorites (user_id);

alter table public.viewpoint_favorites enable row level security;

-- Public read so the count of favorites per viewpoint is queryable later
-- (e.g., "trending viewpoints"). Sensitive details aren't here.
create policy "viewpoint_favorites: public read"
  on public.viewpoint_favorites for select using (true);

create policy "viewpoint_favorites: insert own"
  on public.viewpoint_favorites for insert
  with check (auth.uid() = user_id);

create policy "viewpoint_favorites: delete own"
  on public.viewpoint_favorites for delete
  using (auth.uid() = user_id);

notify pgrst, 'reload schema';
