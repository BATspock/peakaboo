import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii } from "./src/theme";
import MapView, { MapMarker, CameraTarget } from "./src/components/MapView";
import { REGION_DEFAULT } from "./src/data/seed";
import { usePlaces } from "./src/data/usePlaces";
import { AuthProvider } from "./src/auth/AuthContext";
import SignInButton from "./src/auth/SignInButton";
import ViewpointSheet from "./src/sightings/ViewpointSheet";
import AddViewpointSheet from "./src/viewpoints/AddViewpointSheet";
import FavoritesSheet from "./src/viewpoints/FavoritesSheet";
import FavoritesButton from "./src/viewpoints/FavoritesButton";
import HistorySheet from "./src/sightings/HistorySheet";
import HistoryButton from "./src/sightings/HistoryButton";
import { FavoritesProvider, useFavorites } from "./src/data/useFavorites";
import PrivacyPolicy from "./src/screens/PrivacyPolicy";

function getPath(): string {
  if (typeof window === "undefined") return "/";
  return window.location.pathname || "/";
}

export default function App() {
  const path = getPath();
  return (
    <SafeAreaProvider>
      {path.startsWith("/privacy") ? (
        <PrivacyPolicy />
      ) : (
        <AuthProvider>
          <FavoritesProvider>
            <Home />
          </FavoritesProvider>
        </AuthProvider>
      )}
    </SafeAreaProvider>
  );
}

function Home() {
  const insets = useSafeAreaInsets();
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);
  const [openViewpointId, setOpenViewpointId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pinDropMode, setPinDropMode] = useState(false);
  const [pinDropCoords, setPinDropCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const { subjects, viewpoints, loading, error, refresh } = usePlaces();
  const { has: hasFavorite } = useFavorites();

  const openViewpoint = useMemo(
    () => viewpoints.find((v) => v.id === openViewpointId) ?? null,
    [viewpoints, openViewpointId],
  );
  const openSubject = useMemo(
    () =>
      openViewpoint
        ? subjects.find((s) => s.id === openViewpoint.subjectId) ?? null
        : null,
    [subjects, openViewpoint],
  );

  // Default the active filter to the first subject once data lands.
  React.useEffect(() => {
    if (activeSubjectId === null && subjects.length > 0) {
      setActiveSubjectId(subjects[0].id);
    }
  }, [subjects, activeSubjectId]);

  // Camera target — bumps when the user picks a subject pill so the map
  // animates to that subject. nonce ensures repeated taps still re-center.
  const [cameraNonce, setCameraNonce] = useState(0);
  const cameraTarget: CameraTarget | null = useMemo(() => {
    if (activeSubjectId === null) return null;
    const s = subjects.find((s) => s.id === activeSubjectId);
    if (!s) return null;
    return {
      latitude: s.latitude,
      longitude: s.longitude,
      delta: 1.4,
      nonce: cameraNonce,
    };
  }, [activeSubjectId, subjects, cameraNonce]);

  const markers: MapMarker[] = useMemo(() => {
    const subjectMarkers: MapMarker[] = subjects
      .filter((s) => s.id === activeSubjectId)
      .map((s) => ({
        id: `subject:${s.id}`,
        latitude: s.latitude,
        longitude: s.longitude,
        title: s.name,
        description: "Subject (the thing being viewed)",
        tint: "primary",
      }));

    const viewpointMarkers: MapMarker[] = viewpoints
      .filter((v) => v.subjectId === activeSubjectId)
      .map((v) => ({
        id: `viewpoint:${v.id}`,
        latitude: v.latitude,
        longitude: v.longitude,
        title: v.name,
        description: v.description ?? undefined,
        tint: hasFavorite(v.id) ? "favorite" : "secondary",
      }));

    const draftMarker: MapMarker[] = pinDropCoords
      ? [
          {
            id: "draft:new",
            latitude: pinDropCoords.latitude,
            longitude: pinDropCoords.longitude,
            title: "New viewpoint",
            tint: "draft",
          },
        ]
      : [];

    return [...subjectMarkers, ...viewpointMarkers, ...draftMarker];
  }, [subjects, viewpoints, activeSubjectId, pinDropCoords, hasFavorite]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>
            <Text style={styles.titlePeak}>Peak</Text>
            <Text style={styles.titleAboo}>Aboo</Text>
          </Text>
          {loading && <Text style={styles.titleHint}>loading…</Text>}
          <View style={styles.titleSpacer} />
          <HistoryButton onPress={() => setHistoryOpen(true)} />
          <FavoritesButton onPress={() => setFavoritesOpen(true)} />
          <SignInButton />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillRow}
        >
          {subjects.map((s) => (
            <SubjectPill
              key={s.id}
              label={s.name}
              active={activeSubjectId === s.id}
              onPress={() => {
                setActiveSubjectId(s.id);
                setCameraNonce((n) => n + 1);
              }}
            />
          ))}
        </ScrollView>
      </View>

      <View style={styles.mapWrap}>
        <MapView
          region={REGION_DEFAULT}
          markers={markers}
          cameraTarget={cameraTarget}
          onMarkerPress={(id) => {
            if (pinDropMode) return;
            if (id.startsWith("viewpoint:")) {
              setOpenViewpointId(id.slice("viewpoint:".length));
            }
          }}
          onMapPress={(coords) => {
            if (!pinDropMode) return;
            setPinDropCoords(coords);
            setPinDropMode(false);
            setAddOpen(true);
          }}
        />

        {pinDropMode ? (
          <View
            pointerEvents="none"
            style={[styles.dropBanner, { top: 16 + insets.top }]}
          >
            <Ionicons name="location" size={16} color={colors.textOn} />
            <Text style={styles.dropBannerText}>
              Tap anywhere on the map to drop a pin.
            </Text>
          </View>
        ) : null}

        <Pressable
          style={[styles.fab, { bottom: 24 + insets.bottom }]}
          onPress={() => {
            setPinDropCoords(null);
            setAddOpen(true);
          }}
        >
          <Ionicons name="add" size={30} color={colors.textOn} />
        </Pressable>
      </View>

      <ViewpointSheet
        viewpoint={openViewpoint}
        subject={openSubject}
        onClose={() => setOpenViewpointId(null)}
      />

      <AddViewpointSheet
        visible={addOpen}
        onClose={() => {
          setAddOpen(false);
          setPinDropCoords(null);
        }}
        subjects={subjects}
        pinDropCoords={pinDropCoords}
        onRequestPinDrop={() => {
          setAddOpen(false);
          setPinDropMode(true);
        }}
        onCreated={(id) => {
          refresh();
          setOpenViewpointId(id);
        }}
      />

      <FavoritesSheet
        visible={favoritesOpen}
        onClose={() => setFavoritesOpen(false)}
        subjects={subjects}
        viewpoints={viewpoints}
        onPickViewpoint={(id) => setOpenViewpointId(id)}
      />

      <HistorySheet
        visible={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onPickViewpoint={(id) => setOpenViewpointId(id)}
      />
    </SafeAreaView>
  );
}

function SubjectPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.pill, active && styles.pillActive]}
    >
      <Text style={[styles.pillText, active && styles.pillTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  titleSpacer: { flex: 1 },
  title: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  titlePeak: { color: colors.forest },
  titleAboo: {
    color: colors.peak,
    fontStyle: "italic",
  },
  titleHint: { fontSize: 12, color: colors.textTertiary, fontWeight: "500" },
  titleError: { fontSize: 12, color: colors.ember, fontWeight: "600" },
  pillRow: { paddingTop: 4, gap: 8 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceSoft,
    marginRight: 8,
  },
  pillActive: { backgroundColor: colors.forest },
  pillText: { color: colors.textSecondary, fontWeight: "600", fontSize: 13 },
  pillTextActive: { color: colors.textOn },
  mapWrap: { flex: 1 },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 60,
    height: 60,
    borderRadius: radii.pill,
    backgroundColor: colors.forestSoft,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.forest,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  dropBanner: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.forest,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radii.md,
  },
  dropBannerText: { color: colors.textOn, fontWeight: "600", fontSize: 13 },
});
