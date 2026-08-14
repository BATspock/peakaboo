import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import BottomSheet from "../components/BottomSheet";
import { supabase } from "../lib/supabase";
import { colors, radii } from "../theme";
import { formatViewpointDate, formatViewpointTime } from "../lib/time";

// Public provenance for a sighting: when it was actually uploaded, what time
// it currently claims to have been observed, and every change in between.
// Readable by anyone (migration 0017) — backdating is only trustworthy if the
// trail is visible to the people reading the feed.

export type HistoryTarget = {
  id: string;
  observed_at: string;
  created_at: string | null;
};

type Edit = {
  id: string;
  previous_observed_at: string;
  new_observed_at: string;
  edited_at: string;
};

type Props = {
  target: HistoryTarget | null;
  onClose: () => void;
};

function formatStamp(iso: string): string {
  return `${formatViewpointDate(iso)} · ${formatViewpointTime(iso)}`;
}

export default function SightingHistorySheet({ target, onClose }: Props) {
  const [edits, setEdits] = useState<Edit[] | null>(null);

  useEffect(() => {
    if (!target) {
      setEdits(null);
      return;
    }
    let cancelled = false;
    setEdits(null);

    (async () => {
      const { data, error } = await supabase
        .from("sighting_time_edits")
        .select("id, previous_observed_at, new_observed_at, edited_at")
        .eq("sighting_id", target.id)
        .order("edited_at", { ascending: false });

      if (cancelled) return;
      if (error) {
        // eslint-disable-next-line no-console
        console.warn("[history] load failed", error.message);
        setEdits([]);
        return;
      }
      setEdits((data as Edit[]) ?? []);
    })();

    return () => {
      cancelled = true;
    };
  }, [target?.id]);

  return (
    <BottomSheet
      visible={target !== null}
      onClose={onClose}
      title="Sighting history"
      subtitle="Original upload time and any changes since"
    >
      {target ? (
        <View style={{ gap: 14 }}>
          <Fact
            icon="cloud-upload-outline"
            label="Originally uploaded"
            value={
              target.created_at ? formatStamp(target.created_at) : "Unknown"
            }
          />
          <Fact
            icon="eye-outline"
            label="Observed time (current)"
            value={formatStamp(target.observed_at)}
          />

          <View style={styles.divider} />

          {edits === null ? (
            <ActivityIndicator />
          ) : edits.length === 0 ? (
            <Text style={styles.emptyText}>
              The observation time has never been changed.
            </Text>
          ) : (
            <View style={{ gap: 10 }}>
              <Text style={styles.sectionTitle}>
                Changes · {edits.length}
              </Text>
              {edits.map((e) => (
                <View key={e.id} style={styles.editRow}>
                  <Ionicons
                    name="swap-horizontal"
                    size={14}
                    color={colors.ember}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.editText}>
                      Moved from {formatStamp(e.previous_observed_at)} to{" "}
                      {formatStamp(e.new_observed_at)}
                    </Text>
                    <Text style={styles.editMeta}>
                      Changed {formatStamp(e.edited_at)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      ) : null}
    </BottomSheet>
  );
}

function Fact({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.factRow}>
      <Ionicons name={icon} size={16} color={colors.textSecondary} />
      <View style={{ flex: 1 }}>
        <Text style={styles.factLabel}>{label}</Text>
        <Text style={styles.factValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  factRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  factLabel: { fontSize: 11, color: colors.textTertiary, fontWeight: "600" },
  factValue: { fontSize: 14, color: colors.text, fontWeight: "700" },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: colors.text },
  emptyText: { fontSize: 13, color: colors.textSecondary },
  editRow: {
    flexDirection: "row",
    gap: 8,
    padding: 10,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceSoft,
  },
  editText: { fontSize: 13, color: colors.text, lineHeight: 18 },
  editMeta: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
});
