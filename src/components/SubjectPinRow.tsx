import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSubjectPins } from "../data/useSubjectPins";
import { useAuth } from "../auth/AuthContext";
import { colors, radii } from "../theme";

type Props = {
  activeSubjectId: string | null;
  onPickSubject: (subjectId: string) => void;
  onAddPress: () => void;
};

export default function SubjectPinRow({
  activeSubjectId,
  onPickSubject,
  onAddPress,
}: Props) {
  const { session } = useAuth();
  const { pins, canPin, unpin } = useSubjectPins();

  if (pins.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {pins.map((s) => {
        const active = activeSubjectId === s.id;
        return (
          <View
            key={s.id}
            style={[styles.pill, active && styles.pillActive]}
          >
            <Pressable
              style={styles.pillBody}
              onPress={() => onPickSubject(s.id)}
            >
              <Text
                style={[styles.pillText, active && styles.pillTextActive]}
                numberOfLines={1}
              >
                {s.name}
              </Text>
            </Pressable>
            {session ? (
              <Pressable
                hitSlop={6}
                onPress={() => unpin(s.id)}
                style={styles.removeBtn}
              >
                <Ionicons
                  name="close"
                  size={12}
                  color={active ? colors.textOn : colors.textTertiary}
                />
              </Pressable>
            ) : null}
          </View>
        );
      })}

      {canPin ? (
        <Pressable onPress={onAddPress} style={styles.addPill}>
          <Ionicons name="add" size={16} color={colors.forest} />
          <Text style={styles.addPillText}>Add</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingTop: 10, alignItems: "center" },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceSoft,
    marginRight: 8,
  },
  pillActive: { backgroundColor: colors.forest },
  pillBody: { paddingVertical: 2 },
  pillText: { color: colors.textSecondary, fontWeight: "600", fontSize: 13 },
  pillTextActive: { color: colors.textOn },
  removeBtn: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
    borderRadius: radii.pill,
  },
  addPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    marginRight: 8,
  },
  addPillText: { color: colors.forest, fontWeight: "700", fontSize: 13 },
});
