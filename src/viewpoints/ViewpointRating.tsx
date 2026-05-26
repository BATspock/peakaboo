import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthContext";
import { colors, radii } from "../theme";

type Props = {
  viewpointId: string;
};

type Aggregate = {
  average: number | null;
  count: number;
};

const STARS = [1, 2, 3, 4, 5] as const;

export default function ViewpointRating({ viewpointId }: Props) {
  const { session, signInWithGoogle } = useAuth();
  const [aggregate, setAggregate] = useState<Aggregate>({
    average: null,
    count: 0,
  });
  const [stars, setStars] = useState<number | null>(null);
  const [review, setReview] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      const aggReq = supabase
        .from("viewpoint_ratings")
        .select("stars")
        .eq("viewpoint_id", viewpointId);

      const meReq = session
        ? supabase
            .from("viewpoint_ratings")
            .select("stars, review")
            .eq("viewpoint_id", viewpointId)
            .eq("user_id", session.user.id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null });

      const [aggRes, meRes] = await Promise.all([aggReq, meReq]);
      if (cancelled) return;

      const rows = aggRes.data ?? [];
      const sum = rows.reduce((acc, r) => acc + (r.stars ?? 0), 0);
      setAggregate({
        count: rows.length,
        average: rows.length ? sum / rows.length : null,
      });

      if (meRes && "data" in meRes && meRes.data) {
        setStars(meRes.data.stars);
        setReview(meRes.data.review ?? "");
      } else {
        setStars(null);
        setReview("");
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [viewpointId, session?.user.id]);

  async function handleSave() {
    if (!session || !stars) return;
    setSaving(true);
    const { error } = await supabase.from("viewpoint_ratings").upsert(
      {
        viewpoint_id: viewpointId,
        user_id: session.user.id,
        stars,
        review: review.trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "viewpoint_id,user_id" },
    );
    setSaving(false);

    if (error) {
      // eslint-disable-next-line no-console
      console.warn("[rating] save failed", error.message);
      const msg = error.message;
      Platform.OS === "web"
        ? // eslint-disable-next-line no-alert
          window.alert(`Save failed: ${msg}`)
        : Alert.alert("Save failed", msg);
      return;
    }

    setSavedAt(Date.now());
    // Refresh aggregate.
    const { data } = await supabase
      .from("viewpoint_ratings")
      .select("stars")
      .eq("viewpoint_id", viewpointId);
    const rows = data ?? [];
    const sum = rows.reduce((acc, r) => acc + (r.stars ?? 0), 0);
    setAggregate({
      count: rows.length,
      average: rows.length ? sum / rows.length : null,
    });
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Rate this viewpoint</Text>
        {aggregate.count > 0 ? (
          <Text style={styles.aggregate}>
            {aggregate.average?.toFixed(1)} ★ · {aggregate.count} rating
            {aggregate.count === 1 ? "" : "s"}
          </Text>
        ) : (
          <Text style={styles.aggregate}>No ratings yet</Text>
        )}
      </View>

      <View style={styles.starRow}>
        {STARS.map((n) => (
          <Pressable
            key={n}
            onPress={() => session && setStars(n)}
            disabled={!session}
            hitSlop={6}
          >
            <Text
              style={[
                styles.star,
                stars !== null && n <= stars && styles.starActive,
                !session && styles.starDisabled,
              ]}
            >
              ★
            </Text>
          </Pressable>
        ))}
      </View>

      {session ? (
        <>
          <TextInput
            style={styles.review}
            placeholder="A note about this spot (optional)…"
            placeholderTextColor="#94A3B8"
            multiline
            value={review}
            onChangeText={setReview}
          />
          <Pressable
            onPress={handleSave}
            disabled={!stars || saving}
            style={[
              styles.saveBtn,
              (!stars || saving) && { opacity: 0.5 },
            ]}
          >
            <Text style={styles.saveBtnText}>
              {saving ? "Saving…" : "Save rating"}
            </Text>
          </Pressable>
          {savedAt && Date.now() - savedAt < 4000 ? (
            <Text style={styles.savedHint}>✓ Rating saved.</Text>
          ) : null}
        </>
      ) : (
        <Pressable
          onPress={() => signInWithGoogle().catch(() => undefined)}
          style={styles.saveBtn}
        >
          <Text style={styles.saveBtnText}>Sign in to rate</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.md,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    flexWrap: "wrap",
    gap: 6,
  },
  heading: { fontSize: 14, fontWeight: "700", color: colors.text },
  aggregate: { fontSize: 12, color: colors.textSecondary, fontWeight: "600" },
  starRow: { flexDirection: "row", gap: 4 },
  star: { fontSize: 30, color: colors.border },
  starActive: { color: colors.peak },
  starDisabled: { opacity: 0.7 },
  review: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 50,
    fontSize: 13,
    color: colors.text,
    textAlignVertical: "top",
  },
  saveBtn: {
    backgroundColor: colors.forest,
    paddingVertical: 10,
    borderRadius: radii.sm,
    alignItems: "center",
  },
  saveBtnText: { color: colors.textOn, fontWeight: "700", fontSize: 14 },
  savedHint: {
    color: colors.forestSoft,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
});
