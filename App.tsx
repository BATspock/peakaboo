import React, { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  SafeAreaView,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import MapView, { MapMarker } from "./src/components/MapView";
import { REGION_DEFAULT } from "./src/data/seed";
import { usePlaces } from "./src/data/usePlaces";

export default function App() {
  const [query, setQuery] = useState("");
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);
  const { subjects, viewpoints, loading, error } = usePlaces();

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
        tint: "secondary",
      }));

    return [...subjectMarkers, ...viewpointMarkers];
  }, [subjects, viewpoints, activeSubjectId]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>PeakAboo</Text>
          {loading && <Text style={styles.titleHint}>loading…</Text>}
          {error && <Text style={styles.titleError}>offline · seed data</Text>}
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
            console.log("marker pressed", id);
          }}
        />
      </View>
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
    alignItems: "baseline",
    gap: 8,
    marginBottom: 8,
  },
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
});
