import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii } from "../theme";
import { formatViewpointDay, formatViewpointTime } from "../lib/time";
import {
  formatHourLabel,
  hourChoicesForDay,
  isoFromViewpointWallClock,
  recentDays,
  type ObservedAtSource,
} from "../lib/observedAt";

// "When did you see it?" — deliberately zero-dependency so web and native
// behave identically. Default is Now, which costs the user no interaction;
// everything else is one or two taps. Minute precision is intentionally not
// offered manually: EXIF supplies exact minutes when it matters (spec 05).

type Mode = "now" | "today" | "yesterday" | "day";

type Props = {
  value: string;
  source: ObservedAtSource;
  onChange: (iso: string, source: ObservedAtSource) => void;
};

const DEFAULT_PAST_HOUR = 12;

function latestHourToday(): number {
  const choices = hourChoicesForDay(0);
  return choices[choices.length - 1];
}

export default function DateTimeField({ value, source, onChange }: Props) {
  const [mode, setMode] = useState<Mode>("now");
  const [dayOffset, setDayOffset] = useState(0);
  const [hour, setHour] = useState<number>(latestHourToday());

  const fromPhoto = source === "exif";
  const showHours = !fromPhoto && (mode === "today" || mode === "yesterday" || mode === "day");

  function selectNow() {
    setMode("now");
    setDayOffset(0);
    onChange(new Date().toISOString(), "now");
  }

  function selectDay(nextMode: Mode, offset: number, nextHour: number) {
    setMode(nextMode);
    setDayOffset(offset);
    setHour(nextHour);
    onChange(isoFromViewpointWallClock(offset, nextHour), "manual");
  }

  function selectHour(nextHour: number) {
    setHour(nextHour);
    onChange(isoFromViewpointWallClock(dayOffset, nextHour), "manual");
  }

  return (
    <View style={{ gap: 10 }}>
      <View style={styles.chipRow}>
        <Chip
          label="Now"
          active={!fromPhoto && mode === "now"}
          onPress={selectNow}
        />
        <Chip
          label="Earlier today"
          active={!fromPhoto && mode === "today"}
          onPress={() => selectDay("today", 0, latestHourToday())}
        />
        <Chip
          label="Yesterday"
          active={!fromPhoto && mode === "yesterday"}
          onPress={() => selectDay("yesterday", 1, DEFAULT_PAST_HOUR)}
        />
        <Chip
          label="Pick a day"
          active={!fromPhoto && mode === "day"}
          onPress={() => setMode("day")}
        />
      </View>

      {mode === "day" && !fromPhoto ? (
        <ScrollView style={styles.dayList} nestedScrollEnabled>
          {recentDays().map((d) => (
            <Pressable
              key={d.offset}
              onPress={() =>
                selectDay(
                  "day",
                  d.offset,
                  d.offset === 0 ? latestHourToday() : DEFAULT_PAST_HOUR,
                )
              }
              style={[styles.dayRow, dayOffset === d.offset && styles.dayRowActive]}
            >
              <Text
                style={[
                  styles.dayLabel,
                  dayOffset === d.offset && styles.dayLabelActive,
                ]}
              >
                {d.label}
              </Text>
              {dayOffset === d.offset ? (
                <Ionicons name="checkmark" size={15} color={colors.textOn} />
              ) : null}
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {showHours ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.hourRow}
        >
          {hourChoicesForDay(dayOffset).map((h) => (
            <Chip
              key={h}
              label={formatHourLabel(h)}
              active={hour === h}
              onPress={() => selectHour(h)}
            />
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.summaryRow}>
        <Ionicons
          name={fromPhoto ? "image-outline" : "time-outline"}
          size={13}
          color={colors.textSecondary}
        />
        <Text style={styles.summaryText}>
          {formatViewpointDay(value)} · {formatViewpointTime(value)}
          {fromPhoto ? " · from photo" : ""}
        </Text>
      </View>
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceSoft,
  },
  chipActive: { backgroundColor: colors.forest },
  chipText: { color: colors.textSecondary, fontWeight: "600", fontSize: 13 },
  chipTextActive: { color: colors.textOn },

  dayList: {
    maxHeight: 168,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceSoft,
  },
  dayRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dayRowActive: { backgroundColor: colors.forest, borderRadius: radii.md },
  dayLabel: { fontSize: 13, color: colors.text, fontWeight: "600" },
  dayLabelActive: { color: colors.textOn },

  hourRow: { flexDirection: "row", gap: 8, paddingRight: 8 },

  summaryRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  summaryText: { fontSize: 12, color: colors.textSecondary, fontWeight: "600" },
});
