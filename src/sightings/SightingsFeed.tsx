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
import ReportSheet from "../components/ReportSheet";
import BottomSheet from "../components/BottomSheet";
import EditTimeSheet, { type EditTimeTarget } from "./EditTimeSheet";
import SightingHistorySheet, { type HistoryTarget } from "./SightingHistorySheet";
import { wasLoggedLater } from "../lib/observedAt";

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
  // Immutable server-side upload time. Used to disclose backdated entries and
  // to show "originally uploaded" in the history sheet.
  created_at: string | null;
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
  const { session, openAuthSheet } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [reportingSightingId, setReportingSightingId] = useState<string | null>(
    null,
  );
  const [menuRow, setMenuRow] = useState<Row | null>(null);
  const [editTarget, setEditTarget] = useState<EditTimeTarget | null>(null);
  const [historyTarget, setHistoryTarget] = useState<HistoryTarget | null>(null);
  // Bumped after an in-feed edit so the list refetches without the parent
  // having to own a refresh key for changes it did not initiate.
  const [localRefresh, setLocalRefresh] = useState(0);

  function handleReport(row: Row) {
    setMenuRow(null);
    if (!session) {
      openAuthSheet();
      return;
    }
    setReportingSightingId(row.id);
  }

  function openHistory(row: Row) {
    setMenuRow(null);
    setHistoryTarget({
      id: row.id,
      observed_at: row.observed_at,
      created_at: row.created_at,
    });
  }

  function openEditTime(row: Row) {
    setMenuRow(null);
    setEditTarget({ id: row.id, observed_at: row.observed_at });
  }

  async function handleDelete(row: Row) {
    setMenuRow(null);
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
          "id, user_id, observed_at, observed_on, created_at, visible, visibility, conditions, notes, profiles(display_name, avatar_url), sighting_images(id, storage_path)",
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
  }, [viewpointId, refreshKey, localRefresh]);

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
      <ReportSheet
        target={
          reportingSightingId
            ? { type: "sighting", id: reportingSightingId }
            : null
        }
        onClose={() => setReportingSightingId(null)}
      />
      <EditTimeSheet
        target={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={() => setLocalRefresh((n) => n + 1)}
      />
      <SightingHistorySheet
        target={historyTarget}
        onClose={() => setHistoryTarget(null)}
      />
      <BottomSheet
        visible={menuRow !== null}
        onClose={() => setMenuRow(null)}
        title="Sighting options"
      >
        {menuRow ? (
          <View style={{ gap: 4 }}>
            <MenuAction
              icon="time-outline"
              label="View sighting history"
              onPress={() => openHistory(menuRow)}
            />
            {session?.user.id === menuRow.user_id ? (
              <>
                <MenuAction
                  icon="create-outline"
                  label="Update observation time"
                  onPress={() => openEditTime(menuRow)}
                />
                <MenuAction
                  icon="trash-outline"
                  label="Delete sighting"
                  tint={colors.clay}
                  onPress={() => handleDelete(menuRow)}
                />
              </>
            ) : (
              <MenuAction
                icon="flag-outline"
                label="Report this sighting"
                onPress={() => handleReport(menuRow)}
              />
            )}
          </View>
        ) : null}
      </BottomSheet>
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
                <Pressable
                  onPress={() => setMenuRow(r)}
                  hitSlop={6}
                  style={styles.iconBtn}
                >
                  <Ionicons
                    name="ellipsis-horizontal"
                    size={16}
                    color={colors.textTertiary}
                  />
                </Pressable>
              </View>
              {wasLoggedLater(r.observed_at, r.created_at) ? (
                <Pressable onPress={() => openHistory(r)}>
                  <Text style={styles.loggedLater}>
                    logged later · view history
                  </Text>
                </Pressable>
              ) : null}
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

function MenuAction({
  icon,
  label,
  tint,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tint?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuAction,
        pressed && { backgroundColor: colors.surfaceSoft },
      ]}
    >
      <Ionicons name={icon} size={18} color={tint ?? colors.textSecondary} />
      <Text style={[styles.menuActionText, tint ? { color: tint } : null]}>
        {label}
      </Text>
    </Pressable>
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
  loggedLater: {
    fontSize: 10,
    color: colors.ember,
    fontWeight: "700",
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  menuAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: radii.md,
  },
  menuActionText: { fontSize: 15, fontWeight: "600", color: colors.text },
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
  iconBtn: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
});
