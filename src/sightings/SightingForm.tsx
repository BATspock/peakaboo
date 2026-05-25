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
import { viewpointDateKey } from "../lib/time";
import { pickAndUploadImages, type UploadedImage } from "./uploadImages";

const CONDITIONS: SightingCondition[] = [
  "clear",
  "cloudy",
  "snowy",
  "hazy",
  "rainy",
];

type Props = {
  viewpointId: string;
  subjectName: string;
  onSaved: () => void;
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
}: Props) {
  const { session, signInWithGoogle } = useAuth();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [hydrating, setHydrating] = useState<boolean>(!!session);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [uploading, setUploading] = useState(false);

  // Hydrate today's existing sighting (if any) so editing is in-place.
  useEffect(() => {
    if (!session) {
      setHydrating(false);
      setForm(EMPTY);
      setExistingId(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setHydrating(true);
      const today = viewpointDateKey();
      const { data, error } = await supabase
        .from("sightings")
        .select("id, visible, visibility, conditions, notes")
        .eq("user_id", session.user.id)
        .eq("viewpoint_id", viewpointId)
        .eq("observed_on", today)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        // eslint-disable-next-line no-console
        console.warn("[sighting] hydrate failed", error.message);
        setHydrating(false);
        return;
      }
      if (data) {
        setExistingId(data.id);
        setForm({
          visible: data.visible,
          visibility: data.visibility ?? 5,
          conditions: data.conditions,
          notes: data.notes ?? "",
        });

        // Load already-uploaded images for today's sighting.
        const { data: imgs } = await supabase
          .from("sighting_images")
          .select("id, storage_path, width, height")
          .eq("sighting_id", data.id);
        if (cancelled) return;
        setImages(
          (imgs ?? []).map((r) => ({
            id: r.id,
            storage_path: r.storage_path,
            width: r.width,
            height: r.height,
            publicUrl: supabase.storage
              .from("sightings")
              .getPublicUrl(r.storage_path).data.publicUrl,
          })),
        );
      } else {
        setExistingId(null);
        setForm(EMPTY);
        setImages([]);
      }
      setHydrating(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [session, viewpointId]);

  if (!session) {
    return (
      <View style={styles.signedOut}>
        <Text style={styles.signedOutText}>
          Sign in to log whether you can see {subjectName} today.
        </Text>
        <Pressable
          style={styles.primaryBtn}
          onPress={() => signInWithGoogle().catch(() => undefined)}
        >
          <Text style={styles.primaryBtnText}>Sign in to log a sighting</Text>
        </Pressable>
      </View>
    );
  }

  if (hydrating) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  async function handleSave() {
    if (!session) return;
    if (form.visible === null) {
      const msg = "Tell us if you can see it — yes or no.";
      Platform.OS === "web"
        ? // eslint-disable-next-line no-alert
          window.alert(msg)
        : Alert.alert("Almost there", msg);
      return;
    }

    setSaving(true);
    const payload = {
      viewpoint_id: viewpointId,
      user_id: session.user.id,
      visible: form.visible,
      visibility: form.visibility,
      conditions: form.conditions,
      notes: form.notes.trim() || null,
      observed_at: new Date().toISOString(),
    };

    const op = existingId
      ? supabase
          .from("sightings")
          .update(payload)
          .eq("id", existingId)
          .select("id")
          .single()
      : supabase.from("sightings").insert(payload).select("id").single();

    const { data, error } = await op;
    setSaving(false);

    if (error) {
      // eslint-disable-next-line no-console
      console.warn("[sighting] save failed", error);
      const msg = error.message;
      Platform.OS === "web"
        ? // eslint-disable-next-line no-alert
          window.alert(`Save failed: ${msg}`)
        : Alert.alert("Save failed", msg);
      return;
    }
    if (data?.id && !existingId) setExistingId(data.id);
    setSavedAt(Date.now());
    onSaved();
  }

  async function handleAddPhotos() {
    if (!session) return;

    let sightingId = existingId;
    if (!sightingId) {
      // Need a parent sighting first — save with current form state, then upload.
      if (form.visible === null) {
        const msg =
          "Tell us yes or no first — then we'll attach photos to the sighting.";
        Platform.OS === "web"
          ? // eslint-disable-next-line no-alert
            window.alert(msg)
          : Alert.alert("Almost there", msg);
        return;
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
        const msg = error?.message ?? "Could not create sighting.";
        Platform.OS === "web"
          ? // eslint-disable-next-line no-alert
            window.alert(`Save failed: ${msg}`)
          : Alert.alert("Save failed", msg);
        return;
      }
      sightingId = data.id;
      setExistingId(sightingId);
      setSavedAt(Date.now());
    }

    if (!sightingId) return; // unreachable; satisfies the type checker
    setUploading(true);
    try {
      const newOnes = await pickAndUploadImages({
        sightingId,
        userId: session.user.id,
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

  return (
    <View style={{ gap: 18 }}>
      <Section title={`Can you see ${subjectName} right now?`}>
        <View style={styles.yesNoRow}>
          <BigToggle
            label="Yes"
            tint="#16A34A"
            active={form.visible === true}
            onPress={() => setForm((f) => ({ ...f, visible: true }))}
          />
          <BigToggle
            label="No"
            tint="#DC2626"
            active={form.visible === false}
            onPress={() => setForm((f) => ({ ...f, visible: false }))}
          />
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

      <Section
        title={`Visibility · ${form.visibility}/10`}
        subtitle="0 = not at all, 10 = crystal clear"
      >
        <View style={styles.scaleRow}>
          {Array.from({ length: 11 }, (_, i) => i).map((n) => (
            <Pressable
              key={n}
              onPress={() => setForm((f) => ({ ...f, visibility: n }))}
              style={[
                styles.scaleBtn,
                form.visibility === n && styles.scaleBtnActive,
              ]}
            >
              <Text
                style={[
                  styles.scaleBtnText,
                  form.visibility === n && styles.scaleBtnTextActive,
                ]}
              >
                {n}
              </Text>
            </Pressable>
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
          {images.map((img) => (
            <Pressable
              key={img.id}
              onLongPress={() => handleRemoveImage(img)}
              style={styles.imageTile}
            >
              <Image source={{ uri: img.publicUrl }} style={styles.imageTileImg} />
            </Pressable>
          ))}
          <Pressable
            onPress={handleAddPhotos}
            disabled={uploading}
            style={[styles.addPhotoTile, uploading && { opacity: 0.6 }]}
          >
            {uploading ? (
              <ActivityIndicator />
            ) : (
              <>
                <Text style={styles.addPhotoPlus}>+</Text>
                <Text style={styles.addPhotoText}>Add</Text>
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
            {saving
              ? "Saving…"
              : existingId
                ? "Update sighting"
                : "Save sighting"}
          </Text>
        </Pressable>
        {savedAt && Date.now() - savedAt < 4000 ? (
          <Text style={styles.savedHint}>
            ✓ Saved — your sighting is live in the feed below.
          </Text>
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

function BigToggle({
  label,
  tint,
  active,
  onPress,
}: {
  label: string;
  tint: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.bigToggle,
        active && { backgroundColor: tint, borderColor: tint },
      ]}
    >
      <Text
        style={[
          styles.bigToggleText,
          active && styles.bigToggleTextActive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
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
  signedOutText: { fontSize: 14, color: "#475569", textAlign: "center" },

  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  sectionSub: { fontSize: 12, color: "#64748B", marginTop: 2 },

  yesNoRow: { flexDirection: "row", gap: 12 },
  bigToggle: {
    flex: 1,
    paddingVertical: 18,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    alignItems: "center",
  },
  bigToggleText: { fontSize: 16, fontWeight: "700", color: "#475569" },
  bigToggleTextActive: { color: "#FFFFFF" },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
    textTransform: "capitalize",
  },
  chipActive: { backgroundColor: "#0F172A" },
  chipText: {
    color: "#475569",
    fontWeight: "600",
    fontSize: 13,
    textTransform: "capitalize",
  },
  chipTextActive: { color: "#FFFFFF" },

  scaleRow: { flexDirection: "row", gap: 4 },
  scaleBtn: {
    flex: 1,
    minWidth: 28,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
  },
  scaleBtnActive: { backgroundColor: "#0F172A" },
  scaleBtnText: { fontSize: 13, fontWeight: "600", color: "#475569" },
  scaleBtnTextActive: { color: "#FFFFFF" },

  notes: {
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 64,
    fontSize: 14,
    color: "#0F172A",
    textAlignVertical: "top",
  },

  primaryBtn: {
    backgroundColor: "#0F172A",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },
  savedHint: {
    color: "#16A34A",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 4,
  },
  imageGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  imageTile: {
    width: 84,
    height: 84,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#F1F5F9",
  },
  imageTileImg: { width: "100%", height: "100%" },
  addPhotoTile: {
    width: 84,
    height: 84,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderStyle: "dashed",
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },
  addPhotoPlus: { fontSize: 22, color: "#94A3B8", lineHeight: 24 },
  addPhotoText: { fontSize: 11, color: "#94A3B8", fontWeight: "600" },
  helperText: { fontSize: 11, color: "#94A3B8", marginTop: 4 },
});
