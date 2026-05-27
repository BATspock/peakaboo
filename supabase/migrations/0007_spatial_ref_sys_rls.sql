-- Silence the Supabase linter warning about RLS not being enabled on
-- public.spatial_ref_sys.
--
-- spatial_ref_sys is a PostGIS system table created automatically when
-- the postgis extension was installed in 0001_init.sql. It contains
-- ~8,500 rows of public spatial reference definitions (WGS 84, NAD83,
-- etc.) — the same data every PostGIS install on Earth has, and which
-- you can fetch offline from libraries like pyproj. There's nothing
-- sensitive here.
--
-- Supabase's linter is blanket-paranoid about any table in the public
-- schema without RLS. The "correct" fix per Supabase docs is to move
-- PostGIS out of the public schema, but that involves uninstalling
-- and reinstalling the extension, and is overkill for a read-only
-- reference table. The pragmatic fix used by most PostGIS-on-Supabase
-- projects is to enable RLS with a permissive read policy.

alter table public.spatial_ref_sys enable row level security;

create policy "spatial_ref_sys: public read"
  on public.spatial_ref_sys
  for select
  using (true);
