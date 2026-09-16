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

/** Rows fetched per page. Also the "is there another page?" probe: a full
 *  page means there may be more, a short page means we reached the end. */
const PAGE_SIZE = 25;

const SELECT_COLUMNS =
  "id, user_id, observed_at, observed_on, created_at, visible, visibility, conditions, notes, profiles(display_name, avatar_url), sighting_images(id, storage_path)";

/** The last row already on screen. The next page starts strictly after it. */
type Cursor = { observed_at: string; id: string };

/**
 * One page of a viewpoint's sightings, newest first.
 *
 * Keyset, not offset. Offset paging (`.range()`) drifts the moment anybody
 * logs a sighting while the reader is paging: every later row shifts by one,
 * so page 2 repeats a row and skips a row. A cursor naming the last row we
 * showed is immune to inserts.
 *
 * `observed_at` alone is not a total order — two people can log the same
 * minute at the same viewpoint — so `id` is the tiebreak, in both the sort
 * and the cursor. Without it the boundary between pages is nondeterministic
 * and rows fall through the crack.
 */
function sightingsPage(viewpointId: string, cursor: Cursor | null) {
  const query = supabase
    .from("sightings")
    .select(SELECT_COLUMNS)
    .eq("viewpoint_id", viewpointId)
    .order("observed_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE_SIZE);

  if (!cursor) return query;

  // Quoted: the timestamp carries `:`, `.` and `+`, all of which PostgREST
  // would otherwise read as filter syntax inside an `or` group.
  const at = `"${cursor.observed_at}"`;
  return query.or(
    `observed_at.lt.${at},and(observed_at.eq.${at},id.lt.${cursor.id})`,
  );
}

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
  // Whether the last fetch came back full, i.e. there may be older sightings
  // behind it. Drives the "View more" affordance.
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
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

  /** Append the page after the oldest row on screen. */
  async function loadMore() {
    if (loadingMore || !rows?.length) return;
    const last = rows[rows.length - 1];
    setLoadingMore(true);
    const { data, error } = await sightingsPage(viewpointId, {
      observed_at: last.observed_at,
      id: last.id,
    });
    setLoadingMore(false);

    if (error) {
      // eslint-disable-next-line no-console
      console.warn("[feed] load more failed", error.message);
      return;
    }

    const page = (data as unknown as Row[]) ?? [];
    setHasMore(page.length === PAGE_SIZE);
    // Dedupe on id: a sighting backdated into the window we already read
    // could otherwise arrive twice and collide on its React key.
    setRows((prev) => {
      const seen = new Set((prev ?? []).map((r) => r.id));
      return [...(prev ?? []), ...page.filter((r) => !seen.has(r.id))];
    });
  }

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setHasMore(false);

    (async () => {
      const { data, error } = await sightingsPage(viewpointId, null);

      if (cancelled) return;
      if (error) {
        // eslint-disable-next-line no-console
        console.warn("[feed] load failed", error.message);
        setRows([]);
        return;
      }
      const page = (data as unknown as Row[]) ?? [];
      setRows(page);
      setHasMore(page.length === PAGE_SIZE);
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
      {hasMore ? (
        <Pressable
          style={styles.moreBtn}
          onPress={loadMore}
          disabled={loadingMore}
          accessibilityRole="button"
          accessibilityLabel="View more sightings"
          accessibilityState={{ disabled: loadingMore, busy: loadingMore }}
        >
          {loadingMore ? (
            <ActivityIndicator size="small" color={colors.forest} />
          ) : (
            <Text style={styles.moreBtnText}>View more sightings</Text>
          )}
        </Pressable>
      ) : null}
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
  moreBtn: {
    minHeight: 44,
    paddingVertical: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  moreBtnText: { fontSize: 13, fontWeight: "700", color: colors.forest },
  iconBtn: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
});
