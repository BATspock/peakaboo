import React, { useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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
import { AuthProvider, useAuth } from "./src/auth/AuthContext";
import SignInButton from "./src/auth/SignInButton";
import ViewpointSheet from "./src/sightings/ViewpointSheet";
import AddSpotSheet from "./src/components/AddSpotSheet";
import FavoritesSheet from "./src/viewpoints/FavoritesSheet";
import FavoritesButton from "./src/viewpoints/FavoritesButton";
import HistorySheet from "./src/sightings/HistorySheet";
import HistoryButton from "./src/sightings/HistoryButton";
import SubjectSearch, {
  type SubjectSearchHandle,
} from "./src/components/SubjectSearch";
import MyListButton from "./src/components/MyListButton";
import MyListSheet from "./src/components/MyListSheet";
import ReportSheet from "./src/components/ReportSheet";
import { FavoritesProvider, useFavorites } from "./src/data/useFavorites";
import { SubjectPinsProvider } from "./src/data/useSubjectPins";
import PrivacyPolicy from "./src/screens/PrivacyPolicy";
import ResetPasswordScreen from "./src/screens/ResetPassword";
import AuthSheet from "./src/auth/AuthSheet";
import { subjectCameraDelta } from "./src/lib/cameraDelta";
import type { PlaceSuggestion } from "./src/data/useSubjectSearch";
import type { ReportTargetType, Subject } from "./src/data/types";
import { recordRecentSubject } from "./src/data/recentSubjects";

function getPath(): string {
  if (typeof window === "undefined") return "/";
  return window.location.pathname || "/";
}

// /v/<viewpointId> → returns the id, else null.
// Tolerant of trailing garbage after the UUID (e.g. message text accidentally
// concatenated by share-sheet copy buttons that put text+url into one blob).
const UUID_RE =
  /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
function viewpointIdFromPath(path: string): string | null {
  const decoded = (() => {
    try {
      return decodeURIComponent(path);
    } catch {
      return path;
    }
  })();
  if (!decoded.startsWith("/v/")) return null;
  const tail = decoded.slice(3);
  // Try strict-first match (clean UUID up to next separator), then fall
  // back to "first UUID anywhere in the tail" for messy share blobs.
  const strict = tail.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  if (strict) return strict[1];
  const loose = tail.match(UUID_RE);
  return loose ? loose[1] : null;
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
            <SubjectPinsProvider>
              {path.startsWith("/reset-password") ? (
                <ResetPasswordScreen />
              ) : (
                <Home />
              )}
              <AuthSheet />
            </SubjectPinsProvider>
          </FavoritesProvider>
        </AuthProvider>
      )}
    </SafeAreaProvider>
  );
}

function Home() {
  const insets = useSafeAreaInsets();
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);
  const [openViewpointId, setOpenViewpointId] = useState<string | null>(
    () => viewpointIdFromPath(getPath()),
  );
  // Bumped only when a brand-new add is started (the add buttons or a
  // home-search "Add new"), so the AddSpot sheet resets. The pin-drop
  // round-trip reopens it WITHOUT bumping this, preserving in-progress input.
  const [addResetNonce, setAddResetNonce] = useState(0);
  // When launched from the home-search "Add new" result, this pre-stages the
  // chosen Google place as a new landmark.
  const [seedPlace, setSeedPlace] = useState<PlaceSuggestion | null>(null);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [myListOpen, setMyListOpen] = useState(false);
  // Which add flow the AddSpot sheet is showing: a viewpoint (place you look
  // from) or a landmark (the thing you look at). null = sheet closed.
  const [addMode, setAddMode] = useState<"viewpoint" | "landmark" | null>(null);
  const [pinDropMode, setPinDropMode] = useState(false);
  const [reportTarget, setReportTarget] = useState<{
    type: ReportTargetType;
    id: string;
  } | null>(null);
  const searchRef = useRef<SubjectSearchHandle>(null);
  const { session, openAuthSheet } = useAuth();
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
  // If a /v/<id> deep link was followed, switch the active subject to
  // match the linked viewpoint so its pin is on the visible map.
  React.useEffect(() => {
    if (subjects.length === 0) return;
    if (openViewpointId) {
      const linked = viewpoints.find((v) => v.id === openViewpointId);
      if (linked && activeSubjectId !== linked.subjectId) {
        setActiveSubjectId(linked.subjectId);
        return;
      }
    }
    if (activeSubjectId === null) {
      setActiveSubjectId(subjects[0].id);
    }
  }, [subjects, viewpoints, activeSubjectId, openViewpointId]);

  // Reflect the open viewpoint in the URL on web so the address bar is
  // always shareable. Native ignores.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const target = openViewpointId ? `/v/${openViewpointId}` : "/";
    if (window.location.pathname !== target) {
      window.history.replaceState(null, "", target);
    }
  }, [openViewpointId]);

  // Keep state in sync if the user uses browser back/forward.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    function onPop() {
      setOpenViewpointId(viewpointIdFromPath(getPath()));
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Camera target — bumps when the user picks a subject so the map
  // animates to it. nonce ensures repeated picks still re-center.
  // Delta is derived from the subject's category so a city skyline zooms
  // in tighter than a mountain peak.
  const [cameraNonce, setCameraNonce] = useState(0);
  const cameraTarget: CameraTarget | null = useMemo(() => {
    if (activeSubjectId === null) return null;
    const s = subjects.find((s) => s.id === activeSubjectId);
    if (!s) return null;
    return {
      latitude: s.latitude,
      longitude: s.longitude,
      delta: subjectCameraDelta(s.kind),
      nonce: cameraNonce,
    };
  }, [activeSubjectId, subjects, cameraNonce]);

  function handleSelectSubject(id: string) {
    setActiveSubjectId(id);
    setCameraNonce((n) => n + 1);
  }

  // Home-search "Add new" → a Google place we don't track yet = a new
  // landmark. Open the Add-a-landmark flow seeded with that place.
  function handleSelectPlace(p: PlaceSuggestion) {
    if (!session) {
      openAuthSheet();
      return;
    }
    setPinDropCoords(null);
    setSeedPlace(p);
    setAddResetNonce((n) => n + 1);
    setAddMode("landmark");
  }

  // The two header "Add" buttons.
  function openAddViewpoint() {
    if (!session) {
      openAuthSheet();
      return;
    }
    setPinDropCoords(null);
    setSeedPlace(null);
    setAddResetNonce((n) => n + 1);
    setAddMode("viewpoint");
  }

  function openAddLandmark() {
    if (!session) {
      openAuthSheet();
      return;
    }
    setPinDropCoords(null);
    setSeedPlace(null);
    setAddResetNonce((n) => n + 1);
    setAddMode("landmark");
  }

  function handleReportSubject(s: Subject) {
    if (!session) {
      openAuthSheet();
      return;
    }
    setReportTarget({ type: "subject", id: s.id });
  }

  // A subject was created without a viewpoint ("Just add the landmark").
  function handleSubjectOnlyCreated(subjectId: string) {
    refresh();
    setActiveSubjectId(subjectId);
    setCameraNonce((n) => n + 1);
    recordRecentSubject(subjectId);
  }

  function handleOpenExistingSubject(id: string) {
    setActiveSubjectId(id);
    setCameraNonce((n) => n + 1);
    recordRecentSubject(id);
  }

  const markers: MapMarker[] = useMemo(() => {
    const subjectMarkers: MapMarker[] = subjects
      .filter((s) => s.id === activeSubjectId)
      .map((s) => ({
        id: `subject:${s.id}`,
        latitude: s.latitude,
        longitude: s.longitude,
        title: s.name,
        description: "The landmark you're looking at",
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
            title: "New spot",
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
          <MyListButton onPress={() => setMyListOpen(true)} />
          <HistoryButton onPress={() => setHistoryOpen(true)} />
          <FavoritesButton onPress={() => setFavoritesOpen(true)} />
          <SignInButton />
        </View>
        <SubjectSearch
          ref={searchRef}
          subjects={subjects.slice(0, 6)}
          allSubjects={subjects}
          activeSubjectId={activeSubjectId}
          onSelectSubject={handleSelectSubject}
          onSelectPlace={handleSelectPlace}
          onReportSubject={handleReportSubject}
        />
        <View style={styles.addRow}>
          <Pressable style={styles.addBtn} onPress={openAddLandmark}>
            <Ionicons name="flag" size={15} color={colors.forest} />
            <Text style={styles.addBtnText}>Add a landmark</Text>
          </Pressable>
          <Pressable style={styles.addBtn} onPress={openAddViewpoint}>
            <Ionicons name="location" size={15} color={colors.forest} />
            <Text style={styles.addBtnText}>Add a viewpoint</Text>
          </Pressable>
        </View>
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
            // Drop (or reposition) the draft pin. Stay in pin-drop mode so
            // the user can drag the pin or tap again to fine-tune; the
            // sheet reopens only when they confirm via "Use this spot".
            setPinDropCoords(coords);
          }}
          onMarkerDragEnd={(id, coords) => {
            if (id === "draft:new") setPinDropCoords(coords);
          }}
        />

        {pinDropMode ? (
          <View
            pointerEvents="none"
            style={[styles.dropBanner, { top: 16 + insets.top }]}
          >
            <Ionicons name="location" size={16} color={colors.textOn} />
            <Text style={styles.dropBannerText}>
              {pinDropCoords
                ? "Drag the pin to the exact spot, then confirm."
                : "Tap the map to place a pin, then drag it to fine-tune."}
            </Text>
          </View>
        ) : null}

        {pinDropMode && pinDropCoords ? (
          <View style={[styles.confirmBar, { bottom: 24 + insets.bottom }]}>
            <View style={styles.confirmCoords}>
              <Ionicons name="location" size={14} color={colors.forest} />
              <Text style={styles.confirmCoordsText}>
                {pinDropCoords.latitude.toFixed(5)},{" "}
                {pinDropCoords.longitude.toFixed(5)}
              </Text>
            </View>
            <View style={styles.confirmActions}>
              <Pressable
                style={styles.confirmCancelBtn}
                onPress={() => {
                  setPinDropMode(false);
                  setPinDropCoords(null);
                }}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.confirmUseBtn}
                onPress={() => {
                  setPinDropMode(false);
                  // Pin-drop only happens inside the viewpoint location step;
                  // reopen there (resetNonce NOT bumped → input preserved).
                  setAddMode("viewpoint");
                }}
              >
                <Text style={styles.confirmUseText}>Use this spot</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>

      <ViewpointSheet
        viewpoint={openViewpoint}
        subject={openSubject}
        onClose={() => setOpenViewpointId(null)}
      />

      <AddSpotSheet
        visible={addMode !== null}
        mode={addMode ?? "viewpoint"}
        onClose={() => {
          setAddMode(null);
          setPinDropCoords(null);
          setSeedPlace(null);
        }}
        subjects={subjects}
        defaultSubjectId={activeSubjectId}
        pinDropCoords={pinDropCoords}
        resetNonce={addResetNonce}
        seedPlace={seedPlace}
        onRequestPinDrop={() => {
          // Hide the sheet so the user can interact with the map; the confirm
          // bar's "Use this spot" reopens it in viewpoint mode.
          setAddMode(null);
          setPinDropMode(true);
        }}
        onCreated={(id) => {
          refresh();
          setOpenViewpointId(id);
        }}
        onSubjectOnlyCreated={handleSubjectOnlyCreated}
        onOpenExistingViewpoint={(id) => {
          setAddMode(null);
          setPinDropCoords(null);
          setSeedPlace(null);
          setOpenViewpointId(id);
        }}
        onOpenExistingSubject={(id) => {
          setAddMode(null);
          setPinDropCoords(null);
          setSeedPlace(null);
          handleOpenExistingSubject(id);
        }}
      />

      <ReportSheet
        target={reportTarget}
        onClose={() => setReportTarget(null)}
      />

      <FavoritesSheet
        visible={favoritesOpen}
        onClose={() => setFavoritesOpen(false)}
        subjects={subjects}
        viewpoints={viewpoints}
        onPickViewpoint={(id) => setOpenViewpointId(id)}
      />

      <MyListSheet
        visible={myListOpen}
        onClose={() => setMyListOpen(false)}
        subjects={subjects}
        activeSubjectId={activeSubjectId}
        onPickSubject={handleSelectSubject}
      />

      <HistorySheet
        visible={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onPickViewpoint={(id) => setOpenViewpointId(id)}
      />
    </SafeAreaView>
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
    // Lift the header above the map so the search dropdown (which
    // overflows the header bottom edge with position: absolute) renders
    // on top of the map's stacking context.
    zIndex: 100,
    // Web-only equivalent of zIndex for nested stacking contexts.
    // react-native-web translates this to CSS.
    elevation: 10,
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
  // The two add entry points, directly under the search bar.
  addRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  addBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addBtnText: { fontSize: 13, color: colors.forest, fontWeight: "700" },
  mapWrap: { flex: 1 },
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
  confirmBar: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.forest,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  confirmCoords: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  confirmCoordsText: {
    color: colors.forest,
    fontWeight: "700",
    fontSize: 13,
  },
  confirmActions: {
    flexDirection: "row",
    gap: 8,
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radii.md,
    alignItems: "center",
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  confirmCancelText: { color: colors.text, fontWeight: "700", fontSize: 14 },
  confirmUseBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: radii.md,
    alignItems: "center",
    backgroundColor: colors.forestSoft,
  },
  confirmUseText: { color: colors.textOn, fontWeight: "700", fontSize: 14 },
});
