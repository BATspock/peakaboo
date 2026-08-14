-- Public audit trail for changes to a sighting's observed_at.
--
-- Context: 0016 let users set their own observed_at, and the UI now lets the
-- owner change it after the fact. Backdating is only trustworthy if others can
-- see it happened, so every change is logged and the log is world-readable,
-- consistent with the public-by-default model in 0001.
--
-- The log is written by a trigger rather than the client, for two reasons:
--   1. The client cannot forget to write it, and cannot forge entries — there
--      is deliberately NO insert policy on this table.
--   2. It captures the true previous value from OLD, not whatever the client
--      claims the previous value was.
--
-- "Originally uploaded" needs no storage: sightings.created_at already holds
-- it and is immutable in practice. The UI just has to select it.

create table if not exists public.sighting_time_edits (
  id                   uuid primary key default gen_random_uuid(),
  sighting_id          uuid not null references public.sightings(id) on delete cascade,
  edited_by            uuid references auth.users(id) on delete set null,
  previous_observed_at timestamptz not null,
  new_observed_at      timestamptz not null,
  edited_at            timestamptz not null default now()
);

create index if not exists sighting_time_edits_sighting_idx
  on public.sighting_time_edits (sighting_id, edited_at desc);

alter table public.sighting_time_edits enable row level security;

-- Readable by everyone: the whole point is public accountability.
drop policy if exists "sighting_time_edits: public read" on public.sighting_time_edits;
create policy "sighting_time_edits: public read"
  on public.sighting_time_edits for select using (true);

-- No insert / update / delete policies on purpose. Only the SECURITY DEFINER
-- trigger below can write, so the trail cannot be forged or scrubbed by the
-- sighting's owner.

-- =========================================================================
-- Trigger: record every observed_at change
-- =========================================================================
-- SECURITY DEFINER so the insert bypasses the (intentionally absent) write
-- policies above. search_path is pinned to avoid resolution hijacking.

create or replace function public.log_sighting_time_edit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.observed_at is distinct from new.observed_at then
    insert into public.sighting_time_edits (
      sighting_id, edited_by, previous_observed_at, new_observed_at
    )
    values (new.id, auth.uid(), old.observed_at, new.observed_at);
  end if;

  return new;
end;
$$;

drop trigger if exists log_sighting_time_edit on public.sightings;

create trigger log_sighting_time_edit
  after update of observed_at on public.sightings
  for each row
  execute function public.log_sighting_time_edit();

-- =========================================================================
-- Note on ordering vs 0016
-- =========================================================================
-- 0016's guard trigger is BEFORE UPDATE and rejects future timestamps, so a
-- rejected edit never reaches this AFTER UPDATE trigger and never produces a
-- log entry. Guard first, log second — intentional.
