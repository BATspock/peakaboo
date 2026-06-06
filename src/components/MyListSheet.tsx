import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import BottomSheet from "./BottomSheet";
import { useAuth } from "../auth/AuthContext";
import {
  useSubjectPins,
  SUBJECT_PINS_MAX,
} from "../data/useSubjectPins";
import type { Subject } from "../data/types";
import { colors, radii } from "../theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  subjects: Subject[];
  activeSubjectId: string | null;
  onPickSubject: (subjectId: string) => void;
};

// "My List" — the user's saved spots (subject_pins). View / pick / remove,
// plus a filter-to-add control. Up to SUBJECT_PINS_MAX entries. Mirrors the
// FavoritesSheet structure; pin state comes from the useSubjectPins context.
export default function MyListSheet({
  visible,
  onClose,
  subjects,
  activeSubjectId,
  onPickSubject,
}: Props) {
  const { session, openAuthSheet } = useAuth();
  const { pins, pinnedIds, canPin, pin, unpin } = useSubjectPins();
  const [filter, setFilter] = useState("");

  const trimmed = filter.trim().toLowerCase();
  const addResults = useMemo(() => {
    if (trimmed.length === 0) return [];
    return subjects
      .filter(
        (s) => !pinnedIds.has(s.id) && s.name.toLowerCase().includes(trimmed),
      )
      .slice(0, 8);
  }, [subjects, trimmed, pinnedIds]);

  const full = pins.length >= SUBJECT_PINS_MAX;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="My List"
      subtitle={
        session
          ? `${pins.length}/${SUBJECT_PINS_MAX} saved`
          : "Your quick-access spots"
      }
    >
      <View style={{ gap: 16 }}>
        {/* ── Saved spots ─────────────────────────────────────────── */}
        {pins.length === 0 ? (
          <Text style={styles.emptyText}>
            No spots saved yet. Add the landmarks you check often so they're
            one tap away.
          </Text>
        ) : (
          <View style={{ gap: 8 }}>
            {pins.map((s) => {
              const active = activeSubjectId === s.id;
              return (
                <View key={s.id} style={styles.row}>
                  <Pressable
                    style={styles.rowBody}
                    onPress={() => {
                      onClose();
                      setTimeout(() => onPickSubject(s.id), 50);
                    }}
                  >
                    <View style={styles.iconBubble}>
                      <Ionicons
                        name="triangle"
                        size={15}
                        color={colors.forest}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={styles.name}>
                        {s.name}
                      </Text>
                      <Text style={styles.kindLine}>
                        {prettyKind(s.kind)}
                        {active ? " · viewing" : ""}
                      </Text>
                    </View>
                  </Pressable>
                  {session ? (
                    <Pressable
                      hitSlop={10}
                      onPress={() => unpin(s.id)}
                      style={styles.removeBtn}
                    >
                      <Text style={styles.removeText}>Remove</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}

        {/* ── Add control ─────────────────────────────────────────── */}
        {!session ? (
          <Pressable style={styles.primaryBtn} onPress={openAuthSheet}>
            <Text style={styles.primaryBtnText}>Sign in to save spots</Text>
          </Pressable>
        ) : full ? (
          <Text style={styles.fullNote}>
            List full ({SUBJECT_PINS_MAX}/{SUBJECT_PINS_MAX}). Remove a spot to
            add another.
          </Text>
        ) : (
          <View style={{ gap: 8 }}>
            <Text style={styles.addLabel}>Add a spot</Text>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={14} color={colors.textTertiary} />
              <TextInput
                style={styles.searchInput}
                value={filter}
                onChangeText={setFilter}
                placeholder="Filter your landmarks by name…"
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

            {trimmed.length > 0 && addResults.length === 0 ? (
              <Text style={styles.noMatch}>
                No matching landmarks. Add new ones with the + button on the map.
              </Text>
            ) : null}

            {addResults.map((s) => (
              <Pressable
                key={s.id}
                style={styles.addRow}
                onPress={() => {
                  if (canPin) pin(s.id);
                  setFilter("");
                }}
              >
                <Ionicons name="add-circle" size={18} color={colors.forestSoft} />
                <Text numberOfLines={1} style={styles.addRowText}>
                  {s.name}
                </Text>
                <Text style={styles.addRowKind}>{prettyKind(s.kind)}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </BottomSheet>
  );
}

function prettyKind(k: string): string {
  return k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const styles = StyleSheet.create({
  emptyText: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    paddingVertical: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingRight: 12,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowBody: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingLeft: 12,
  },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.leafBg,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontSize: 14, fontWeight: "700", color: colors.text },
  kindLine: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  removeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  removeText: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },

  addLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
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
  searchInput: { flex: 1, fontSize: 13, color: colors.text, padding: 0 },
  noMatch: { fontSize: 12, color: colors.textSecondary, paddingVertical: 4 },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceSoft,
  },
  addRowText: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.text },
  addRowKind: { fontSize: 11, color: colors.textTertiary, fontWeight: "600" },

  fullNote: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: "center",
    paddingVertical: 4,
  },
  primaryBtn: {
    backgroundColor: colors.forestSoft,
    paddingVertical: 14,
    borderRadius: radii.md,
    alignItems: "center",
  },
  primaryBtnText: { color: colors.textOn, fontWeight: "700", fontSize: 15 },
});
