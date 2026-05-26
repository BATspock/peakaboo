-- Round out Rainier / Adams / Baker to ~10 viewpoints each.
-- Idempotent via uuid_generate_v5 keyed on (subject_id || '|' || name).

with seed (subject_id, name, latitude, longitude, description) as (
  values
    -- Rainier (3 new)
    ('mt-rainier', 'Sunrise Point',               46.9148, -121.6390, 'Highest road in the park — Rainier fills the horizon.'),
    ('mt-rainier', 'Reflection Lakes',            46.7693, -121.7321, 'Postcard reflection of Rainier in a still alpine lake.'),
    ('mt-rainier', 'Tipsoo Lake',                 46.8703, -121.5187, 'Small subalpine lake near Chinook Pass — Rainier framed by wildflowers in summer.'),

    -- Adams (8 new)
    ('mt-adams',   'Takhlakh Lake',               46.3083, -121.5995, 'Northwest-side reflection of Adams across an alpine lake — best at sunrise.'),
    ('mt-adams',   'Snowgrass Flat',              46.4742, -121.4458, 'Goat Rocks trailhead with a sweeping south-facing Adams view.'),
    ('mt-adams',   'Glenwood Valley',             46.0167, -121.2867, 'Open ranchland east of Trout Lake — Adams looms large.'),
    ('mt-adams',   'Hood River Waterfront',       45.7167, -121.5158, 'From the Columbia River — Adams to the north, Hood to the south.'),
    ('mt-adams',   'Goldendale Observatory',      45.8385, -120.8121, 'High-desert ridge — clear daytime view of Adams to the west.'),
    ('mt-adams',   'Killen Creek Trailhead',      46.2725, -121.5408, 'Northwest-side trailhead — close-up Adams from open meadows.'),
    ('mt-adams',   'Mt Adams Recreation Area',    46.1242, -121.5028, 'Yakama Nation recreation area — south-side Adams classic.'),
    ('mt-adams',   'Bonney Meadows',              45.2747, -121.6633, 'Distant southern view of Adams from Mt Hood backcountry.'),

    -- Baker (7 new)
    ('mt-baker',   'Heather Meadows',             48.8579, -121.6735, 'Just below Artist Point — wildflowers, tarns, and Baker.'),
    ('mt-baker',   'Skyline Divide Trailhead',    48.8990, -121.8423, 'North-side trailhead leading to the most dramatic Baker view in the range.'),
    ('mt-baker',   'Mt Baker Vineyards',          48.8047, -122.2947, 'Everson — tasting room patio framed by Baker on a clear day.'),
    ('mt-baker',   'Anderson Mountain',           48.5469, -122.2017, 'Skagit Valley high point — wide panorama with Baker on the horizon.'),
    ('mt-baker',   'Padilla Bay Shore Trail',     48.4983, -122.4858, 'Padilla Bay tideflats — Baker visible across the water on clear days.'),
    ('mt-baker',   'Larrabee State Park',         48.6533, -122.4856, 'Rocky Chuckanut shoreline with Baker in the distance.'),
    ('mt-baker',   'Chuckanut Drive Overlook',    48.6122, -122.4625, 'Pullout on Highway 11 — Baker east, San Juans west.')
)
insert into public.viewpoints (id, subject_id, name, latitude, longitude, description)
select
  uuid_generate_v5('00000000-0000-0000-0000-000000000000'::uuid, subject_id || '|' || name),
  subject_id, name, latitude, longitude, description
from seed
on conflict (id) do nothing;
