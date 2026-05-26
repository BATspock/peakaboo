import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import BottomSheet from "../components/BottomSheet";
import SightingForm from "./SightingForm";
import SightingsFeed from "./SightingsFeed";
import ViewpointRating from "../viewpoints/ViewpointRating";
import ImageLightbox from "../components/ImageLightbox";
import { useAuth } from "../auth/AuthContext";
import { useFavorites } from "../data/useFavorites";
import { openInMaps } from "../lib/maps";
import type { Subject, Viewpoint } from "../data/types";
import { colors, radii } from "../theme";

type Props = {
  viewpoint: Viewpoint | null;
  subject: Subject | null;
  onClose: () => void;
};

export default function ViewpointSheet({ viewpoint, subject, onClose }: Props) {
  const { session, signInWithGoogle } = useAuth();
  const { has, toggle } = useFavorites();
  const [refreshKey, setRefreshKey] = useState(0);
  const [lightbox, setLightbox] = useState<{
    urls: string[];
    index: number;
  } | null>(null);

  const isFav = viewpoint ? has(viewpoint.id) : false;

  function handleNavigate() {
    if (!viewpoint) return;
    openInMaps({
      latitude: viewpoint.latitude,
      longitude: viewpoint.longitude,
      label: viewpoint.name,
    });
  }

  async function handleFavorite() {
    if (!viewpoint) return;
    if (!session) {
      signInWithGoogle().catch(() => undefined);
      return;
    }
    await toggle(viewpoint.id);
  }

  return (
    <>
      <BottomSheet
        visible={!!viewpoint}
        onClose={onClose}
        title={viewpoint?.name ?? ""}
        subtitle={subject ? `View of ${subject.name}` : undefined}
      >
        {viewpoint && subject ? (
          <View style={{ gap: 24 }}>
            <View style={styles.actionRow}>
              <Pressable onPress={handleNavigate} style={styles.actionBtn}>
                <Text style={styles.actionIcon}>↗</Text>
                <Text style={styles.actionText}>Directions</Text>
              </Pressable>
              <Pressable
                onPress={handleFavorite}
                style={[styles.actionBtn, isFav && styles.actionBtnActive]}
              >
                <Text
                  style={[
                    styles.actionIcon,
                    isFav && styles.actionIconActive,
                  ]}
                >
                  {isFav ? "★" : "☆"}
                </Text>
                <Text
                  style={[
                    styles.actionText,
                    isFav && styles.actionTextActive,
                  ]}
                >
                  {isFav ? "Saved" : session ? "Save" : "Sign in to save"}
                </Text>
              </Pressable>
            </View>

            <SightingForm
              viewpointId={viewpoint.id}
              subjectName={subject.name}
              onSaved={() => setRefreshKey((k) => k + 1)}
              onOpenLightbox={(urls, index) => setLightbox({ urls, index })}
            />
            <ViewpointRating viewpointId={viewpoint.id} />
            <SightingsFeed
              viewpointId={viewpoint.id}
              refreshKey={refreshKey}
              onOpenLightbox={(urls, index) => setLightbox({ urls, index })}
            />
          </View>
        ) : null}
      </BottomSheet>

      <ImageLightbox
        urls={lightbox?.urls ?? []}
        index={lightbox?.index ?? null}
        onClose={() => setLightbox(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  actionRow: { flexDirection: "row", gap: 8 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionBtnActive: {
    backgroundColor: colors.peakSoft,
    borderColor: colors.peak,
  },
  actionIcon: { fontSize: 16, color: colors.text, fontWeight: "700" },
  actionIconActive: { color: colors.ember },
  actionText: { fontSize: 13, fontWeight: "700", color: colors.text },
  actionTextActive: { color: colors.emberDark },
});
