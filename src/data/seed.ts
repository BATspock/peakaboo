import type { Subject, Viewpoint } from "./types";

// Used as an instant fallback while the DB query is in flight, and as the
// canonical source of truth for the SQL seed migrations.
// Keep this in sync with supabase/migrations/0001_init.sql + 0005_*.sql + 0006_*.sql.

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
  // Source: NPS-confirmed (Paradise, Sunrise) + Wikipedia (Reflection Lakes,
  // Mowich Lake, Tipsoo Lake, Sunrise Point) + classic Seattle skyline shots.
  { id: "seed-paradise",      subjectId: "mt-rainier", name: "Paradise",                    latitude: 46.7867, longitude: -121.7350, description: "The park's most famous destination — wildflower meadows and the historic Paradise Inn directly under the summit." },
  { id: "seed-sunrise",       subjectId: "mt-rainier", name: "Sunrise",                     latitude: 46.9145, longitude: -121.6418, description: "Highest point in the park reachable by car (6,400 ft) — Emmons Glacier dominates the view." },
  { id: "seed-reflection",    subjectId: "mt-rainier", name: "Reflection Lakes",            latitude: 46.7693, longitude: -121.7321, description: "Postcard reflection of Rainier in a still alpine lake on Stevens Canyon Road." },
  { id: "seed-tipsoo",        subjectId: "mt-rainier", name: "Tipsoo Lake",                 latitude: 46.8703, longitude: -121.5187, description: "Subalpine lake near Chinook Pass — Rainier framed by wildflowers in summer." },
  { id: "seed-sunrise-pt",    subjectId: "mt-rainier", name: "Sunrise Point",               latitude: 46.9148, longitude: -121.6390, description: "Roadside pullout on the Sunrise Road — sweeping views of Rainier and the eastern Cascades." },
  { id: "seed-mowich",        subjectId: "mt-rainier", name: "Mowich Lake",                 latitude: 46.9389, longitude: -121.8625, description: "Largest and deepest lake in the park, in the quieter northwest corner." },
  { id: "seed-kerry",         subjectId: "mt-rainier", name: "Kerry Park",                  latitude: 47.6295, longitude: -122.3600, description: "Iconic Seattle skyline with Rainier on a clear day." },
  { id: "seed-gasworks",      subjectId: "mt-rainier", name: "Gas Works Park",              latitude: 47.6456, longitude: -122.3344, description: "South-facing view across Lake Union toward Rainier." },
  { id: "seed-rizal",         subjectId: "mt-rainier", name: "Dr. Jose Rizal Park",         latitude: 47.5908, longitude: -122.3192, description: "Beacon Hill viewpoint with Rainier behind downtown Seattle." },
  { id: "seed-pt-defiance",   subjectId: "mt-rainier", name: "Point Defiance Park",         latitude: 47.3076, longitude: -122.5158, description: "Tacoma waterfront — Rainier rises behind the Sound." },

  // ── Mt Adams (10) ──────────────────────────────────────────────────
  // Source: Wikipedia (Trout Lake, Bird Creek Meadows, Devils Garden,
  // Round-the-Mountain, High Lakes) + USFS Gifford Pinchot references
  // (Killen Creek, Cold Springs/South Climb, Takhlakh Lake).
  { id: "seed-trout-lake",    subjectId: "mt-adams",   name: "Trout Lake",                  latitude: 46.0107, longitude: -121.5306, description: "Small town at Adams' southwest base — outstanding wildflowers and exceptional views of the mountain and its glaciers." },
  { id: "seed-bird-creek",    subjectId: "mt-adams",   name: "Bird Creek Meadows",          latitude: 46.1497, longitude: -121.4647, description: "South-side wildflower meadow on Yakama Nation land — popular picnic and hiking area with classic Adams views." },
  { id: "seed-takhlakh",      subjectId: "mt-adams",   name: "Takhlakh Lake",               latitude: 46.3083, longitude: -121.5995, description: "Northwest-side reflection of Adams across an alpine lake — best at sunrise." },
  { id: "seed-killen-creek",  subjectId: "mt-adams",   name: "Killen Creek Trail",          latitude: 46.2725, longitude: -121.5408, description: "Northwest-side trail through open meadows up onto the volcano's flank." },
  { id: "seed-cold-springs",  subjectId: "mt-adams",   name: "Cold Springs / South Climb TH", latitude: 46.1325, longitude: -121.4928, description: "Standard south-side climbers' trailhead at 5,600 ft — direct view straight up the south flank." },
  { id: "seed-devils-garden", subjectId: "mt-adams",   name: "Devils Garden",               latitude: 46.2533, longitude: -121.5072, description: "Lava flow on the mountain's north flank — moonscape with Adams towering above." },
  { id: "seed-high-lakes",    subjectId: "mt-adams",   name: "High Lakes Trail",            latitude: 46.2889, longitude: -121.5644, description: "North-side trail through the Midway High Lakes area — historic huckleberry route with Adams views." },
  { id: "seed-mt-adams-rec",  subjectId: "mt-adams",   name: "Mt Adams Recreation Area",    latitude: 46.1242, longitude: -121.5028, description: "Yakama Nation-managed area on the south side — primary access point for Bird Creek Meadows trails." },
  { id: "seed-glenwood",      subjectId: "mt-adams",   name: "Glenwood Valley",             latitude: 46.0167, longitude: -121.2867, description: "Open ranchland east of Trout Lake — Adams looms large over the meadows." },
  { id: "seed-round-the-mtn", subjectId: "mt-adams",   name: "Round the Mountain Trail",    latitude: 46.1808, longitude: -121.4339, description: "Roughly 35-mile loop circling the volcano with continuous views from every aspect." },

  // ── Mt Baker (10) ──────────────────────────────────────────────────
  // Source: Wikipedia (Mt Baker Highway: Artist Point, Picture Lake,
  // Heather Meadows, Austin Pass, Table Mountain) + established hiking
  // literature (Skyline Divide, Park Butte, Yellow Aster Butte, Hannegan
  // Pass, Chain Lakes Loop, Bagley Lakes).
  { id: "seed-artist-pt",     subjectId: "mt-baker",   name: "Artist Point",                latitude: 48.8463, longitude: -121.6928, description: "Eastern terminus of the Mt Baker Highway at 5,210 ft on Kulshan Ridge — point-blank Baker and Shuksan." },
  { id: "seed-picture-lake",  subjectId: "mt-baker",   name: "Picture Lake",                latitude: 48.8650, longitude: -121.6783, description: "Iconic reflection of Mt Shuksan with Baker just out of frame — most-photographed spot in WA." },
  { id: "seed-heather",       subjectId: "mt-baker",   name: "Heather Meadows",             latitude: 48.8579, longitude: -121.6735, description: "Subalpine meadows with wildflowers, tarns, and Baker visible to the south below Table Mountain." },
  { id: "seed-skyline-div",   subjectId: "mt-baker",   name: "Skyline Divide Trail",        latitude: 48.8990, longitude: -121.8423, description: "North-side ridge trail with arguably the most dramatic Baker view in the range." },
  { id: "seed-park-butte",    subjectId: "mt-baker",   name: "Park Butte Lookout",          latitude: 48.7022, longitude: -121.8703, description: "Historic fire lookout on Baker's south side — sweeping views of the south face and Easton Glacier." },
  { id: "seed-yellow-aster",  subjectId: "mt-baker",   name: "Yellow Aster Butte",          latitude: 48.9258, longitude: -121.6358, description: "North-side wildflower meadows with tarns and a panorama of Baker, Shuksan, and the Border Peaks." },
  { id: "seed-table-mtn",     subjectId: "mt-baker",   name: "Table Mountain",              latitude: 48.8447, longitude: -121.6900, description: "Steep but short climb above Artist Point — flat summit with 360° view of Baker, Shuksan, and the North Cascades." },
  { id: "seed-bagley-lakes",  subjectId: "mt-baker",   name: "Bagley Lakes",                latitude: 48.8597, longitude: -121.6789, description: "Easy loop in Heather Meadows past two small lakes with Mt Herman and Baker reflections." },
  { id: "seed-chain-lakes",   subjectId: "mt-baker",   name: "Chain Lakes Loop",            latitude: 48.8506, longitude: -121.6967, description: "Classic Heather Meadows loop past four alpine lakes with continuous Baker views from Herman Saddle." },
  { id: "seed-boulevard",     subjectId: "mt-baker",   name: "Boulevard Park",              latitude: 48.7341, longitude: -122.5072, description: "Bellingham waterfront — Baker rises east over the bay on clear days." },
];
