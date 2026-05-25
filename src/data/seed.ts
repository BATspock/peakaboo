import type { Subject, Viewpoint } from "./types";

// Used as an instant fallback while the DB query is in flight, and as the
// canonical source of truth for the SQL seed in supabase/migrations/0001_init.sql.
// Keep the two in sync.

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
  { id: "seed-kerry",       subjectId: "mt-rainier", name: "Kerry Park",                latitude: 47.6295, longitude: -122.36,   description: "Iconic Seattle skyline with Rainier on a clear day." },
  { id: "seed-gasworks",    subjectId: "mt-rainier", name: "Gas Works Park",            latitude: 47.6456, longitude: -122.3344, description: "South-facing view across Lake Union toward Rainier." },
  { id: "seed-rizal",       subjectId: "mt-rainier", name: "Dr. Jose Rizal Park",       latitude: 47.5908, longitude: -122.3192, description: "Beacon Hill viewpoint with Rainier behind downtown." },
  { id: "seed-marymoor",    subjectId: "mt-rainier", name: "Marymoor Park",             latitude: 47.6628, longitude: -122.118,  description: "Redmond — clear south-east view of Rainier." },
  { id: "seed-bel-down",    subjectId: "mt-rainier", name: "Bellevue Downtown Park",    latitude: 47.6122, longitude: -122.2017 },
  { id: "seed-pt-defiance", subjectId: "mt-rainier", name: "Point Defiance Park",       latitude: 47.3076, longitude: -122.5158, description: "Tacoma — sweeping waterfront view." },
  { id: "seed-coulon",      subjectId: "mt-rainier", name: "Gene Coulon Memorial Park", latitude: 47.5074, longitude: -122.2,    description: "Renton — Lake Washington with Rainier to the south." },
  { id: "seed-trout-lake",  subjectId: "mt-adams",   name: "Trout Lake Meadows",        latitude: 46.0107, longitude: -121.5306, description: "Classic foreground meadow view of Mt Adams." },
  { id: "seed-bird-creek",  subjectId: "mt-adams",   name: "Bird Creek Meadows",        latitude: 46.1497, longitude: -121.4647, description: "South-side wildflower meadow on Adams." },
  { id: "seed-artist-pt",   subjectId: "mt-baker",   name: "Artist Point",              latitude: 48.8463, longitude: -121.6928, description: "End of Mt Baker Highway — point-blank Baker + Shuksan." },
  { id: "seed-picture-lake", subjectId: "mt-baker",  name: "Picture Lake",              latitude: 48.8650, longitude: -121.6783, description: "Iconic reflection shot of Mt Shuksan with Baker nearby." },
  { id: "seed-boulevard",   subjectId: "mt-baker",   name: "Boulevard Park",            latitude: 48.7341, longitude: -122.5072, description: "Bellingham waterfront — Baker rises east over the bay." },
];
