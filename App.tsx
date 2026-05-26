import React, { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import MapView, { MapMarker } from "./src/components/MapView";
import { REGION_DEFAULT } from "./src/data/seed";
import { usePlaces } from "./src/data/usePlaces";
import { AuthProvider } from "./src/auth/AuthContext";
import SignInButton from "./src/auth/SignInButton";
import ViewpointSheet from "./src/sightings/ViewpointSheet";
import AddViewpointSheet from "./src/viewpoints/AddViewpointSheet";
import FavoritesSheet from "./src/viewpoints/FavoritesSheet";
import FavoritesButton from "./src/viewpoints/FavoritesButton";
import { useFavorites } from "./src/data/useFavorites";

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Home />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

function Home() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);
  const [openViewpointId, setOpenViewpointId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
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

  const filteredSubjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return subjects;
    return subjects.filter((s) => s.name.toLowerCase().includes(q));
  }, [query, subjects]);

  const markers: MapMarker[] = useMemo(() => {
    const subjectMarkers: MapMarker[] = subjects
      .filter((s) => activeSubjectId === null || s.id === activeSubjectId)
      .map((s) => ({
        id: `subject:${s.id}`,
        latitude: s.latitude,
        longitude: s.longitude,
        title: s.name,
        description: "Subject (the thing being viewed)",
        tint: "primary",
      }));

    const viewpointMarkers: MapMarker[] = viewpoints
      .filter((v) => activeSubjectId === null || v.subjectId === activeSubjectId)
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
          <Text style={styles.title}>PeakAboo</Text>
          {loading && <Text style={styles.titleHint}>loading…</Text>}
          {error && <Text style={styles.titleError}>offline · seed data</Text>}
          <View style={styles.titleSpacer} />
          <FavoritesButton onPress={() => setFavoritesOpen(true)} />
          <SignInButton />
        </View>
        <TextInput
          style={styles.search}
          placeholder="Search a peak or landmark…"
          placeholderTextColor="#94A3B8"
          value={query}
          onChangeText={setQuery}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillRow}
        >
          <SubjectPill
            label="All"
            active={activeSubjectId === null}
            onPress={() => setActiveSubjectId(null)}
          />
          {filteredSubjects.map((s) => (
            <SubjectPill
              key={s.id}
              label={s.name}
              active={activeSubjectId === s.id}
              onPress={() => setActiveSubjectId(s.id)}
            />
          ))}
        </ScrollView>
      </View>

      <View style={styles.mapWrap}>
        <MapView
          region={REGION_DEFAULT}
          markers={markers}
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
          <Text style={styles.fabPlus}>＋</Text>
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
  safe: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E2E8F0",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  titleSpacer: { flex: 1 },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0F172A",
  },
  titleHint: { fontSize: 12, color: "#94A3B8" },
  titleError: { fontSize: 12, color: "#B45309" },
  search: {
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: "#0F172A",
  },
  pillRow: { paddingTop: 10, gap: 8 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
    marginRight: 8,
  },
  pillActive: { backgroundColor: "#0F172A" },
  pillText: { color: "#475569", fontWeight: "600", fontSize: 13 },
  pillTextActive: { color: "#FFFFFF" },
  mapWrap: { flex: 1 },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 999,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  fabPlus: { color: "#FFFFFF", fontSize: 26, fontWeight: "700", lineHeight: 28 },
  dropBanner: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 16,
    backgroundColor: "rgba(15, 23, 42, 0.9)",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  dropBannerText: { color: "#FFFFFF", fontWeight: "600", fontSize: 13 },
});
