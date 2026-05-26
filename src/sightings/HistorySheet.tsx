import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import BottomSheet from "../components/BottomSheet";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthContext";
import { colors, radii } from "../theme";
import {
  formatViewpointDay,
  formatViewpointTime,
} from "../lib/time";

type Row = {
  id: string;
  observed_at: string;
  observed_on: string;
  visible: boolean;
  visibility: number | null;
  conditions: string | null;
  notes: string | null;
  viewpoints: {
    id: string;
    name: string;
    subjects: { id: string; name: string } | null;
  } | null;
  sighting_images: { storage_path: string }[];
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onPickViewpoint: (viewpointId: string) => void;
};

export default function HistorySheet({
  visible,
  onClose,
  onPickViewpoint,
}: Props) {
  const { session } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    if (!visible || !session) return;
    let cancelled = false;
    setRows(null);

    (async () => {
      const { data, error } = await supabase
        .from("sightings")
        .select(
          "id, observed_at, observed_on, visible, visibility, conditions, notes, viewpoints(id, name, subjects(id, name)), sighting_images(storage_path)",
        )
        .eq("user_id", session.user.id)
        .order("observed_at", { ascending: false })
        .limit(30);
      if (cancelled) return;
      if (error) {
        // eslint-disable-next-line no-console
        console.warn("[history] load failed", error.message);
        setRows([]);
        return;
      }
      setRows((data as unknown as Row[]) ?? []);
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, session?.user.id]);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Your sightings"
      subtitle={
        rows === null
          ? undefined
          : rows.length === 0
            ? "Log a sighting from any viewpoint to see it here."
            : `Last ${rows.length}`
      }
    >
      {rows === null ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            You haven't logged any sightings yet. Tap a viewpoint pin and
            answer "Can you see it?" to start your history.
          </Text>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {rows.map((r) => {
            const subject = r.viewpoints?.subjects?.name ?? "—";
            const vpName = r.viewpoints?.name ?? "Unknown";
            const firstImg = r.sighting_images?.[0]?.storage_path;
            const thumbUrl = firstImg
              ? supabase.storage.from("sightings").getPublicUrl(firstImg).data
                  .publicUrl
              : null;

            return (
              <Pressable
                key={r.id}
                onPress={() => {
                  if (!r.viewpoints?.id) return;
                  onClose();
                  setTimeout(() => onPickViewpoint(r.viewpoints!.id), 50);
                }}
                style={styles.row}
              >
                {thumbUrl ? (
                  <Image source={{ uri: thumbUrl }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbPlaceholder]}>
                    <Ionicons
                      name={r.visible ? "eye-outline" : "eye-off-outline"}
                      size={20}
                      color={colors.textSecondary}
                    />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <View style={styles.headerLine}>
                    <Text numberOfLines={1} style={styles.name}>
                      {vpName}
                    </Text>
                    <Text style={styles.time}>
                      {formatViewpointDay(r.observed_at)} ·{" "}
                      {formatViewpointTime(r.observed_at)}
                    </Text>
                  </View>
                  <Text style={styles.subject}>View of {subject}</Text>
                  <View style={styles.metaRow}>
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
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </BottomSheet>
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
  emptyText: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  row: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: radii.sm,
    backgroundColor: colors.border,
  },
  thumbPlaceholder: {
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  headerLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 8,
  },
  name: { fontSize: 14, fontWeight: "700", color: colors.text, flexShrink: 1 },
  time: { fontSize: 11, color: colors.textSecondary },
  subject: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  metaRow: { flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" },
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
});
