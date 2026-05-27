import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";

/**
 * Custom marker for the subject peak. Visually distinct from the
 * Google drop-pins used for viewpoints — round, larger, with a mountain
 * glyph and a contrasting white ring so it pops on any map background.
 */
export default function PeakPin({ label }: { label?: string }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.dot}>
        <Ionicons name="triangle" size={20} color={colors.textOn} />
      </View>
      {label ? (
        <View style={styles.labelWrap}>
          <Text style={styles.label}>{label}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center" },
  dot: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: colors.forest,
    borderWidth: 3,
    borderColor: colors.textOn,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.forest,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  labelWrap: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.forest,
    letterSpacing: 0.2,
  },
});
