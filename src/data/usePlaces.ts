import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Subject, Viewpoint } from "./types";
import { SEED_SUBJECTS, SEED_VIEWPOINTS } from "./seed";

type State = {
  subjects: Subject[];
  viewpoints: Viewpoint[];
  loading: boolean;
  error: string | null;
};

export function usePlaces(): State {
  const [state, setState] = useState<State>({
    subjects: SEED_SUBJECTS,
    viewpoints: SEED_VIEWPOINTS,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [subjectsRes, viewpointsRes] = await Promise.all([
        supabase.from("subjects").select("id, name, kind, latitude, longitude"),
        supabase
          .from("viewpoints")
          .select("id, subject_id, name, description, latitude, longitude"),
      ]);

      if (cancelled) return;

      if (subjectsRes.error || viewpointsRes.error) {
        setState((s) => ({
          ...s,
          loading: false,
          error:
            subjectsRes.error?.message ??
            viewpointsRes.error?.message ??
            "Unknown error",
        }));
        return;
      }

      const subjects: Subject[] = (subjectsRes.data ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        kind: r.kind,
        latitude: r.latitude,
        longitude: r.longitude,
      }));

      const viewpoints: Viewpoint[] = (viewpointsRes.data ?? []).map((r) => ({
        id: r.id,
        subjectId: r.subject_id,
        name: r.name,
        description: r.description,
        latitude: r.latitude,
        longitude: r.longitude,
      }));

      // If DB returned nothing, keep seed data so the map isn't empty.
      setState({
        subjects: subjects.length ? subjects : SEED_SUBJECTS,
        viewpoints: viewpoints.length ? viewpoints : SEED_VIEWPOINTS,
        loading: false,
        error: null,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
