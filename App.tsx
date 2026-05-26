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
import { colors, radii } from "./src/theme";
import MapView, { MapMarker } from "./src/components/MapView";
import { REGION_DEFAULT } from "./src/data/seed";
import { usePlaces } from "./src/data/usePlaces";
import { AuthProvider } from "./src/auth/AuthContext";
import SignInButton from "./src/auth/SignInButton";
import ViewpointSheet from "./src/sightings/ViewpointSheet";
import AddViewpointSheet from "./src/viewpoints/AddViewpointSheet";
import FavoritesSheet from "./src/viewpoints/FavoritesSheet";
import FavoritesButton from "./src/viewpoints/FavoritesButton";
import { FavoritesProvider, useFavorites } from "./src/data/useFavorites";

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <FavoritesProvider>
          <Home />
        </FavoritesProvider>
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
          <Text style={styles.title}>
            <Text style={styles.titlePeak}>Peak</Text>
            <Text style={styles.titleAboo}>Aboo</Text>
          </Text>
          {loading && <Text style={styles.titleHint}>loading…</Text>}
          {error && <Text style={styles.titleError}>offline · seed data</Text>}
          <View style={styles.titleSpacer} />
          <FavoritesButton onPress={() => setFavoritesOpen(true)} />
          <SignInButton />
        </View>
        <TextInput
          style={styles.search}
          placeholder="Search a peak or landmark…"
          placeholderTextColor={colors.textTertiary}
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
    marginBottom: 10,
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
  search: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: colors.text,
  },
  pillRow: { paddingTop: 10, gap: 8 },
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
  fabPlus: {
    color: colors.textOn,
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 30,
  },
  dropBanner: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: colors.forest,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radii.md,
    alignItems: "center",
  },
  dropBannerText: { color: colors.textOn, fontWeight: "600", fontSize: 13 },
});
