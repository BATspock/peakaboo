-- Replace the seed viewpoint set with a researched, curated top-10 per peak.
-- Sources cross-referenced: NPS Mt Rainier pages, Wikipedia (Mt Rainier
-- National Park, Mt Adams, Mt Baker Highway, Heather Meadows, Sunrise),
-- USFS Gifford Pinchot National Forest references, and established PNW
-- hiking literature.
--
-- Strategy: drop deprecated seed rows (ones I can't justify as a top-10
-- viewpoint after research), then re-insert the curated set idempotently.
-- Sightings, ratings, favorites, and images cascade-delete with the
-- viewpoint, so users who saved sightings against deprecated viewpoints
-- WILL lose them. There are very few such rows today (test data only),
-- so this is acceptable. If we ever need to migrate sightings to a new
-- viewpoint, do an explicit UPDATE before this drop.

-- ── Drop deprecated viewpoints by deterministic name keys ─────────────
with dropped (subject_id, name) as (
  values
    -- Rainier: removing the weaker-view urban parks
    ('mt-rainier', 'Marymoor Park'),
    ('mt-rainier', 'Bellevue Downtown Park'),
    ('mt-rainier', 'Gene Coulon Memorial Park'),

    -- Adams: removing distant or off-axis spots
    ('mt-adams', 'Snowgrass Flat'),         -- Goat Rocks viewpoint, not Adams
    ('mt-adams', 'Hood River Waterfront'),  -- Hood is the primary view there
    ('mt-adams', 'Goldendale Observatory'), -- very distant
    ('mt-adams', 'Bonney Meadows'),         -- in Mt Hood backcountry; distant Adams

    -- Baker: removing distant spots and a winery
    ('mt-baker', 'Mt Baker Vineyards'),
    ('mt-baker', 'Anderson Mountain'),
    ('mt-baker', 'Padilla Bay Shore Trail'),
    ('mt-baker', 'Larrabee State Park'),
    ('mt-baker', 'Chuckanut Drive Overlook')
)
delete from public.viewpoints
where id in (
  select uuid_generate_v5(
    '00000000-0000-0000-0000-000000000000'::uuid,
    subject_id || '|' || name
  )
  from dropped
);

-- ── Insert / re-insert the curated set ────────────────────────────────
-- Items already present from earlier migrations (Kerry Park, Gas Works,
-- Rizal, Point Defiance, Trout Lake, Bird Creek, Takhlakh, Killen Creek,
-- Mt Adams Recreation Area, Glenwood Valley, Artist Point, Picture Lake,
-- Heather Meadows, Skyline Divide, Boulevard Park, Sunrise Point,
-- Reflection Lakes, Tipsoo Lake) will be no-ops thanks to the conflict
-- clause. The newly added items below are the meaningful change.

with seed (subject_id, name, latitude, longitude, description) as (
  values
    -- Rainier additions
    ('mt-rainier', 'Paradise',                 46.7867, -121.7350, 'The park''s most famous destination — wildflower meadows and the historic Paradise Inn directly under the summit.'),
    ('mt-rainier', 'Sunrise',                  46.9145, -121.6418, 'Highest point in the park reachable by car (6,400 ft) — Emmons Glacier dominates the view.'),
    ('mt-rainier', 'Mowich Lake',              46.9389, -121.8625, 'Largest and deepest lake in the park, in the quieter northwest corner.'),

    -- Adams additions
    ('mt-adams',   'Cold Springs / South Climb TH', 46.1325, -121.4928, 'Standard south-side climbers'' trailhead at 5,600 ft — direct view straight up the south flank.'),
    ('mt-adams',   'Devils Garden',            46.2533, -121.5072, 'Lava flow on the mountain''s north flank — moonscape with Adams towering above.'),
    ('mt-adams',   'High Lakes Trail',         46.2889, -121.5644, 'North-side trail through the Midway High Lakes area — historic huckleberry route with Adams views.'),
    ('mt-adams',   'Round the Mountain Trail', 46.1808, -121.4339, 'Roughly 35-mile loop circling the volcano with continuous views from every aspect.'),

    -- Baker additions
    ('mt-baker',   'Park Butte Lookout',       48.7022, -121.8703, 'Historic fire lookout on Baker''s south side — sweeping views of the south face and Easton Glacier.'),
    ('mt-baker',   'Yellow Aster Butte',       48.9258, -121.6358, 'North-side wildflower meadows with tarns and a panorama of Baker, Shuksan, and the Border Peaks.'),
    ('mt-baker',   'Table Mountain',           48.8447, -121.6900, 'Steep but short climb above Artist Point — flat summit with 360° view of Baker, Shuksan, and the North Cascades.'),
    ('mt-baker',   'Bagley Lakes',             48.8597, -121.6789, 'Easy loop in Heather Meadows past two small lakes with Mt Herman and Baker reflections.'),
    ('mt-baker',   'Chain Lakes Loop',         48.8506, -121.6967, 'Classic Heather Meadows loop past four alpine lakes with continuous Baker views from Herman Saddle.')
)
insert into public.viewpoints (id, subject_id, name, latitude, longitude, description)
select
  uuid_generate_v5('00000000-0000-0000-0000-000000000000'::uuid, subject_id || '|' || name),
  subject_id, name, latitude, longitude, description
from seed
on conflict (id) do nothing;

-- Update "Trout Lake Meadows" to just "Trout Lake" to match the canonical
-- name on Wikipedia/USFS — but only if it still exists by its old key.
update public.viewpoints
set name = 'Trout Lake',
    description = 'Small town at Adams'' southwest base — outstanding wildflowers and exceptional views of the mountain and its glaciers.'
where id = uuid_generate_v5(
  '00000000-0000-0000-0000-000000000000'::uuid,
  'mt-adams|Trout Lake Meadows'
);
