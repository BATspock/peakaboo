import type { Subject, Viewpoint } from "./types";

// Used as an instant fallback while the DB query is in flight, and as the
// canonical source of truth for the SQL seed migrations.
// Keep this in sync with supabase/migrations/0001_init.sql + 0005_more_viewpoints.sql.

export const REGION_DEFAULT = {
  // Centered to fit Mt Baker (north), Mt Rainier, and Mt Adams (south)
  latitude: 47.5,
  longitude: -122.0,
  latitudeDelta: 3.6,
  longitudeDelta: 3.6,
};

export const SEED_SUBJECTS: Subject[] = [
  { id: "mt-rainier", name: "Mt Rainier", kind: "mountain", latitude: 46.8523, longitude: -121.7603 },
  { id: "mt-adams",   name: "Mt Adams",   kind: "mountain", latitude: 46.2024, longitude: -121.4909 },
  { id: "mt-baker",   name: "Mt Baker",   kind: "mountain", latitude: 48.7768, longitude: -121.8145 },
];

export const SEED_VIEWPOINTS: Viewpoint[] = [
  // ── Mt Rainier (10) ────────────────────────────────────────────────
  { id: "seed-kerry",         subjectId: "mt-rainier", name: "Kerry Park",                  latitude: 47.6295, longitude: -122.3600, description: "Iconic Seattle skyline with Rainier on a clear day." },
  { id: "seed-gasworks",      subjectId: "mt-rainier", name: "Gas Works Park",              latitude: 47.6456, longitude: -122.3344, description: "South-facing view across Lake Union toward Rainier." },
  { id: "seed-rizal",         subjectId: "mt-rainier", name: "Dr. Jose Rizal Park",         latitude: 47.5908, longitude: -122.3192, description: "Beacon Hill viewpoint with Rainier behind downtown." },
  { id: "seed-marymoor",      subjectId: "mt-rainier", name: "Marymoor Park",               latitude: 47.6628, longitude: -122.1180, description: "Redmond — clear south-east view of Rainier." },
  { id: "seed-bel-down",      subjectId: "mt-rainier", name: "Bellevue Downtown Park",      latitude: 47.6122, longitude: -122.2017, description: "Bellevue urban park with a clean Rainier view." },
  { id: "seed-pt-defiance",   subjectId: "mt-rainier", name: "Point Defiance Park",         latitude: 47.3076, longitude: -122.5158, description: "Tacoma — sweeping waterfront view." },
  { id: "seed-coulon",        subjectId: "mt-rainier", name: "Gene Coulon Memorial Park",   latitude: 47.5074, longitude: -122.2000, description: "Renton — Lake Washington with Rainier to the south." },
  { id: "seed-sunrise-pt",    subjectId: "mt-rainier", name: "Sunrise Point",               latitude: 46.9148, longitude: -121.6390, description: "Highest road in the park — Rainier fills the horizon." },
  { id: "seed-reflection",    subjectId: "mt-rainier", name: "Reflection Lakes",            latitude: 46.7693, longitude: -121.7321, description: "Postcard reflection of Rainier in a still alpine lake." },
  { id: "seed-tipsoo",        subjectId: "mt-rainier", name: "Tipsoo Lake",                 latitude: 46.8703, longitude: -121.5187, description: "Small subalpine lake near Chinook Pass — Rainier framed by wildflowers in summer." },

  // ── Mt Adams (10) ──────────────────────────────────────────────────
  { id: "seed-trout-lake",    subjectId: "mt-adams",   name: "Trout Lake Meadows",          latitude: 46.0107, longitude: -121.5306, description: "Classic foreground meadow view of Mt Adams." },
  { id: "seed-bird-creek",    subjectId: "mt-adams",   name: "Bird Creek Meadows",          latitude: 46.1497, longitude: -121.4647, description: "South-side wildflower meadow on Adams." },
  { id: "seed-takhlakh",      subjectId: "mt-adams",   name: "Takhlakh Lake",               latitude: 46.3083, longitude: -121.5995, description: "Northwest-side reflection of Adams across an alpine lake — best at sunrise." },
  { id: "seed-snowgrass",     subjectId: "mt-adams",   name: "Snowgrass Flat",              latitude: 46.4742, longitude: -121.4458, description: "Goat Rocks trailhead with a sweeping south-facing Adams view." },
  { id: "seed-glenwood",      subjectId: "mt-adams",   name: "Glenwood Valley",             latitude: 46.0167, longitude: -121.2867, description: "Open ranchland east of Trout Lake — Adams looms large." },
  { id: "seed-hood-river",    subjectId: "mt-adams",   name: "Hood River Waterfront",       latitude: 45.7167, longitude: -121.5158, description: "From the Columbia River — Adams to the north, Hood to the south." },
  { id: "seed-goldendale",    subjectId: "mt-adams",   name: "Goldendale Observatory",      latitude: 45.8385, longitude: -120.8121, description: "High-desert ridge — clear daytime view of Adams to the west." },
  { id: "seed-killen-creek",  subjectId: "mt-adams",   name: "Killen Creek Trailhead",      latitude: 46.2725, longitude: -121.5408, description: "Northwest-side trailhead — close-up Adams from open meadows." },
  { id: "seed-mt-adams-rec",  subjectId: "mt-adams",   name: "Mt Adams Recreation Area",    latitude: 46.1242, longitude: -121.5028, description: "Yakama Nation recreation area — south-side Adams classic." },
  { id: "seed-bonney-meadow", subjectId: "mt-adams",   name: "Bonney Meadows",              latitude: 45.2747, longitude: -121.6633, description: "Distant southern view of Adams from Mt Hood backcountry." },

  // ── Mt Baker (10) ──────────────────────────────────────────────────
  { id: "seed-artist-pt",     subjectId: "mt-baker",   name: "Artist Point",                latitude: 48.8463, longitude: -121.6928, description: "End of Mt Baker Highway — point-blank Baker + Shuksan." },
  { id: "seed-picture-lake",  subjectId: "mt-baker",   name: "Picture Lake",                latitude: 48.8650, longitude: -121.6783, description: "Iconic reflection shot of Mt Shuksan with Baker nearby." },
  { id: "seed-boulevard",     subjectId: "mt-baker",   name: "Boulevard Park",              latitude: 48.7341, longitude: -122.5072, description: "Bellingham waterfront — Baker rises east over the bay." },
  { id: "seed-heather",       subjectId: "mt-baker",   name: "Heather Meadows",             latitude: 48.8579, longitude: -121.6735, description: "Just below Artist Point — wildflowers, tarns, and Baker." },
  { id: "seed-skyline-div",   subjectId: "mt-baker",   name: "Skyline Divide Trailhead",    latitude: 48.8990, longitude: -121.8423, description: "North-side trailhead leading to the most dramatic Baker view in the range." },
  { id: "seed-baker-vineyard", subjectId: "mt-baker",  name: "Mt Baker Vineyards",          latitude: 48.8047, longitude: -122.2947, description: "Everson — tasting room patio framed by Baker on a clear day." },
  { id: "seed-anderson-mtn",  subjectId: "mt-baker",   name: "Anderson Mountain",           latitude: 48.5469, longitude: -122.2017, description: "Skagit Valley high point — wide panorama with Baker on the horizon." },
  { id: "seed-padilla",       subjectId: "mt-baker",   name: "Padilla Bay Shore Trail",     latitude: 48.4983, longitude: -122.4858, description: "Padilla Bay tideflats — Baker visible across the water on clear days." },
  { id: "seed-larrabee",      subjectId: "mt-baker",   name: "Larrabee State Park",         latitude: 48.6533, longitude: -122.4856, description: "Rocky Chuckanut shoreline with Baker in the distance." },
  { id: "seed-chuckanut",     subjectId: "mt-baker",   name: "Chuckanut Drive Overlook",    latitude: 48.6122, longitude: -122.4625, description: "Pullout on Highway 11 — Baker east, San Juans west." },
];
