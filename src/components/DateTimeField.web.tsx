import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii } from "../theme";
import {
  isoFromViewpointDateTime,
  todayViewpointDateInputValue,
  viewpointDateInputValue,
  viewpointTimeInputValue,
  type ObservedAtSource,
} from "../lib/observedAt";

// "When did you see it?" — web build, auto-selected by Metro over
// DateTimeField.tsx (same convention as MapView.web.tsx).
//
// Uses the browser's own <input type="date"> and <input type="time">: a real
// calendar and clock, keyboard-accessible, localised by the OS, and zero extra
// bundle weight. `max` caps the calendar at today, so future dates cannot be
// picked at all — migration 0016 is the server-side backstop.
//
// Raw DOM elements are legitimate here: react-native-web renders to the DOM,
// and this file is only ever bundled for web.

type Props = {
  value: string;
  source: ObservedAtSource;
  onChange: (iso: string, source: ObservedAtSource) => void;
};

export default function DateTimeField({ value, source, onChange }: Props) {
  const isNow = source === "now";
  const fromPhoto = source === "exif";

  const dateValue = viewpointDateInputValue(value);
  const timeValue = viewpointTimeInputValue(value);

  function commit(nextDate: string, nextTime: string) {
    onChange(isoFromViewpointDateTime(nextDate, nextTime, value), "manual");
  }

  return (
    <View style={{ gap: 10 }}>
      <View style={styles.row}>
        <Pressable
          onPress={() => onChange(new Date().toISOString(), "now")}
          style={[styles.nowChip, isNow && styles.nowChipActive]}
        >
          <Text style={[styles.nowChipText, isNow && styles.nowChipTextActive]}>
            Now
          </Text>
        </Pressable>

        <input
          type="date"
          aria-label="Date you saw it"
          value={dateValue}
          max={todayViewpointDateInputValue()}
          onChange={(e) => commit(e.target.value, timeValue)}
          style={inputStyle}
        />
        <input
          type="time"
          aria-label="Time you saw it"
          value={timeValue}
          onChange={(e) => commit(dateValue, e.target.value)}
          style={inputStyle}
        />
      </View>

      {fromPhoto ? (
        <View style={styles.summaryRow}>
          <Ionicons name="image-outline" size={13} color={colors.textSecondary} />
          <Text style={styles.summaryText}>Taken from your photo</Text>
        </View>
      ) : null}
    </View>
  );
}

// Plain CSS rather than StyleSheet: these are DOM nodes, not RN views.
const inputStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: colors.text,
  backgroundColor: colors.surface,
  border: `1.5px solid ${colors.border}`,
  borderRadius: radii.md,
  padding: "8px 10px",
  fontFamily: "inherit",
};

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  nowChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceSoft,
  },
  nowChipActive: { backgroundColor: colors.forest },
  nowChipText: { color: colors.textSecondary, fontWeight: "700", fontSize: 13 },
  nowChipTextActive: { color: colors.textOn },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  summaryText: { fontSize: 12, color: colors.textSecondary, fontWeight: "600" },
});
