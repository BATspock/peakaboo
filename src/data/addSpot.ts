import { supabase } from "../lib/supabase";
import { fetchPlaceDetails, type PlaceSuggestion } from "./useSubjectSearch";
import type { Subject, SubjectCategory } from "./types";

// Shared creation logic for the unified "Add a spot" flow. Extracted from the
// former AddSubjectSheet / AddViewpointSheet so the wizard stays presentational
// and there is a single source of truth for how subjects + viewpoints are made.

export type CreateSubjectResult =
  | { kind: "created"; subject: Subject }
  | { kind: "conflict"; conflictSubjectId: string }
  | { kind: "error"; message: string };

export type CreateViewpointResult =
  | { kind: "created"; viewpointId: string }
  | { kind: "error"; message: string };

/**
 * Create a brand-new subject from a Google Places suggestion.
 * Ports the place_id preflight dedup, Place Details coord fetch, slug
 * allocation, insert, and the 23505 unique-violation race recheck that
 * previously lived in AddSubjectSheet.
 */
export async function createSubjectFromPlace(args: {
  place: PlaceSuggestion;
  category: SubjectCategory;
  name: string;
  description: string;
  userId: string;
}): Promise<CreateSubjectResult> {
  const { place, category, name, description, userId } = args;
  const trimmedName = name.trim();
  if (!trimmedName) return { kind: "error", message: "Name is required." };

  // Pre-flight: if a subject with this place_id already exists, hand the
  // caller the existing id instead of inserting. Saves a Place Details call.
  const existing = await supabase
    .from("subjects")
    .select("id")
    .eq("place_id", place.placeId)
    .maybeSingle();
  if (existing.data?.id) {
    return { kind: "conflict", conflictSubjectId: existing.data.id };
  }

  // Need canonical lat/lng to anchor viewpoints — fetch from Place Details.
  const details = await fetchPlaceDetails(place.placeId);
  if (!details) {
    return {
      kind: "error",
      message: "Couldn't get coordinates for this place. Try again.",
    };
  }

  const id = await pickAvailableSlug(trimmedName);

  const { data, error } = await supabase
    .from("subjects")
    .insert({
      id,
      name: trimmedName,
      kind: category,
      description: description.trim() || null,
      latitude: details.latitude,
      longitude: details.longitude,
      place_id: place.placeId,
      created_by: userId,
    })
    .select(
      "id, name, kind, latitude, longitude, description, created_by, place_id, created_at",
    )
    .single();

  if (error) {
    // Race: another user inserted the same place_id between our preflight
    // and our insert. Re-query and surface the existing one.
    if (error.code === "23505") {
      const recheck = await supabase
        .from("subjects")
        .select("id")
        .eq("place_id", place.placeId)
        .maybeSingle();
      if (recheck.data?.id) {
        return { kind: "conflict", conflictSubjectId: recheck.data.id };
      }
    }
    // eslint-disable-next-line no-console
    console.warn("[add-spot] subject insert failed", error);
    return { kind: "error", message: error.message };
  }

  if (!data) {
    return { kind: "error", message: "Saved, but the response was empty." };
  }

  return {
    kind: "created",
    subject: {
      id: data.id,
      name: data.name,
      kind: data.kind,
      latitude: data.latitude,
      longitude: data.longitude,
      description: data.description,
      createdBy: data.created_by,
      placeId: data.place_id,
      createdAt: data.created_at,
    },
  };
}

/**
 * Create a viewpoint for an (already-existing) subject. Ports the insert
 * from AddViewpointSheet. Name is optional — callers pass a sensible default.
 */
export async function createViewpoint(args: {
  subjectId: string;
  name: string;
  description: string;
  coords: { latitude: number; longitude: number };
  userId: string;
}): Promise<CreateViewpointResult> {
  const { subjectId, name, description, coords, userId } = args;
  const { data, error } = await supabase
    .from("viewpoints")
    .insert({
      subject_id: subjectId,
      name: name.trim(),
      description: description.trim() || null,
      latitude: coords.latitude,
      longitude: coords.longitude,
      created_by: userId,
    })
    .select("id")
    .single();

  if (error || !data) {
    // eslint-disable-next-line no-console
    console.warn("[add-spot] viewpoint insert failed", error);
    return { kind: "error", message: error?.message ?? "Save failed." };
  }
  return { kind: "created", viewpointId: data.id };
}

/**
 * Best-effort category guess from Google place types + the place name.
 * Returns a SubjectCategory when reasonably confident, else null so the
 * user picks. (The previous implementation always returned null — this one
 * actually maps the common cases to seed the required category chip.)
 */
export function suggestCategory(
  types: string[],
  name = "",
): SubjectCategory | null {
  const set = new Set(types);
  const n = name.toLowerCase();

  // Strong signals from explicit Google types first.
  if (set.has("natural_feature")) {
    if (/\bfalls?\b|waterfall/.test(n)) return "waterfall";
    if (/\blake\b/.test(n)) return "lake_view";
    if (/\b(mt|mount|mountain|peak|butte|summit)\b/.test(n))
      return "mountain_peak";
    if (/\b(beach|ocean|sound|bay|coast)\b/.test(n)) return "ocean_view";
    return null; // natural but ambiguous — let the user choose
  }

  // Name-based heuristics regardless of type.
  if (/\bfalls?\b|waterfall/.test(n)) return "waterfall";
  if (/\b(mt|mount|mountain|peak|butte|summit|volcano)\b/.test(n))
    return "mountain_peak";
  if (/\blake\b/.test(n)) return "lake_view";
  if (/\b(beach|ocean|sound|bay|seashore|coast|pier)\b/.test(n))
    return "ocean_view";
  if (/\b(downtown|skyline|city|tower)\b/.test(n)) return "city_skyline";
  if (/\bobservatory\b/.test(n)) return "stargazing";

  // Type-based fallbacks.
  if (set.has("locality") || set.has("political")) return "city_skyline";

  return null;
}

// ── slug allocation (ported from AddSubjectSheet) ─────────────────────────

async function pickAvailableSlug(name: string): Promise<string> {
  const base = slugify(name) || "subject";
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const { data } = await supabase
      .from("subjects")
      .select("id")
      .eq("id", candidate)
      .maybeSingle();
    if (!data) return candidate;
  }
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
