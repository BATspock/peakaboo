import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors, radii } from "../theme";

const STORAGE_KEY = "peakaboo:welcome-dismissed-v1";

export default function WelcomeBanner() {
  // null = unknown (loading), true = visible, false = dismissed
  const [visible, setVisible] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (cancelled) return;
      setVisible(v !== "1");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!visible) return null;

  function dismiss() {
    AsyncStorage.setItem(STORAGE_KEY, "1").catch(() => undefined);
    setVisible(false);
  }

  return (
    <View style={styles.container}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Welcome to PeakAboo 🌲</Text>
        <Text style={styles.body}>
          Tap a viewpoint pin to see if Mt Rainier, Adams, or Baker is visible
          today. Sign in to log your own sightings and save your favorite spots.
        </Text>
      </View>
      <Pressable hitSlop={8} onPress={dismiss} style={styles.closeBtn}>
        <Text style={styles.closeText}>✕</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: colors.leafBg,
    borderRadius: radii.md,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.leaf,
  },
  title: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.forest,
    marginBottom: 2,
  },
  body: { fontSize: 12, color: colors.text, lineHeight: 17 },
  closeBtn: {
    width: 24,
    height: 24,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: { fontSize: 14, color: colors.forest, fontWeight: "700" },
});
