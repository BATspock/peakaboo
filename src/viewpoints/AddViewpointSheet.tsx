import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Location from "expo-location";
import BottomSheet from "../components/BottomSheet";
import { useAuth } from "../auth/AuthContext";
import { supabase } from "../lib/supabase";
import type { Subject } from "../data/types";

type Mode = "current" | "pin" | "coords";

type Coords = { latitude: number; longitude: number } | null;

type Props = {
  visible: boolean;
  onClose: () => void;
  subjects: Subject[];
  pinDropCoords: Coords; // set externally when the user taps the map in pin-drop mode
  onRequestPinDrop: () => void;
  onCreated: (newViewpointId: string) => void;
};

export default function AddViewpointSheet({
  visible,
  onClose,
  subjects,
  pinDropCoords,
  onRequestPinDrop,
  onCreated,
}: Props) {
  const { session, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<Mode>("current");
  const [coords, setCoords] = useState<Coords>(null);
  const [coordInput, setCoordInput] = useState({ lat: "", lng: "" });
  const [subjectId, setSubjectId] = useState<string | null>(
    subjects[0]?.id ?? null,
  );
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState<"location" | "saving" | null>(null);

  // Reset on open/close so the form is fresh each time.
  useEffect(() => {
    if (visible) {
      setMode("current");
      setCoords(null);
      setCoordInput({ lat: "", lng: "" });
      setName("");
      setDescription("");
      setSubjectId(subjects[0]?.id ?? null);
    }
  }, [visible, subjects]);

  // When the parent finishes a pin drop, capture the coords.
  useEffect(() => {
    if (pinDropCoords) {
      setCoords(pinDropCoords);
      setMode("pin");
    }
  }, [pinDropCoords]);

  if (!session) {
    return (
      <BottomSheet
        visible={visible}
        onClose={onClose}
        title="Add a viewpoint"
        subtitle="Sign in to add a new place to spot from"
      >
        <View style={{ gap: 12 }}>
          <Text style={styles.signedOutText}>
            Adding a viewpoint requires an account so we can credit you and
            keep tabs on quality.
          </Text>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => signInWithGoogle().catch(() => undefined)}
          >
            <Text style={styles.primaryBtnText}>Sign in to add a viewpoint</Text>
          </Pressable>
        </View>
      </BottomSheet>
    );
  }

  async function handleUseCurrentLocation() {
    setBusy("location");
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        throw new Error("Location permission denied.");
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoords({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Platform.OS === "web"
        ? // eslint-disable-next-line no-alert
          window.alert(msg)
        : Alert.alert("Couldn't get location", msg);
    } finally {
      setBusy(null);
    }
  }

  function handleApplyCoords() {
    const lat = Number(coordInput.lat);
    const lng = Number(coordInput.lng);
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      const msg = "Latitude must be -90 to 90, longitude -180 to 180.";
      Platform.OS === "web"
        ? // eslint-disable-next-line no-alert
          window.alert(msg)
        : Alert.alert("Invalid coordinates", msg);
      return;
    }
    setCoords({ latitude: lat, longitude: lng });
  }

  async function handleSave() {
    if (!session || !subjectId || !coords || !name.trim()) {
      const msg = !coords
        ? "Pick a location first."
        : !name.trim()
          ? "Give the viewpoint a short name."
          : "Pick which mountain this is a view of.";
      Platform.OS === "web"
        ? // eslint-disable-next-line no-alert
          window.alert(msg)
        : Alert.alert("Almost there", msg);
      return;
    }

    setBusy("saving");
    const { data, error } = await supabase
      .from("viewpoints")
      .insert({
        subject_id: subjectId,
        name: name.trim(),
        description: description.trim() || null,
        latitude: coords.latitude,
        longitude: coords.longitude,
        created_by: session.user.id,
      })
      .select("id")
      .single();
    setBusy(null);

    if (error || !data) {
      const msg = error?.message ?? "Save failed.";
      Platform.OS === "web"
        ? // eslint-disable-next-line no-alert
          window.alert(`Save failed: ${msg}`)
        : Alert.alert("Save failed", msg);
      return;
    }
    onCreated(data.id);
    onClose();
  }

  const subjectsAvailable = subjects.length > 0;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Add a viewpoint"
      subtitle="Help others find the spot."
    >
      <View style={{ gap: 18 }}>
        <View style={styles.modeRow}>
          <ModeTab
            label="My location"
            active={mode === "current"}
            onPress={() => setMode("current")}
          />
          <ModeTab
            label="Drop pin"
            active={mode === "pin"}
            onPress={() => setMode("pin")}
          />
          <ModeTab
            label="Coordinates"
            active={mode === "coords"}
            onPress={() => setMode("coords")}
          />
        </View>

        {mode === "current" ? (
          <View style={{ gap: 8 }}>
            <Pressable
              onPress={handleUseCurrentLocation}
              disabled={busy === "location"}
              style={[
                styles.secondaryBtn,
                busy === "location" && { opacity: 0.6 },
              ]}
            >
              {busy === "location" ? (
                <ActivityIndicator />
              ) : (
                <Text style={styles.secondaryBtnText}>Use my current location</Text>
              )}
            </Pressable>
          </View>
        ) : null}

        {mode === "pin" ? (
          <View style={{ gap: 8 }}>
            <Pressable onPress={onRequestPinDrop} style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnText}>
                Tap a spot on the map
              </Text>
            </Pressable>
            <Text style={styles.helperText}>
              The sheet closes — tap once on the map and it'll come back with
              the coordinates filled in.
            </Text>
          </View>
        ) : null}

        {mode === "coords" ? (
          <View style={{ gap: 8 }}>
            <View style={styles.coordRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Latitude (e.g. 47.6295)"
                placeholderTextColor="#94A3B8"
                keyboardType="numbers-and-punctuation"
                value={coordInput.lat}
                onChangeText={(t) => setCoordInput((c) => ({ ...c, lat: t }))}
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Longitude (e.g. -122.36)"
                placeholderTextColor="#94A3B8"
                keyboardType="numbers-and-punctuation"
                value={coordInput.lng}
                onChangeText={(t) => setCoordInput((c) => ({ ...c, lng: t }))}
              />
            </View>
            <Pressable onPress={handleApplyCoords} style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnText}>Use these coordinates</Text>
            </Pressable>
          </View>
        ) : null}

        {coords ? (
          <View style={styles.coordsConfirm}>
            <Text style={styles.coordsConfirmText}>
              📍 {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
            </Text>
          </View>
        ) : null}

        <View style={{ gap: 8 }}>
          <Text style={styles.label}>Viewpoint name</Text>
          <TextInput
            style={styles.input}
            placeholder="Kerry Park"
            placeholderTextColor="#94A3B8"
            value={name}
            onChangeText={setName}
          />
        </View>

        <View style={{ gap: 8 }}>
          <Text style={styles.label}>Description (optional)</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder="Tip: best view at sunset, partial blockage…"
            placeholderTextColor="#94A3B8"
            multiline
            value={description}
            onChangeText={setDescription}
          />
        </View>

        <View style={{ gap: 8 }}>
          <Text style={styles.label}>View of</Text>
          {subjectsAvailable ? (
            <View style={styles.subjectRow}>
              {subjects.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => setSubjectId(s.id)}
                  style={[
                    styles.chip,
                    subjectId === s.id && styles.chipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      subjectId === s.id && styles.chipTextActive,
                    ]}
                  >
                    {s.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={styles.helperText}>
              No subjects loaded — try again in a moment.
            </Text>
          )}
        </View>

        <Pressable
          onPress={handleSave}
          disabled={busy === "saving"}
          style={[styles.primaryBtn, busy === "saving" && { opacity: 0.6 }]}
        >
          <Text style={styles.primaryBtnText}>
            {busy === "saving" ? "Saving…" : "Save viewpoint"}
          </Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

function ModeTab({
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
      style={[styles.modeTab, active && styles.modeTabActive]}
    >
      <Text style={[styles.modeTabText, active && styles.modeTabTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  signedOutText: { fontSize: 14, color: "#475569", textAlign: "center" },

  modeRow: {
    flexDirection: "row",
    gap: 6,
    backgroundColor: "#F1F5F9",
    padding: 4,
    borderRadius: 12,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  modeTabActive: { backgroundColor: "#FFFFFF" },
  modeTabText: { fontSize: 13, fontWeight: "600", color: "#64748B" },
  modeTabTextActive: { color: "#0F172A" },

  label: { fontSize: 13, fontWeight: "700", color: "#0F172A" },
  input: {
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0F172A",
  },
  multiline: { minHeight: 60, textAlignVertical: "top" },
  coordRow: { flexDirection: "row", gap: 8 },
  coordsConfirm: {
    backgroundColor: "#ECFDF5",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  coordsConfirmText: { color: "#065F46", fontWeight: "600", fontSize: 13 },

  subjectRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
  },
  chipActive: { backgroundColor: "#0F172A" },
  chipText: { color: "#475569", fontWeight: "600", fontSize: 13 },
  chipTextActive: { color: "#FFFFFF" },

  primaryBtn: {
    backgroundColor: "#0F172A",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },
  secondaryBtn: {
    backgroundColor: "#F1F5F9",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  secondaryBtnText: { color: "#0F172A", fontWeight: "700", fontSize: 14 },

  helperText: { fontSize: 12, color: "#64748B", lineHeight: 16 },
});
