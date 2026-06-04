import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import BottomSheet from "../components/BottomSheet";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthContext";
import {
  fetchPlaceDetails,
  type PlaceSuggestion,
} from "../data/useSubjectSearch";
import {
  SUBJECT_CATEGORIES,
  type Subject,
  type SubjectCategory,
} from "../data/types";
import { colors, radii } from "../theme";

type Props = {
  place: PlaceSuggestion | null;
  onClose: () => void;
  onCreated: (subject: Subject) => void;
  onOpenExisting: (subjectId: string) => void;
};

export default function AddSubjectSheet({
  place,
  onClose,
  onCreated,
  onOpenExisting,
}: Props) {
  const { session } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<SubjectCategory | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflictSubjectId, setConflictSubjectId] = useState<string | null>(null);

  // Reset whenever a new place is picked.
  useEffect(() => {
    if (place) {
      setName(place.mainText);
      setDescription("");
      setCategory(suggestCategory(place.types));
      setBusy(false);
      setError(null);
      setConflictSubjectId(null);
    }
  }, [place]);

  async function handleSubmit() {
    if (!session || !place || !category || !name.trim()) {
      if (!category) setError("Pick a category.");
      else if (!name.trim()) setError("Name is required.");
      return;
    }

    setBusy(true);
    setError(null);

    // Pre-flight: if a subject with this place_id already exists, take the
    // user there instead of inserting. Saves a Place Details call.
    const existing = await supabase
      .from("subjects")
      .select("id")
      .eq("place_id", place.placeId)
      .maybeSingle();

    if (existing.data?.id) {
      setBusy(false);
      setConflictSubjectId(existing.data.id);
      return;
    }

    // Need canonical lat/lng to anchor viewpoints — fetch from Place Details.
    const details = await fetchPlaceDetails(place.placeId);
    if (!details) {
      setBusy(false);
      setError("Couldn't get coordinates for this place. Try again.");
      return;
    }

    const id = await pickAvailableSlug(name.trim());

    const { data, error: insertError } = await supabase
      .from("subjects")
      .insert({
        id,
        name: name.trim(),
        kind: category,
        description: description.trim() || null,
        latitude: details.latitude,
        longitude: details.longitude,
        place_id: place.placeId,
        created_by: session.user.id,
      })
      .select(
        "id, name, kind, latitude, longitude, description, created_by, place_id, created_at",
      )
      .single();

    setBusy(false);

    if (insertError) {
      // Race: another user added the same place_id between our preflight
      // check and our insert. Re-query to find it and offer to view.
      if (insertError.code === "23505") {
        const recheck = await supabase
          .from("subjects")
          .select("id")
          .eq("place_id", place.placeId)
          .maybeSingle();
        if (recheck.data?.id) {
          setConflictSubjectId(recheck.data.id);
          return;
        }
      }
      // eslint-disable-next-line no-console
      console.warn("[add-subject] insert failed", insertError);
      setError(insertError.message);
      return;
    }

    if (!data) {
      setError("Saved, but the response was empty. Try refreshing.");
      return;
    }

    onCreated({
      id: data.id,
      name: data.name,
      kind: data.kind,
      latitude: data.latitude,
      longitude: data.longitude,
      description: data.description,
      createdBy: data.created_by,
      placeId: data.place_id,
      createdAt: data.created_at,
    });
  }

  function handleOpenConflict() {
    if (conflictSubjectId) onOpenExisting(conflictSubjectId);
  }

  if (!session) {
    return (
      <BottomSheet
        visible={!!place}
        onClose={onClose}
        title="Add a subject"
        subtitle="Sign in to add a place to PeakAboo"
      >
        <Text style={styles.bodyText}>
          Adding subjects requires an account so we can credit you and
          maintain quality. Sign in from the header to continue.
        </Text>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet
      visible={!!place}
      onClose={onClose}
      title={conflictSubjectId ? "Already on PeakAboo" : "Add a subject"}
      subtitle={
        conflictSubjectId
          ? "This place is already tracked here."
          : place?.secondaryText ?? undefined
      }
    >
      {conflictSubjectId ? (
        <View style={{ gap: 12 }}>
          <Text style={styles.bodyText}>
            Looks like {place?.mainText ?? "this place"} is already on
            PeakAboo. Open it to see existing viewpoints and recent sightings.
          </Text>
          <Pressable
            onPress={handleOpenConflict}
            style={[styles.primaryBtn]}
          >
            <Text style={styles.primaryBtnText}>View existing</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ gap: 16 }}>
          <View style={{ gap: 6 }}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Snoqualmie Falls"
              placeholderTextColor={colors.textTertiary}
            />
          </View>

          <View style={{ gap: 8 }}>
            <Text style={styles.label}>Category</Text>
            <View style={styles.chipRow}>
              {SUBJECT_CATEGORIES.map((c) => (
                <Pressable
                  key={c.value}
                  onPress={() => setCategory(c.value)}
                  style={[
                    styles.chip,
                    category === c.value && styles.chipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      category === c.value && styles.chipTextActive,
                    ]}
                  >
                    {c.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={{ gap: 6 }}>
            <Text style={styles.label}>Description (optional)</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={description}
              onChangeText={setDescription}
              placeholder="What makes this spot worth visiting?"
              placeholderTextColor={colors.textTertiary}
              multiline
            />
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable
            onPress={handleSubmit}
            disabled={busy || !category || !name.trim()}
            style={[
              styles.primaryBtn,
              (busy || !category || !name.trim()) && { opacity: 0.5 },
            ]}
          >
            {busy ? (
              <ActivityIndicator color={colors.textOn} />
            ) : (
              <View style={styles.primaryBtnInner}>
                <Ionicons
                  name="add-circle"
                  size={16}
                  color={colors.textOn}
                />
                <Text style={styles.primaryBtnText}>Add to PeakAboo</Text>
              </View>
            )}
          </Pressable>
        </View>
      )}
    </BottomSheet>
  );
}

// Map Google place types to our category enum where confidence is high.
// Returns null when we can't be sure — let the user pick.
function suggestCategory(types: string[]): SubjectCategory | null {
  const set = new Set(types);
  if (set.has("natural_feature")) {
    // Natural features could be many things. Don't auto-pick.
    return null;
  }
  if (set.has("park") || set.has("tourist_attraction")) {
    // Defer to user
    return null;
  }
  return null;
}

// Build a slug from the name, falling back to a numeric suffix on collision.
// IDs are short text so they look reasonable in URLs and admin queries.
async function pickAvailableSlug(name: string): Promise<string> {
  const base = slugify(name) || "subject";
  // Try base, then base-2, base-3, etc.
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const { data } = await supabase
      .from("subjects")
      .select("id")
      .eq("id", candidate)
      .maybeSingle();
    if (!data) return candidate;
  }
  // Pathological case: 20 collisions. Append a random suffix.
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

const styles = StyleSheet.create({
  bodyText: { fontSize: 14, color: colors.text, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: "700", color: colors.text },
  input: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  multiline: { minHeight: 60, textAlignVertical: "top" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceSoft,
  },
  chipActive: { backgroundColor: colors.forest },
  chipText: { color: colors.textSecondary, fontWeight: "600", fontSize: 13 },
  chipTextActive: { color: colors.textOn },
  errorText: { fontSize: 12, color: colors.clay, fontWeight: "600" },
  primaryBtn: {
    backgroundColor: colors.forestSoft,
    paddingVertical: 14,
    borderRadius: radii.md,
    alignItems: "center",
  },
  primaryBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  primaryBtnText: { color: colors.textOn, fontWeight: "700", fontSize: 15 },
});
