import React, { useState } from "react";
import { View } from "react-native";
import BottomSheet from "../components/BottomSheet";
import SightingForm from "./SightingForm";
import SightingsFeed from "./SightingsFeed";
import ViewpointRating from "../viewpoints/ViewpointRating";
import ImageLightbox from "../components/ImageLightbox";
import type { Subject, Viewpoint } from "../data/types";

type Props = {
  viewpoint: Viewpoint | null;
  subject: Subject | null;
  onClose: () => void;
};

export default function ViewpointSheet({ viewpoint, subject, onClose }: Props) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [lightbox, setLightbox] = useState<{
    urls: string[];
    index: number;
  } | null>(null);

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
