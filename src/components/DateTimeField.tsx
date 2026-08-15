import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { colors, radii } from "../theme";
import { formatViewpointDate, formatViewpointTime } from "../lib/time";
import {
  isoFromLocalWallClock,
  viewpointWallClockAsLocalDate,
  type ObservedAtSource,
} from "../lib/observedAt";

// "When did you see it?" — native build. Opens the system calendar for the
// date and the system clock for the time, both capped at now.
//
// Web uses DateTimeField.web.tsx instead: @react-native-community/datetimepicker
// has no web support, and the browser's own date/time inputs are better there.
//
// Timezone note: the native picker only speaks device-local time, while the
// data model is viewpoint time (America/Los_Angeles). The value handed to the
// picker is shifted so its device-local wall clock reads as viewpoint wall
// clock, and the result is read back the same way — so "3 PM" always means
// 3 PM at the mountain, whatever timezone the phone is in.

type Props = {
  value: string;
  source: ObservedAtSource;
  onChange: (iso: string, source: ObservedAtSource) => void;
};

type OpenPicker = "date" | "time" | null;

export default function DateTimeField({ value, source, onChange }: Props) {
  const [open, setOpen] = useState<OpenPicker>(null);
  const isNow = source === "now";
  const fromPhoto = source === "exif";

  function handlePicked(event: DateTimePickerEvent, picked?: Date) {
    setOpen(null);
    // Android reports a cancelled dialog rather than returning no value.
    if (event.type === "dismissed" || !picked) return;
    onChange(isoFromLocalWallClock(picked), "manual");
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

        <FieldButton
          icon="calendar-outline"
          label={formatViewpointDate(value)}
          onPress={() => setOpen("date")}
        />
        <FieldButton
          icon="time-outline"
          label={formatViewpointTime(value)}
          onPress={() => setOpen("time")}
        />
      </View>

      {open !== null ? (
        <DateTimePicker
          mode={open}
          value={viewpointWallClockAsLocalDate(value)}
          // No future observations: migration 0016 rejects them outright.
          maximumDate={new Date()}
          onChange={handlePicked}
        />
      ) : null}

      {fromPhoto ? (
        <View style={styles.summaryRow}>
          <Ionicons name="image-outline" size={13} color={colors.textSecondary} />
          <Text style={styles.summaryText}>Taken from your photo</Text>
        </View>
      ) : null}
    </View>
  );
}

function FieldButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.field, pressed && { opacity: 0.75 }]}
    >
      <Ionicons name={icon} size={15} color={colors.textSecondary} />
      <Text style={styles.fieldText}>{label}</Text>
    </Pressable>
  );
}

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
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  fieldText: { fontSize: 13, fontWeight: "700", color: colors.text },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  summaryText: { fontSize: 12, color: colors.textSecondary, fontWeight: "600" },
});
