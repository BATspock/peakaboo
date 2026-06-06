-- Remove "Gas Works Park" as a Mt Rainier viewpoint.
-- Rationale: Rainier is not actually visible from Gas Works Park — the
-- park faces south across Lake Union toward downtown, but the mountain
-- is blocked / out of the sightline from there. It was a bad seed.
--
-- Deletes by the deterministic uuid_generate_v5 key used by the seed
-- migrations (0001). As noted in 0006, sightings, favorites, and images
-- cascade-delete with the viewpoint, so any rows logged against Gas Works
-- WILL be removed. If real sightings exist and must be preserved, run an
-- explicit UPDATE to move them to another viewpoint BEFORE applying this.

delete from public.viewpoints
where id = uuid_generate_v5(
  '00000000-0000-0000-0000-000000000000'::uuid,
  'mt-rainier|Gas Works Park'
);
