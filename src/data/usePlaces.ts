import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Subject, Viewpoint } from "./types";
import { SEED_SUBJECTS, SEED_VIEWPOINTS } from "./seed";

type State = {
  subjects: Subject[];
  viewpoints: Viewpoint[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
};

export function usePlaces(): State {
  const [subjects, setSubjects] = useState<Subject[]>(SEED_SUBJECTS);
  const [viewpoints, setViewpoints] = useState<Viewpoint[]>(SEED_VIEWPOINTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      const [subjectsRes, viewpointsRes] = await Promise.all([
        supabase.from("subjects").select("id, name, kind, latitude, longitude"),
        supabase
          .from("viewpoints")
          .select("id, subject_id, name, description, latitude, longitude"),
      ]);

      if (cancelled) return;

      if (subjectsRes.error || viewpointsRes.error) {
        setError(
          subjectsRes.error?.message ??
            viewpointsRes.error?.message ??
            "Unknown error",
        );
        setLoading(false);
        return;
      }

      const nextSubjects: Subject[] = (subjectsRes.data ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        kind: r.kind,
        latitude: r.latitude,
        longitude: r.longitude,
      }));

      const nextViewpoints: Viewpoint[] = (viewpointsRes.data ?? []).map(
        (r) => ({
          id: r.id,
          subjectId: r.subject_id,
          name: r.name,
          description: r.description,
          latitude: r.latitude,
          longitude: r.longitude,
        }),
      );

      setSubjects(nextSubjects.length ? nextSubjects : SEED_SUBJECTS);
      setViewpoints(nextViewpoints.length ? nextViewpoints : SEED_VIEWPOINTS);
      setError(null);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [tick]);

  return { subjects, viewpoints, loading, error, refresh };
}
