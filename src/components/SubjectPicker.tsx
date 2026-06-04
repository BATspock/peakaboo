import React, { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Subject } from "../data/types";
import { useSubjectPins } from "../data/useSubjectPins";
import { getRecentSubjects } from "../data/recentSubjects";
import { colors, radii } from "../theme";

type Props = {
  subjects: Subject[];
  selectedId: string | null;
  onSelect: (subjectId: string) => void;
};

/**
 * Compact subject picker used inside AddViewpointSheet. Shows the user's
 * pinned subjects + recent searches as one-tap chips, with a filter
 * input below to find anything else from the loaded subjects list.
 *
 * Doesn't hit Google Places — that flow is only on the home screen
 * SubjectSearch. Here, the user is picking among subjects PeakAboo
 * already knows about.
 */
export default function SubjectPicker({
  subjects,
  selectedId,
  onSelect,
}: Props) {
  const { pins } = useSubjectPins();
  const [filter, setFilter] = useState("");
  const [recentIds, setRecentIds] = useState<string[]>([]);

  useEffect(() => {
    getRecentSubjects().then(setRecentIds);
  }, []);

  // Resolve recent IDs to actual Subject objects (and dedupe against pins).
  const pinIds = useMemo(() => new Set(pins.map((p) => p.id)), [pins]);
  const subjectById = useMemo(
    () => new Map(subjects.map((s) => [s.id, s])),
    [subjects],
  );
  const recents = useMemo(
    () =>
      recentIds
        .map((id) => subjectById.get(id))
        .filter((s): s is Subject => !!s && !pinIds.has(s.id)),
    [recentIds, subjectById, pinIds],
  );

  const trimmed = filter.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (trimmed.length === 0) return [];
    return subjects.filter((s) => s.name.toLowerCase().includes(trimmed));
  }, [subjects, trimmed]);

  const showShortcuts = trimmed.length === 0;

  return (
    <View style={{ gap: 10 }}>
      {showShortcuts && pins.length > 0 ? (
        <Section title="Pinned">
          <ChipRow>
            {pins.map((s) => (
              <SubjectChip
                key={s.id}
                subject={s}
                active={selectedId === s.id}
                onPress={() => onSelect(s.id)}
              />
            ))}
          </ChipRow>
        </Section>
      ) : null}

      {showShortcuts && recents.length > 0 ? (
        <Section title="Recent">
          <ChipRow>
            {recents.map((s) => (
              <SubjectChip
                key={s.id}
                subject={s}
                active={selectedId === s.id}
                onPress={() => onSelect(s.id)}
              />
            ))}
          </ChipRow>
        </Section>
      ) : null}

      <View style={styles.searchBox}>
        <Ionicons name="search" size={14} color={colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          value={filter}
          onChangeText={setFilter}
          placeholder="Filter by name…"
          placeholderTextColor={colors.textTertiary}
          autoCapitalize="words"
          autoCorrect={false}
        />
        {filter.length > 0 ? (
          <Pressable hitSlop={6} onPress={() => setFilter("")}>
            <Ionicons
              name="close-circle"
              size={14}
              color={colors.textTertiary}
            />
          </Pressable>
        ) : null}
      </View>

      {!showShortcuts ? (
        filtered.length > 0 ? (
          <ChipRow>
            {filtered.slice(0, 12).map((s) => (
              <SubjectChip
                key={s.id}
                subject={s}
                active={selectedId === s.id}
                onPress={() => onSelect(s.id)}
              />
            ))}
          </ChipRow>
        ) : (
          <Text style={styles.empty}>
            No subjects match. Add this place from the home search bar first.
          </Text>
        )
      ) : null}
    </View>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.chipRow}>{children}</View>;
}

function SubjectChip({
  subject,
  active,
  onPress,
}: {
  subject: Subject;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text
        style={[styles.chipText, active && styles.chipTextActive]}
        numberOfLines={1}
      >
        {subject.name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
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
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    padding: 0,
  },
  empty: {
    fontSize: 12,
    color: colors.textSecondary,
    paddingVertical: 6,
  },
});
