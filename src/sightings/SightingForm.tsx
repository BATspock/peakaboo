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
  pickImages,
  uploadPendingImages,
  type ImageSource,
  type PendingImage,
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
  icon: keyof typeof Ionicons.glyphMap;
};

const VISIBILITY_LEVELS: Level[] = [
  {
    value: 5,
    label: "Crystal clear",
    hint: "Sharp outline, no haze",
    visible: true,
    score: 10,
    tint: colors.forestSoft,
    icon: "sunny",
  },
  {
    value: 4,
    label: "Mostly visible",
    hint: "Most of it showing, light haze",
    visible: true,
    score: 8,
    tint: colors.leaf,
    icon: "partly-sunny",
  },
  {
    value: 3,
    label: "Partially visible",
    hint: "About half showing, clouds drifting",
    visible: true,
    score: 5,
    tint: colors.peak,
    icon: "cloud-outline",
  },
  {
    value: 2,
    label: "Barely visible",
    hint: "Faint outline, mostly obscured",
    visible: true,
    score: 2,
    tint: colors.ember,
    icon: "cloudy",
  },
  {
    value: 1,
    label: "Hidden",
    hint: "Can't see it at all",
    visible: false,
    score: 0,
    tint: colors.clay,
    icon: "eye-off-outline",
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
  // Photos are captured/picked locally and held here until the user saves.
  // Capture is independent of the sighting — nothing is uploaded or written
  // to the DB until Save creates the sighting row and attaches these.
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [picking, setPicking] = useState(false);

  // Reset everything when the viewpoint changes — fresh form on open.
  useEffect(() => {
    setForm(EMPTY);
    setPendingImages([]);
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

  function notify(msg: string, title = "Almost there") {
    Platform.OS === "web"
      ? // eslint-disable-next-line no-alert
        window.alert(msg)
      : Alert.alert(title, msg);
  }

  // Capture/pick photos — opens the camera or library IMMEDIATELY and holds
  // the result locally. No sighting or visibility level required; nothing is
  // uploaded until Save.
  async function handleAddPhotos(source: ImageSource) {
    if (!session) return;
    setPicking(true);
    try {
      const picked = await pickImages(source);
      if (picked.length > 0) {
        setPendingImages((prev) => [...prev, ...picked]);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // eslint-disable-next-line no-console
      console.warn("[sighting] pick failed", e);
      notify(msg, "Couldn't add photo");
    } finally {
      setPicking(false);
    }
  }

  function handleRemovePending(index: number) {
    setPendingImages((prev) => prev.filter((_, i) => i !== index));
  }

  // Save creates the sighting row, then uploads any held photos to it.
  // This is the ONLY place the visibility level is required.
  async function handleSave() {
    if (!session) return;
    if (form.visible === null) {
      notify("Pick how visible it is first — that's the one required field.");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("sightings")
        .insert({
          viewpoint_id: viewpointId,
          user_id: session.user.id,
          visible: form.visible,
          visibility: form.visibility,
          conditions: form.conditions,
          notes: form.notes.trim() || null,
          observed_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (error || !data) {
        // eslint-disable-next-line no-console
        console.warn("[sighting] save failed", error);
        notify(error?.message ?? "Could not save sighting.", "Save failed");
        return;
      }

      if (pendingImages.length > 0) {
        try {
          await uploadPendingImages({
            sightingId: data.id,
            userId: session.user.id,
            pending: pendingImages,
          });
        } catch (e) {
          // The sighting itself saved; only the photos failed. Surface it but
          // don't lose the sighting.
          const msg = e instanceof Error ? e.message : String(e);
          // eslint-disable-next-line no-console
          console.warn("[sighting] photo upload failed", e);
          notify(
            `Sighting saved, but a photo didn't upload: ${msg}`,
            "Partial save",
          );
        }
      }

      setSavedAt(Date.now());
      onSaved();
      // Reset for the next sighting — same viewpoint, fresh state.
      setForm(EMPTY);
      setPendingImages([]);
    } finally {
      setSaving(false);
    }
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
                <Ionicons
                  name={lvl.icon}
                  size={20}
                  color={active ? colors.textOn : lvl.tint}
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

      <Section
        title={`Photos${pendingImages.length ? ` · ${pendingImages.length}` : ""}`}
      >
        <View style={styles.imageGrid}>
          {pendingImages.map((img, i) => (
            <Pressable
              key={`${img.uri}-${i}`}
              onPress={() =>
                onOpenLightbox?.(
                  pendingImages.map((m) => m.uri),
                  i,
                )
              }
              onLongPress={() => handleRemovePending(i)}
              style={styles.imageTile}
            >
              <Image source={{ uri: img.uri }} style={styles.imageTileImg} />
            </Pressable>
          ))}
          <Pressable
            onPress={() => handleAddPhotos("camera")}
            disabled={picking}
            style={[styles.addPhotoTile, picking && { opacity: 0.6 }]}
          >
            {picking ? (
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
            disabled={picking}
            style={[styles.addPhotoTile, picking && { opacity: 0.6 }]}
          >
            {picking ? (
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
        {pendingImages.length > 0 ? (
          <Text style={styles.helperText}>
            Photos upload when you save. Long-press to remove one.
          </Text>
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
