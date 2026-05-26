import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { useFavorites } from "../data/useFavorites";
import { colors, radii } from "../theme";

type Props = {
  onPress: () => void;
};

export default function FavoritesButton({ onPress }: Props) {
  const { session } = useAuth();
  const { ids } = useFavorites();

  if (!session) return null;

  return (
    <Pressable onPress={onPress} style={styles.btn} hitSlop={6}>
      <Text style={styles.icon}>★</Text>
      {ids.size > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{ids.size}</Text>
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
    backgroundColor: colors.peakSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: { fontSize: 18, color: colors.ember },
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
