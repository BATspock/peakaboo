import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../auth/AuthContext";
import { colors, radii } from "../theme";

type Props = {
  onPress: () => void;
};

export default function HistoryButton({ onPress }: Props) {
  const { session } = useAuth();
  if (!session) return null;
  return (
    <Pressable onPress={onPress} style={styles.btn} hitSlop={6}>
      <Ionicons name="time-outline" size={18} color={colors.forest} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.leafBg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.leaf,
  },
});
