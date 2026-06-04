import React from "react";
import {
  Alert,
  Platform,
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
  const { session, openAuthSheet } = useAuth();
  const { pins, canPin, unpin } = useSubjectPins();

  if (pins.length === 0) return null;

  function handleLongPress(subjectId: string, name: string) {
    if (!session) {
      // Signed-out users see read-only defaults. Long-press prompts sign-in.
      openAuthSheet();
      return;
    }
    confirmAsync(`Unpin "${name}"?`).then((ok) => {
      if (ok) unpin(subjectId);
    });
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {pins.map((s) => {
        const active = activeSubjectId === s.id;
        return (
          <Pressable
            key={s.id}
            onPress={() => onPickSubject(s.id)}
            onLongPress={() => handleLongPress(s.id, s.name)}
            delayLongPress={400}
            style={[styles.pill, active && styles.pillActive]}
          >
            <Text
              style={[styles.pillText, active && styles.pillTextActive]}
              numberOfLines={1}
            >
              {s.name}
            </Text>
          </Pressable>
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

function confirmAsync(message: string): Promise<boolean> {
  if (Platform.OS === "web") {
    return Promise.resolve(
      typeof window !== "undefined" ? window.confirm(message) : false,
    );
  }
  return new Promise<boolean>((resolve) => {
    Alert.alert("Unpin", message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: "Unpin", style: "destructive", onPress: () => resolve(true) },
    ]);
  });
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingTop: 10 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceSoft,
    marginRight: 8,
  },
  pillActive: { backgroundColor: colors.forest },
  pillText: { color: colors.textSecondary, fontWeight: "600", fontSize: 13 },
  pillTextActive: { color: colors.textOn },
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
