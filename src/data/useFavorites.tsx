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

type FavoritesState = {
  ids: Set<string>;
  loading: boolean;
  toggle: (viewpointId: string) => Promise<void>;
  has: (viewpointId: string) => boolean;
};

const FavoritesCtx = createContext<FavoritesState | null>(null);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!session) {
      setIds(new Set());
      return;
    }
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("viewpoint_favorites")
        .select("viewpoint_id")
        .eq("user_id", session.user.id);
      if (cancelled) return;
      if (error) {
        // eslint-disable-next-line no-console
        console.warn("[favorites] load failed", error.message);
      }
      setIds(new Set((data ?? []).map((r) => r.viewpoint_id)));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user.id]);

  const toggle = useCallback(
    async (viewpointId: string) => {
      if (!session) return;
      let isFav = false;
      setIds((prev) => {
        isFav = prev.has(viewpointId);
        const next = new Set(prev);
        isFav ? next.delete(viewpointId) : next.add(viewpointId);
        return next;
      });

      const op = isFav
        ? supabase
            .from("viewpoint_favorites")
            .delete()
            .eq("user_id", session.user.id)
            .eq("viewpoint_id", viewpointId)
        : supabase.from("viewpoint_favorites").insert({
            user_id: session.user.id,
            viewpoint_id: viewpointId,
          });

      const { error } = await op;
      if (error) {
        // eslint-disable-next-line no-console
        console.warn("[favorites] toggle failed", error.message);
        // Roll back.
        setIds((prev) => {
          const next = new Set(prev);
          isFav ? next.add(viewpointId) : next.delete(viewpointId);
          return next;
        });
      }
    },
    [session?.user.id],
  );

  const has = useCallback((id: string) => ids.has(id), [ids]);

  const value = useMemo<FavoritesState>(
    () => ({ ids, loading, toggle, has }),
    [ids, loading, toggle, has],
  );

  return <FavoritesCtx.Provider value={value}>{children}</FavoritesCtx.Provider>;
}

export function useFavorites(): FavoritesState {
  const ctx = useContext(FavoritesCtx);
  if (!ctx) {
    throw new Error("useFavorites must be used inside <FavoritesProvider>");
  }
  return ctx;
}
