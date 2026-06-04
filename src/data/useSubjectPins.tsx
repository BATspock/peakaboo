import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthContext";
import type { Subject } from "./types";
import { usePlaces } from "./usePlaces";

const MAX_PINS = 5;

// IDs of the curated defaults shown to signed-out users (and pre-filled
// for signed-in users on first signup, via the handle_new_user trigger).
// Order is the display order.
const DEFAULT_PIN_IDS: readonly string[] = [
  "mt-rainier",
  "mt-baker",
  "snoqualmie-falls",
];

type State = {
  pins: Subject[];
  pinnedIds: Set<string>;
  loading: boolean;
  canPin: boolean;
  pin: (subjectId: string) => Promise<void>;
  unpin: (subjectId: string) => Promise<void>;
};

const PinsCtx = createContext<State | null>(null);

export function SubjectPinsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session } = useAuth();
  const { subjects } = usePlaces();
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Load this user's pins, ordered by position.
  useEffect(() => {
    if (!session) {
      setPinnedIds([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("subject_pins")
        .select("subject_id, position")
        .eq("user_id", session.user.id)
        .order("position", { ascending: true });
      if (cancelled) return;
      if (error) {
        // eslint-disable-next-line no-console
        console.warn("[pins] load failed", error.message);
      }
      setPinnedIds((data ?? []).map((r) => r.subject_id));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user.id]);

  // Resolve to the actual Subject objects (in pin order). Signed-out users
  // see the default IDs against whatever subjects are loaded (the seed
  // peaks always exist).
  const sourceIds = session ? pinnedIds : DEFAULT_PIN_IDS;
  const pins = useMemo(() => {
    const byId = new Map(subjects.map((s) => [s.id, s]));
    const out: Subject[] = [];
    for (const id of sourceIds) {
      const s = byId.get(id);
      if (s) out.push(s);
    }
    return out;
  }, [sourceIds, subjects]);

  const pinnedIdsSet = useMemo(() => new Set(sourceIds), [sourceIds]);

  const pin = useCallback(
    async (subjectId: string) => {
      if (!session) return;
      if (pinnedIds.includes(subjectId)) return;
      if (pinnedIds.length >= MAX_PINS) return;

      // Optimistic.
      const nextPosition = pinnedIds.length;
      setPinnedIds((prev) => [...prev, subjectId]);

      const { error } = await supabase.from("subject_pins").insert({
        user_id: session.user.id,
        subject_id: subjectId,
        position: nextPosition,
      });
      if (error) {
        // eslint-disable-next-line no-console
        console.warn("[pins] pin failed", error.message);
        setPinnedIds((prev) => prev.filter((id) => id !== subjectId));
      }
    },
    [session?.user.id, pinnedIds],
  );

  const unpin = useCallback(
    async (subjectId: string) => {
      if (!session) return;
      if (!pinnedIds.includes(subjectId)) return;

      // Optimistic.
      setPinnedIds((prev) => prev.filter((id) => id !== subjectId));

      const { error } = await supabase
        .from("subject_pins")
        .delete()
        .eq("user_id", session.user.id)
        .eq("subject_id", subjectId);
      if (error) {
        // eslint-disable-next-line no-console
        console.warn("[pins] unpin failed", error.message);
        // Roll back to the end of the list (we lost the original position;
        // worst case the order is slightly off until next reload).
        setPinnedIds((prev) => [...prev, subjectId]);
      }
    },
    [session?.user.id, pinnedIds],
  );

  const canPin = !!session && pinnedIds.length < MAX_PINS;

  const value = useMemo<State>(
    () => ({ pins, pinnedIds: pinnedIdsSet, loading, canPin, pin, unpin }),
    [pins, pinnedIdsSet, loading, canPin, pin, unpin],
  );

  return <PinsCtx.Provider value={value}>{children}</PinsCtx.Provider>;
}

export function useSubjectPins(): State {
  const ctx = useContext(PinsCtx);
  if (!ctx)
    throw new Error("useSubjectPins must be used inside <SubjectPinsProvider>");
  return ctx;
}

export const SUBJECT_PINS_MAX = MAX_PINS;
