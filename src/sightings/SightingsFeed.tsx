import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../lib/supabase";
import {
  formatViewpointDay,
  formatViewpointTime,
  viewpointDateKey,
} from "../lib/time";
import { useAuth } from "../auth/AuthContext";
import { colors, radii } from "../theme";

function confirmAsync(message: string): boolean | Promise<boolean> {
  if (Platform.OS === "web") {
    // eslint-disable-next-line no-alert
    return typeof window !== "undefined" ? window.confirm(message) : false;
  }
  return new Promise<boolean>((resolve) => {
    Alert.alert("Are you sure?", message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: "Delete", style: "destructive", onPress: () => resolve(true) },
    ]);
  });
}

type Row = {
  id: string;
  user_id: string;
  observed_at: string;
  observed_on: string;
  visible: boolean;
  visibility: number | null;
  conditions: string | null;
  notes: string | null;
  profiles: { display_name: string | null; avatar_url: string | null } | null;
  sighting_images: { id: string; storage_path: string }[];
};

type Props = {
  viewpointId: string;
  refreshKey: number;
  onOpenLightbox?: (urls: string[], index: number) => void;
};

export default function SightingsFeed({
  viewpointId,
  refreshKey,
  onOpenLightbox,
}: Props) {
  const { session } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);

  async function handleDelete(row: Row) {
    if (!session || row.user_id !== session.user.id) return;
    const ok = await confirmAsync("Delete this sighting? This can't be undone.");
    if (!ok) return;

    // Best-effort: delete storage objects (RLS allows because we own the
    // parent sighting). Then delete the sighting row — sighting_images rows
    // cascade-delete with the parent.
    if (row.sighting_images?.length) {
      const paths = row.sighting_images.map((i) => i.storage_path);
      await supabase.storage.from("sightings").remove(paths);
    }
    const { error } = await supabase
      .from("sightings")
      .delete()
      .eq("id", row.id);
    if (error) {
      // eslint-disable-next-line no-console
      console.warn("[feed] delete failed", error.message);
      Platform.OS === "web"
        ? // eslint-disable-next-line no-alert
          window.alert(`Delete failed: ${error.message}`)
        : Alert.alert("Delete failed", error.message);
      return;
    }
    setRows((prev) => prev?.filter((r) => r.id !== row.id) ?? null);
  }

  useEffect(() => {
    let cancelled = false;
    setRows(null);

    (async () => {
      const { data, error } = await supabase
        .from("sightings")
        .select(
          "id, user_id, observed_at, observed_on, visible, visibility, conditions, notes, profiles(display_name, avatar_url), sighting_images(id, storage_path)",
        )
        .eq("viewpoint_id", viewpointId)
        .order("observed_at", { ascending: false })
        .limit(25);

      if (cancelled) return;
      if (error) {
        // eslint-disable-next-line no-console
        console.warn("[feed] load failed", error.message);
        setRows([]);
        return;
      }
      setRows((data as unknown as Row[]) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [viewpointId, refreshKey]);

  if (rows === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (rows.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>
          No sightings here yet. Be the first to log one above.
        </Text>
      </View>
    );
  }

  const today = viewpointDateKey();

  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.feedTitle}>Recent sightings</Text>
      {rows.map((r) => {
        const isToday = r.observed_on === today;
        const name =
          r.profiles?.display_name ??
          r.user_id.slice(0, 6).toUpperCase();
        const initial = (name?.[0] ?? "?").toUpperCase();

        return (
          <View
            key={r.id}
            style={[styles.row, isToday && styles.rowToday]}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.rowHeader}>
                <Text numberOfLines={1} style={styles.rowName}>
                  {name}
                </Text>
                <Text style={styles.rowTime}>
                  {formatViewpointDay(r.observed_at)} ·{" "}
                  {formatViewpointTime(r.observed_at)}
                </Text>
                {session?.user.id === r.user_id ? (
                  <Pressable
                    onPress={() => handleDelete(r)}
                    hitSlop={6}
                    style={styles.deleteBtn}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={14}
                      color={colors.clay}
                    />
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.rowMetaRow}>
                <Badge
                  label={r.visible ? "Visible" : "Not visible"}
                  tint={r.visible ? colors.forestSoft : colors.clay}
                />
                {r.conditions ? (
                  <Badge label={r.conditions} tint={colors.glacier} />
                ) : null}
                {typeof r.visibility === "number" ? (
                  <Badge
                    label={`${r.visibility}/10`}
                    tint={colors.textSecondary}
                  />
                ) : null}
              </View>
              {r.notes ? <Text style={styles.notes}>{r.notes}</Text> : null}
              {r.sighting_images?.length ? (
                <View style={styles.photoStrip}>
                  {(() => {
                    const urls = r.sighting_images.map(
                      (img) =>
                        supabase.storage
                          .from("sightings")
                          .getPublicUrl(img.storage_path).data.publicUrl,
                    );
                    return (
                      <>
                        {r.sighting_images.slice(0, 3).map((img, i) => (
                          <Pressable
                            key={img.id}
                            onPress={() => onOpenLightbox?.(urls, i)}
                          >
                            <Image
                              source={{ uri: urls[i] }}
                              style={styles.photo}
                            />
                          </Pressable>
                        ))}
                        {r.sighting_images.length > 3 ? (
                          <Pressable
                            style={styles.photoMore}
                            onPress={() => onOpenLightbox?.(urls, 3)}
                          >
                            <Text style={styles.photoMoreText}>
                              +{r.sighting_images.length - 3}
                            </Text>
                          </Pressable>
                        ) : null}
                      </>
                    );
                  })()}
                </View>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Badge({ label, tint }: { label: string; tint: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: tint }]}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { padding: 24, alignItems: "center" },
  empty: { paddingVertical: 16, alignItems: "center" },
  emptyText: { color: colors.textSecondary, fontSize: 13 },
  feedTitle: { fontSize: 14, fontWeight: "700", color: colors.text },

  row: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceSoft,
  },
  rowToday: {
    backgroundColor: colors.peakSoft,
    borderWidth: 1,
    borderColor: colors.peak,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.forest,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.textOn, fontWeight: "700" },
  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 8,
  },
  rowName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    flexShrink: 1,
  },
  rowTime: { fontSize: 11, color: colors.textSecondary },
  rowMetaRow: { flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" },
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  badgeText: {
    color: colors.textOn,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  notes: { fontSize: 13, color: colors.text, marginTop: 6, lineHeight: 18 },
  photoStrip: { flexDirection: "row", gap: 6, marginTop: 8 },
  photo: {
    width: 64,
    height: 64,
    borderRadius: radii.sm,
    backgroundColor: colors.border,
  },
  photoMore: {
    width: 64,
    height: 64,
    borderRadius: radii.sm,
    backgroundColor: colors.forest,
    alignItems: "center",
    justifyContent: "center",
  },
  photoMoreText: { color: colors.textOn, fontWeight: "700", fontSize: 13 },
  deleteBtn: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
});
