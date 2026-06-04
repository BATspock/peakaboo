import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Subject, SubjectCategory } from "./types";

// One Google Places suggestion, shape we surface to the UI.
export type PlaceSuggestion = {
  placeId: string;
  mainText: string;       // "Snoqualmie Falls"
  secondaryText: string;  // "Snoqualmie, WA, USA"
  types: string[];        // raw Google place types (e.g. "natural_feature")
};

type State = {
  existing: Subject[];
  suggestions: PlaceSuggestion[];
  loading: boolean;
  error: string | null;
};

const EMPTY: State = {
  existing: [],
  suggestions: [],
  loading: false,
  error: null,
};

// No locationBias — Google's autocomplete is already IP-geolocation-aware.
// A user in Seattle searching "Mt" gets PNW peaks first; a user in India
// gets Indian peaks first. Biasing to Seattle would be wrong for any
// non-PNW user. If you ever want to bias to the user's actual location,
// reach for browser geolocation; if you want to bias to the current map
// view, pass the map's center delta in. Defaults are fine for v1.

// 600ms is a deliberate middle ground:
// - Keeps the UI feeling responsive (1s starts feeling laggy)
// - Coalesces aggressively so a normal-speed user fires ~1 call per word
// Combined with MIN_QUERY_LEN this means typing "Snoqualmie Falls" is
// usually 1-2 Places API calls total.
const DEBOUNCE_MS = 600;
const MIN_QUERY_LEN = 3;
const MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

// Tiny in-memory cache so repeat-typing doesn't refetch.
const queryCache = new Map<string, { existing: Subject[]; suggestions: PlaceSuggestion[] }>();

export function useSubjectSearch(query: string): State {
  const [state, setState] = useState<State>(EMPTY);
  const cancelTokenRef = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      setState(EMPTY);
      return;
    }

    // Don't bother the API for 1-2 character queries — too noisy, low signal,
    // and a real safety net against accidental high-frequency calls.
    if (trimmed.length < MIN_QUERY_LEN) {
      setState({
        existing: [],
        suggestions: [],
        loading: false,
        error: null,
      });
      return;
    }

    const cached = queryCache.get(trimmed.toLowerCase());
    if (cached) {
      setState({ ...cached, loading: false, error: null });
      return;
    }

    const myToken = ++cancelTokenRef.current;
    setState((s) => ({ ...s, loading: true, error: null }));

    const handle = setTimeout(async () => {
      try {
        const [existing, suggestions] = await Promise.all([
          searchExistingSubjects(trimmed),
          searchGooglePlaces(trimmed),
        ]);
        if (cancelTokenRef.current !== myToken) return;
        queryCache.set(trimmed.toLowerCase(), { existing, suggestions });
        setState({ existing, suggestions, loading: false, error: null });
      } catch (e) {
        if (cancelTokenRef.current !== myToken) return;
        const msg = e instanceof Error ? e.message : String(e);
        // eslint-disable-next-line no-console
        console.warn("[subject-search] failed", msg);
        setState({
          existing: [],
          suggestions: [],
          loading: false,
          error: msg,
        });
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(handle);
    };
  }, [query]);

  return state;
}

async function searchExistingSubjects(q: string): Promise<Subject[]> {
  const ilike = `%${q.replace(/[%_]/g, (c) => "\\" + c)}%`;
  const { data, error } = await supabase
    .from("subjects")
    .select(
      "id, name, kind, latitude, longitude, description, created_by, place_id, created_at",
    )
    .ilike("name", ilike)
    .limit(8);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind as SubjectCategory,
    latitude: r.latitude,
    longitude: r.longitude,
    description: r.description,
    createdBy: r.created_by,
    placeId: r.place_id,
    createdAt: r.created_at,
  }));
}

async function searchGooglePlaces(q: string): Promise<PlaceSuggestion[]> {
  if (!MAPS_KEY) return [];
  const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": MAPS_KEY,
    },
    body: JSON.stringify({
      input: q,
      includeQueryPredictions: false,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Places API ${res.status}: ${text.slice(0, 200)}`);
  }
  const json: any = await res.json();
  const list: any[] = json.suggestions ?? [];
  return list
    .filter((s) => s.placePrediction)
    .map((s) => {
      const p = s.placePrediction;
      return {
        placeId: p.placeId,
        mainText: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
        secondaryText: p.structuredFormat?.secondaryText?.text ?? "",
        types: p.types ?? [],
      };
    })
    .slice(0, 6);
}

/**
 * Fetch canonical lat/lng + display name for a place ID. Called only when
 * the user actually picks a suggestion (Place Details is more expensive
 * than Autocomplete — ~$17/1k vs ~$2.83/1k).
 */
export async function fetchPlaceDetails(placeId: string): Promise<{
  name: string;
  latitude: number;
  longitude: number;
} | null> {
  if (!MAPS_KEY) return null;
  const res = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
    {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": MAPS_KEY,
        "X-Goog-FieldMask": "displayName,location",
      },
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // eslint-disable-next-line no-console
    console.warn(`[place-details] ${res.status}: ${text.slice(0, 200)}`);
    return null;
  }
  const json: any = await res.json();
  const lat = json.location?.latitude;
  const lng = json.location?.longitude;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  return {
    name: json.displayName?.text ?? "",
    latitude: lat,
    longitude: lng,
  };
}
