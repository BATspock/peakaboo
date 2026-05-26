import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import BottomSheet from "../components/BottomSheet";
import { useFavorites } from "../data/useFavorites";
import type { Subject, Viewpoint } from "../data/types";

type Props = {
  visible: boolean;
  onClose: () => void;
  subjects: Subject[];
  viewpoints: Viewpoint[];
  onPickViewpoint: (viewpointId: string) => void;
};

export default function FavoritesSheet({
  visible,
  onClose,
  subjects,
  viewpoints,
  onPickViewpoint,
}: Props) {
  const { ids, toggle } = useFavorites();

  const items = useMemo(() => {
    const subjectById = new Map(subjects.map((s) => [s.id, s]));
    return viewpoints
      .filter((v) => ids.has(v.id))
      .map((v) => ({
        viewpoint: v,
        subject: subjectById.get(v.subjectId) ?? null,
      }))
      .sort((a, b) => a.viewpoint.name.localeCompare(b.viewpoint.name));
  }, [ids, viewpoints, subjects]);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Saved viewpoints"
      subtitle={
        items.length === 0
          ? "Tap ☆ Save inside any viewpoint to add it here."
          : `${items.length} saved`
      }
    >
      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            You haven't saved any viewpoints yet. Open a viewpoint pin and tap
            "Save" to keep tabs on it here.
          </Text>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {items.map(({ viewpoint, subject }) => (
            <Pressable
              key={viewpoint.id}
              onPress={() => {
                onClose();
                // Defer to the next tick so the close animation can start before
                // the next sheet opens — avoids a visual stutter on web.
                setTimeout(() => onPickViewpoint(viewpoint.id), 50);
              }}
              style={styles.row}
            >
              <View style={styles.iconBubble}>
                <Text style={styles.iconText}>★</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={styles.name}>
                  {viewpoint.name}
                </Text>
                {subject ? (
                  <Text style={styles.subjectLine}>View of {subject.name}</Text>
                ) : null}
                {viewpoint.description ? (
                  <Text numberOfLines={1} style={styles.description}>
                    {viewpoint.description}
                  </Text>
                ) : null}
              </View>
              <Pressable
                hitSlop={10}
                onPress={(e) => {
                  e.stopPropagation?.();
                  toggle(viewpoint.id);
                }}
                style={styles.removeBtn}
              >
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            </Pressable>
          ))}
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  empty: { paddingVertical: 16, alignItems: "center" },
  emptyText: {
    color: "#64748B",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
  },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: { fontSize: 18, color: "#B45309" },
  name: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  subjectLine: { fontSize: 12, color: "#64748B", marginTop: 1 },
  description: { fontSize: 12, color: "#94A3B8", marginTop: 2 },
  removeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  removeText: { fontSize: 12, fontWeight: "600", color: "#475569" },
});
