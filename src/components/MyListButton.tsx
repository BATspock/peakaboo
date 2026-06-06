import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSubjectPins } from "../data/useSubjectPins";
import { colors, radii } from "../theme";

type Props = {
  onPress: () => void;
};

// "My List" header button — opens the saved-spots sheet. Shown to everyone:
// signed-out users get the read-only curated defaults; signed-in users can
// edit. Badge reflects how many spots are in the list.
export default function MyListButton({ onPress }: Props) {
  const { pins } = useSubjectPins();

  return (
    <Pressable onPress={onPress} style={styles.btn} hitSlop={6}>
      <Ionicons name="bookmarks" size={18} color={colors.forest} />
      {pins.length > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{pins.length}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: radii.pill,
    paddingHorizontal: 5,
    backgroundColor: colors.forest,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: colors.textOn, fontSize: 11, fontWeight: "700" },
});
