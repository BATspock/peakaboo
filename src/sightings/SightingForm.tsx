import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthContext";
import type { SightingCondition } from "../data/types";
import {
  pickAndUploadImages,
  type ImageSource,
  type UploadedImage,
} from "./uploadImages";
import { colors, radii } from "../theme";
import { Ionicons } from "@expo/vector-icons";

const CONDITIONS: SightingCondition[] = [
  "clear",
  "cloudy",
  "snowy",
  "hazy",
  "rainy",
];

// 5-point visibility scale, inspired by "Is The Mountain Out?" but with
// our own levels. Each maps to (visible: boolean, score: 0-10) so the
// existing data model is preserved — old sightings still render.
type Level = {
  value: 1 | 2 | 3 | 4 | 5;
  label: string;
  hint: string;
  visible: boolean;
  score: number; // backing 0-10 visibility value
  tint: string;
};

const VISIBILITY_LEVELS: Level[] = [
  {
    value: 5,
    label: "Crystal clear",
    hint: "Sharp outline, no haze",
    visible: true,
    score: 10,
    tint: colors.forestSoft,
  },
  {
    value: 4,
    label: "Mostly out",
    hint: "Most of it visible, light haze",
    visible: true,
    score: 8,
    tint: colors.leaf,
  },
  {
    value: 3,
    label: "Halfway out",
    hint: "Partially visible, clouds drifting",
    visible: true,
    score: 5,
    tint: colors.peak,
  },
  {
    value: 2,
    label: "Barely out",
    hint: "Faint silhouette, mostly obscured",
    visible: true,
    score: 2,
    tint: colors.ember,
  },
  {
    value: 1,
    label: "Hidden",
    hint: "Can't see it at all",
    visible: false,
    score: 0,
    tint: colors.clay,
  },
];

function levelFromState(
  visible: boolean | null,
  visibility: number,
): Level | null {
  if (visible === null) return null;
  // Find the closest level by score, preferring matches that agree on
  // the visible flag.
  const candidates = VISIBILITY_LEVELS.filter((l) => l.visible === visible);
  const pool = candidates.length > 0 ? candidates : VISIBILITY_LEVELS;
  let best = pool[0];
  let bestDiff = Math.abs(pool[0].score - visibility);
  for (const l of pool.slice(1)) {
    const d = Math.abs(l.score - visibility);
    if (d < bestDiff) {
      best = l;
      bestDiff = d;
    }
  }
  return best;
}

type Props = {
  viewpointId: string;
  subjectName: string;
  onSaved: () => void;
  onOpenLightbox?: (urls: string[], index: number) => void;
};

type FormState = {
  visible: boolean | null;
  visibility: number;
  conditions: SightingCondition | null;
  notes: string;
};

const EMPTY: FormState = {
  visible: null,
  visibility: 5,
  conditions: null,
  notes: "",
};

export default function SightingForm({
  viewpointId,
  subjectName,
  onSaved,
  onOpenLightbox,
}: Props) {
  const { session, openAuthSheet } = useAuth();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  // Each Save creates a new sighting row. We track the most-recent id so
  // photo uploads (which need a parent sighting_id) can target it.
  const [draftSightingId, setDraftSightingId] = useState<string | null>(null);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [uploading, setUploading] = useState(false);

  // Reset everything when the viewpoint changes — fresh form on open.
  useEffect(() => {
    setForm(EMPTY);
    setDraftSightingId(null);
    setImages([]);
    setSavedAt(null);
  }, [viewpointId]);

  if (!session) {
    return (
      <View style={styles.signedOut}>
        <Text style={styles.signedOutText}>
          Sign in to log whether you can see {subjectName}.
        </Text>
        <Pressable style={styles.primaryBtn} onPress={openAuthSheet}>
          <Text style={styles.primaryBtnText}>Sign in to log a sighting</Text>
        </Pressable>
      </View>
    );
  }

  async function ensureDraftSighting(): Promise<string | null> {
    if (!session) return null;
    if (draftSightingId) return draftSightingId;
    if (form.visible === null) {
      const msg = "Tell us if you can see it — yes or no.";
      Platform.OS === "web"
        ? // eslint-disable-next-line no-alert
          window.alert(msg)
        : Alert.alert("Almost there", msg);
      return null;
    }
    const payload = {
      viewpoint_id: viewpointId,
      user_id: session.user.id,
      visible: form.visible,
      visibility: form.visibility,
      conditions: form.conditions,
      notes: form.notes.trim() || null,
      observed_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from("sightings")
      .insert(payload)
      .select("id")
      .single();
    if (error || !data) {
      // eslint-disable-next-line no-console
      console.warn("[sighting] save failed", error);
      const msg = error?.message ?? "Could not create sighting.";
      Platform.OS === "web"
        ? // eslint-disable-next-line no-alert
          window.alert(`Save failed: ${msg}`)
        : Alert.alert("Save failed", msg);
      return null;
    }
    setDraftSightingId(data.id);
    return data.id;
  }

  async function handleSave() {
    setSaving(true);
    const sightingId = await ensureDraftSighting();
    setSaving(false);
    if (!sightingId) return;
    setSavedAt(Date.now());
    onSaved();
    // Reset for the next sighting — same viewpoint, fresh state.
    setForm(EMPTY);
    setDraftSightingId(null);
    setImages([]);
  }

  async function handleAddPhotos(source: ImageSource) {
    if (!session) return;
    const sightingId = await ensureDraftSighting();
    if (!sightingId) return;

    setUploading(true);
    try {
      const newOnes = await pickAndUploadImages({
        sightingId,
        userId: session.user.id,
        source,
      });
      setImages((prev) => [...prev, ...newOnes]);
      onSaved();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // eslint-disable-next-line no-console
      console.warn("[sighting] upload failed", e);
      Platform.OS === "web"
        ? // eslint-disable-next-line no-alert
          window.alert(`Photo upload failed: ${msg}`)
        : Alert.alert("Photo upload failed", msg);
    } finally {
      setUploading(false);
    }
  }

  async function handleRemoveImage(img: UploadedImage) {
    // Delete the row first (RLS allows because the parent sighting is the user's),
    // then remove the storage object. If storage fails, we still cleared the row.
    const { error } = await supabase
      .from("sighting_images")
      .delete()
      .eq("id", img.id);
    if (error) {
      // eslint-disable-next-line no-console
      console.warn("[sighting] delete image row failed", error.message);
      return;
    }
    await supabase.storage.from("sightings").remove([img.storage_path]);
    setImages((prev) => prev.filter((i) => i.id !== img.id));
    onSaved();
  }

  // Map a 5-level scale onto our underlying schema: visible (boolean) +
  // visibility (0-10 int). Old binary forms still work because both
  // fields are still set on save. The level is what the user sees.
  const currentLevel = levelFromState(form.visible, form.visibility);

  return (
    <View style={{ gap: 18 }}>
      <Section title={`How visible is ${subjectName} right now?`}>
        <View style={{ gap: 6 }}>
          {VISIBILITY_LEVELS.map((lvl) => {
            const active = currentLevel?.value === lvl.value;
            return (
              <Pressable
                key={lvl.value}
                onPress={() =>
                  setForm((f) => ({
                    ...f,
                    visible: lvl.visible,
                    visibility: lvl.score,
                  }))
                }
                style={[
                  styles.levelRow,
                  active && {
                    backgroundColor: lvl.tint,
                    borderColor: lvl.tint,
                  },
                ]}
              >
                <View
                  style={[
                    styles.levelDot,
                    { backgroundColor: lvl.tint },
                    active && { backgroundColor: colors.textOn },
                  ]}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.levelLabel,
                      active && styles.levelLabelActive,
                    ]}
                  >
                    {lvl.label}
                  </Text>
                  <Text
                    style={[
                      styles.levelHint,
                      active && styles.levelHintActive,
                    ]}
                  >
                    {lvl.hint}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </Section>

      <Section title="Conditions">
        <View style={styles.chipRow}>
          {CONDITIONS.map((c) => (
            <Chip
              key={c}
              label={c}
              active={form.conditions === c}
              onPress={() =>
                setForm((f) => ({
                  ...f,
                  conditions: f.conditions === c ? null : c,
                }))
              }
            />
          ))}
        </View>
      </Section>

      <Section title="Notes (optional)">
        <TextInput
          style={styles.notes}
          placeholder="Wispy clouds at the summit but the cap is showing…"
          placeholderTextColor="#94A3B8"
          multiline
          value={form.notes}
          onChangeText={(t) => setForm((f) => ({ ...f, notes: t }))}
        />
      </Section>

      <Section title={`Photos${images.length ? ` · ${images.length}` : ""}`}>
        <View style={styles.imageGrid}>
          {images.map((img, i) => (
            <Pressable
              key={img.id}
              onPress={() =>
                onOpenLightbox?.(
                  images.map((m) => m.publicUrl),
                  i,
                )
              }
              onLongPress={() => handleRemoveImage(img)}
              style={styles.imageTile}
            >
              <Image source={{ uri: img.publicUrl }} style={styles.imageTileImg} />
            </Pressable>
          ))}
          <Pressable
            onPress={() => handleAddPhotos("camera")}
            disabled={uploading}
            style={[styles.addPhotoTile, uploading && { opacity: 0.6 }]}
          >
            {uploading ? (
              <ActivityIndicator />
            ) : (
              <>
                <Ionicons
                  name="camera"
                  size={22}
                  color={colors.forestSoft}
                />
                <Text style={styles.addPhotoText}>Camera</Text>
              </>
            )}
          </Pressable>
          <Pressable
            onPress={() => handleAddPhotos("library")}
            disabled={uploading}
            style={[styles.addPhotoTile, uploading && { opacity: 0.6 }]}
          >
            {uploading ? (
              <ActivityIndicator />
            ) : (
              <>
                <Ionicons
                  name="images-outline"
                  size={22}
                  color={colors.textSecondary}
                />
                <Text style={styles.addPhotoText}>Library</Text>
              </>
            )}
          </Pressable>
        </View>
        {images.length > 0 ? (
          <Text style={styles.helperText}>Long-press a photo to remove it.</Text>
        ) : null}
      </Section>

      <View style={{ gap: 6 }}>
        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={({ pressed }) => [
            styles.primaryBtn,
            pressed && { opacity: 0.85 },
            saving && { opacity: 0.6 },
          ]}
        >
          <Text style={styles.primaryBtnText}>
            {saving ? "Saving…" : "Save sighting"}
          </Text>
        </Pressable>
        {savedAt && Date.now() - savedAt < 4000 ? (
          <View style={styles.savedHintRow}>
            <Ionicons
              name="checkmark-circle"
              size={14}
              color={colors.forestSoft}
            />
            <Text style={styles.savedHint}>
              Saved — your sighting is live in the feed below.
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: 10 }}>
      <View>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSub}>{subtitle}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function Chip({
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
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text
        style={[styles.chipText, active && styles.chipTextActive]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { padding: 24, alignItems: "center" },
  signedOut: { alignItems: "stretch", gap: 12, paddingVertical: 8 },
  signedOutText: { fontSize: 14, color: colors.textSecondary, textAlign: "center" },

  sectionTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  sectionSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  levelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
  },
  levelDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  levelLabel: { fontSize: 14, fontWeight: "700", color: colors.text },
  levelLabelActive: { color: colors.textOn },
  levelHint: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  levelHintActive: { color: colors.textOn, opacity: 0.85 },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceSoft,
    textTransform: "capitalize",
  },
  chipActive: { backgroundColor: colors.forest },
  chipText: {
    color: colors.textSecondary,
    fontWeight: "600",
    fontSize: 13,
    textTransform: "capitalize",
  },
  chipTextActive: { color: colors.textOn },

  notes: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 64,
    fontSize: 14,
    color: colors.text,
    textAlignVertical: "top",
  },

  primaryBtn: {
    backgroundColor: colors.forestSoft,
    paddingVertical: 14,
    borderRadius: radii.md,
    alignItems: "center",
    shadowColor: colors.forest,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryBtnText: { color: colors.textOn, fontWeight: "700", fontSize: 15 },
  savedHintRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    marginTop: 4,
  },
  savedHint: {
    color: colors.forestSoft,
    fontSize: 12,
    fontWeight: "600",
  },
  imageGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  imageTile: {
    width: 84,
    height: 84,
    borderRadius: radii.md,
    overflow: "hidden",
    backgroundColor: colors.surfaceSoft,
  },
  imageTileImg: { width: "100%", height: "100%" },
  addPhotoTile: {
    width: 84,
    height: 84,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderStyle: "dashed",
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  addPhotoText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: "600",
    marginTop: 2,
  },
  helperText: { fontSize: 11, color: colors.textTertiary, marginTop: 4 },
});
