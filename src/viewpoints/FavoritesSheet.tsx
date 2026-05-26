import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import BottomSheet from "../components/BottomSheet";
import { useFavorites } from "../data/useFavorites";
import type { Subject, Viewpoint } from "../data/types";
import { colors, radii } from "../theme";

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
          ? "Tap Save inside any viewpoint to add it here."
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
            <View key={viewpoint.id} style={styles.row}>
              <Pressable
                style={styles.rowBody}
                onPress={() => {
                  onClose();
                  // Defer slightly so the close animation can start cleanly
                  // before the next sheet opens — avoids a visual stutter on web.
                  setTimeout(() => onPickViewpoint(viewpoint.id), 50);
                }}
              >
                <View style={styles.iconBubble}>
                  <Ionicons name="bookmark" size={16} color={colors.ember} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={styles.name}>
                    {viewpoint.name}
                  </Text>
                  {subject ? (
                    <Text style={styles.subjectLine}>
                      View of {subject.name}
                    </Text>
                  ) : null}
                  {viewpoint.description ? (
                    <Text numberOfLines={1} style={styles.description}>
                      {viewpoint.description}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
              <Pressable
                hitSlop={10}
                onPress={() => toggle(viewpoint.id)}
                style={styles.removeBtn}
              >
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  empty: { paddingVertical: 16, alignItems: "center" },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
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
    backgroundColor: colors.peakSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontSize: 14, fontWeight: "700", color: colors.text },
  subjectLine: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  description: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  removeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  removeText: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },
});
