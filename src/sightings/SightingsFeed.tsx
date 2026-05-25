import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";
import {
  formatViewpointDay,
  formatViewpointTime,
  viewpointDateKey,
} from "../lib/time";

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
};

export default function SightingsFeed({ viewpointId, refreshKey }: Props) {
  const [rows, setRows] = useState<Row[] | null>(null);

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
                  {formatViewpointDay(r.observed_at)} · {formatViewpointTime(r.observed_at)}
                </Text>
              </View>
              <View style={styles.rowMetaRow}>
                <Badge
                  label={r.visible ? "Visible" : "Not visible"}
                  tint={r.visible ? "#16A34A" : "#DC2626"}
                />
                {r.conditions ? (
                  <Badge label={r.conditions} tint="#0F172A" />
                ) : null}
                {typeof r.visibility === "number" ? (
                  <Badge label={`${r.visibility}/10`} tint="#475569" />
                ) : null}
              </View>
              {r.notes ? <Text style={styles.notes}>{r.notes}</Text> : null}
              {r.sighting_images?.length ? (
                <View style={styles.photoStrip}>
                  {r.sighting_images.slice(0, 3).map((img) => {
                    const url = supabase.storage
                      .from("sightings")
                      .getPublicUrl(img.storage_path).data.publicUrl;
                    return (
                      <Image
                        key={img.id}
                        source={{ uri: url }}
                        style={styles.photo}
                      />
                    );
                  })}
                  {r.sighting_images.length > 3 ? (
                    <View style={styles.photoMore}>
                      <Text style={styles.photoMoreText}>
                        +{r.sighting_images.length - 3}
                      </Text>
                    </View>
                  ) : null}
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
  emptyText: { color: "#64748B", fontSize: 13 },
  feedTitle: { fontSize: 14, fontWeight: "700", color: "#0F172A" },

  row: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
  },
  rowToday: { backgroundColor: "#FEF3C7" },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#FFFFFF", fontWeight: "700" },
  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 8,
  },
  rowName: { fontSize: 14, fontWeight: "700", color: "#0F172A", flexShrink: 1 },
  rowTime: { fontSize: 11, color: "#64748B" },
  rowMetaRow: { flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  notes: { fontSize: 13, color: "#334155", marginTop: 6, lineHeight: 18 },
  photoStrip: { flexDirection: "row", gap: 6, marginTop: 8 },
  photo: { width: 64, height: 64, borderRadius: 8, backgroundColor: "#E2E8F0" },
  photoMore: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
  },
  photoMoreText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
});
