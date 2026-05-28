-- Drop the one-sighting-per-user-per-viewpoint-per-day unique index so
-- users can log multiple observations per day. The product moved from
-- "your answer for today" to "an observation at a moment" — conditions
-- and visibility can change throughout the day, and photos are tied to
-- the moment they were taken.
--
-- Existing rows are unaffected. observed_at still timestamps each row,
-- and feed queries already order by observed_at desc.

drop index if exists public.sightings_one_per_day;
