import React, { useEffect, useState } from "react";
import {
  Image,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  urls: string[];
  index: number | null;
  onClose: () => void;
};

export default function ImageLightbox({ urls, index, onClose }: Props) {
  const [current, setCurrent] = useState<number>(index ?? 0);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (index !== null) setCurrent(index);
  }, [index]);

  // Web-only: arrow-key navigation.
  useEffect(() => {
    if (Platform.OS !== "web" || index === null) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setCurrent((c) => Math.min(c + 1, urls.length - 1));
      if (e.key === "ArrowLeft") setCurrent((c) => Math.max(c - 1, 0));
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [index, urls.length, onClose]);

  if (index === null || urls.length === 0) return null;

  const url = urls[current];
  const hasPrev = current > 0;
  const hasNext = current < urls.length - 1;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor="rgba(0,0,0,0.92)"
      />
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          onPress={() => undefined}
          style={[styles.imageWrap, { width, height }]}
        >
          <Image
            source={{ uri: url }}
            style={{ width, height: height - 80 }}
            resizeMode="contain"
          />
        </Pressable>
      </Pressable>

      <View
        style={[styles.topBar, { paddingTop: 12 + insets.top }]}
        pointerEvents="box-none"
      >
        <Text style={styles.counter}>
          {current + 1} / {urls.length}
        </Text>
        <Pressable hitSlop={12} onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </View>

      {hasPrev ? (
        <Pressable
          onPress={() => setCurrent(current - 1)}
          style={[styles.navBtn, styles.navLeft]}
        >
          <Text style={styles.navText}>‹</Text>
        </Pressable>
      ) : null}

      {hasNext ? (
        <Pressable
          onPress={() => setCurrent(current + 1)}
          style={[styles.navBtn, styles.navRight]}
        >
          <Text style={styles.navText}>›</Text>
        </Pressable>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  imageWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  counter: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  navBtn: {
    position: "absolute",
    top: "50%",
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    transform: [{ translateY: -24 }],
  },
  navLeft: { left: 16 },
  navRight: { right: 16 },
  navText: { color: "#FFFFFF", fontSize: 28, fontWeight: "700", lineHeight: 30 },
});
