import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import BottomSheet from "../components/BottomSheet";
import SightingForm from "./SightingForm";
import SightingsFeed from "./SightingsFeed";
import ViewpointRating from "../viewpoints/ViewpointRating";
import ImageLightbox from "../components/ImageLightbox";
import { useAuth } from "../auth/AuthContext";
import { useFavorites } from "../data/useFavorites";
import { openInMaps } from "../lib/maps";
import { shareViewpoint, viewpointShareUrl } from "../lib/share";
import type { Subject, Viewpoint } from "../data/types";
import { colors, radii } from "../theme";

type Props = {
  viewpoint: Viewpoint | null;
  subject: Subject | null;
  onClose: () => void;
};

export default function ViewpointSheet({ viewpoint, subject, onClose }: Props) {
  const { session, openAuthSheet } = useAuth();
  const { has, toggle } = useFavorites();
  const [refreshKey, setRefreshKey] = useState(0);
  const [lightbox, setLightbox] = useState<{
    urls: string[];
    index: number;
  } | null>(null);

  const isFav = viewpoint ? has(viewpoint.id) : false;
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    if (!viewpoint || !subject) return;
    const url = viewpointShareUrl(viewpoint.id);
    const result = await shareViewpoint({
      url,
      viewpointName: viewpoint.name,
      subjectName: subject.name,
    });
    if (result === "copied") {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  }

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
      openAuthSheet();
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
                <Ionicons name="navigate" size={16} color={colors.text} />
                <Text style={styles.actionText}>Directions</Text>
              </Pressable>
              <Pressable
                onPress={handleFavorite}
                style={[styles.actionBtn, isFav && styles.actionBtnActive]}
              >
                <Ionicons
                  name={isFav ? "bookmark" : "bookmark-outline"}
                  size={16}
                  color={isFav ? colors.ember : colors.text}
                />
                <Text
                  style={[
                    styles.actionText,
                    isFav && styles.actionTextActive,
                  ]}
                >
                  {isFav ? "Saved" : session ? "Save" : "Sign in to save"}
                </Text>
              </Pressable>
              <Pressable onPress={handleShare} style={styles.actionBtn}>
                <Ionicons
                  name={copied ? "checkmark" : "share-social-outline"}
                  size={16}
                  color={copied ? colors.forestSoft : colors.text}
                />
                <Text
                  style={[
                    styles.actionText,
                    copied && { color: colors.forestSoft },
                  ]}
                >
                  {copied ? "Copied" : "Share"}
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
  actionText: { fontSize: 13, fontWeight: "700", color: colors.text },
  actionTextActive: { color: colors.emberDark },
});
