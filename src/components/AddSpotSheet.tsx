import React, { useEffect, useMemo, useState } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import BottomSheet from "./BottomSheet";
import SubjectPicker from "./SubjectPicker";
import { useAuth } from "../auth/AuthContext";
import { supabase } from "../lib/supabase";
import {
  useSubjectSearch,
  type PlaceSuggestion,
} from "../data/useSubjectSearch";
import {
  createSubjectFromPlace,
  createViewpoint,
  suggestCategory,
} from "../data/addSpot";
import {
  SUBJECT_CATEGORIES,
  type Subject,
  type SubjectCategory,
} from "../data/types";
import { colors, radii } from "../theme";

type Coords = { latitude: number; longitude: number } | null;

type Props = {
  visible: boolean;
  onClose: () => void;
  // "viewpoint" = full 3-step wizard (landmark → location → name).
  // "landmark"  = single screen to add a new landmark (subject) only.
  mode: "viewpoint" | "landmark";
  subjects: Subject[];
  defaultSubjectId: string | null;
  pinDropCoords: Coords;
  // Bumped by the parent for a brand-new add (the FAB/buttons) so the wizard
  // resets. The pin-drop round-trip reopens WITHOUT bumping this, preserving
  // in-progress input.
  resetNonce: number;
  // When launched from the home-search "Add new" result, the place is
  // pre-staged as a new landmark.
  seedPlace?: PlaceSuggestion | null;
  onRequestPinDrop: () => void;
  onCreated: (viewpointId: string) => void;
  onSubjectOnlyCreated: (subjectId: string) => void;
  // Dedup panel → open an existing nearby viewpoint.
  onOpenExistingViewpoint: (viewpointId: string) => void;
  // New-landmark conflict (place already added) → activate that subject.
  onOpenExistingSubject: (subjectId: string) => void;
};

type NearbyMatch = { id: string; name: string; distance_m: number };

export default function AddSpotSheet({
  visible,
  onClose,
  mode,
  subjects,
  defaultSubjectId,
  pinDropCoords,
  resetNonce,
  seedPlace,
  onRequestPinDrop,
  onCreated,
  onSubjectOnlyCreated,
  onOpenExistingViewpoint,
  onOpenExistingSubject,
}: Props) {
  const { session, openAuthSheet } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [coords, setCoords] = useState<Coords>(null);
  const [showCoordInput, setShowCoordInput] = useState(false);
  const [coordInput, setCoordInput] = useState({ lat: "", lng: "" });

  // Landmark selection — exactly one of these is "active".
  const [existingSubjectId, setExistingSubjectId] = useState<string | null>(
    null,
  );
  const [newPlace, setNewPlace] = useState<PlaceSuggestion | null>(null);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<SubjectCategory | null>(null);

  // "Add a new landmark" search (Step 2).
  const [addQuery, setAddQuery] = useState("");
  const { existing, suggestions, loading: searchLoading } =
    useSubjectSearch(addQuery);

  const [vpName, setVpName] = useState("");
  const [vpDescription, setVpDescription] = useState("");
  const [busy, setBusy] = useState<"location" | "saving" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [nearbyMatches, setNearbyMatches] = useState<NearbyMatch[]>([]);
  const [overrideDedup, setOverrideDedup] = useState(false);

  // Reset ONLY on a fresh add (resetNonce bumps). Not on every `visible` flip,
  // so the pin-drop round-trip preserves in-progress input.
  useEffect(() => {
    setCoords(null);
    setShowCoordInput(false);
    setCoordInput({ lat: "", lng: "" });
    setExistingSubjectId(null);
    setNewName("");
    setNewCategory(null);
    setAddQuery("");
    setVpName("");
    setVpDescription("");
    setBusy(null);
    setError(null);
    setNearbyMatches([]);
    setOverrideDedup(false);
    if (seedPlace) {
      // Launched from home-search "Add new" → pre-stage the searched landmark
      // so Step 2 is already filled in, but still start at Step 1. The wizard
      // is linear (location → landmark → name); jumping straight to Step 2
      // would skip the required location step and confuse the user.
      setNewPlace(seedPlace);
      setNewName(seedPlace.mainText);
      setNewCategory(suggestCategory(seedPlace.types, seedPlace.mainText));
    } else {
      setNewPlace(null);
    }
    setStep(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetNonce]);

  // When the parent finishes a pin drop, capture coords and return to the
  // location step (Step 2 in the landmark-first viewpoint flow).
  useEffect(() => {
    if (pinDropCoords) {
      setCoords(pinDropCoords);
      setStep(2);
    }
  }, [pinDropCoords]);

  const landmarkName = useMemo(() => {
    if (existingSubjectId) {
      return subjects.find((s) => s.id === existingSubjectId)?.name ?? "";
    }
    if (newPlace) return newName.trim() || newPlace.mainText;
    return "";
  }, [existingSubjectId, newPlace, newName, subjects]);

  // Dedup check — only meaningful for an EXISTING subject (a brand-new
  // landmark can't have viewpoints yet). Mirrors the old AddViewpointSheet.
  useEffect(() => {
    if (!coords || !existingSubjectId) {
      setNearbyMatches([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error: rpcError } = await supabase.rpc(
        "find_nearby_viewpoint",
        {
          p_subject_id: existingSubjectId,
          p_lat: coords.latitude,
          p_lng: coords.longitude,
          p_meters: 200,
        },
      );
      if (cancelled) return;
      if (rpcError) {
        // eslint-disable-next-line no-console
        console.warn("[add-spot] dedup check failed", rpcError.message);
        return;
      }
      setNearbyMatches(
        (data ?? []).map((r: any) => ({
          id: r.id,
          name: r.name,
          distance_m: r.distance_m,
        })),
      );
      setOverrideDedup(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [coords, existingSubjectId]);

  if (!session) {
    return (
      <BottomSheet
        visible={visible}
        onClose={onClose}
        title="Add a spot"
        subtitle="Sign in to add a place to PeakAboo"
      >
        <View style={{ gap: 12 }}>
          <Text style={styles.bodyText}>
            Adding a spot requires an account so we can credit you and keep
            quality high.
          </Text>
          <Pressable style={styles.primaryBtn} onPress={openAuthSheet}>
            <Text style={styles.primaryBtnText}>Sign in to continue</Text>
          </Pressable>
        </View>
      </BottomSheet>
    );
  }

  // ── Step helpers ─────────────────────────────────────────────────────
  function applyCoordInput() {
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
      notify("Latitude must be -90 to 90, longitude -180 to 180.");
      return;
    }
    setCoords({ latitude: lat, longitude: lng });
  }

  async function useMyLocation() {
    setBusy("location");
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") throw new Error("Location permission denied.");
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoords({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  function pickExistingLandmark(id: string) {
    setExistingSubjectId(id);
    setNewPlace(null);
    setNewCategory(null);
    setAddQuery("");
  }

  function stageNewLandmark(place: PlaceSuggestion) {
    setNewPlace(place);
    setNewName(place.mainText);
    setNewCategory(suggestCategory(place.types, place.mainText));
    setExistingSubjectId(null);
    setAddQuery("");
  }

  const landmarkChosen =
    !!existingSubjectId ||
    (!!newPlace && !!newCategory && newName.trim().length > 0);

  async function handleSave() {
    if (!session || !coords) {
      notify("Pick a location first.");
      return;
    }
    setBusy("saving");
    setError(null);

    // Resolve the subject — create it first if this is a new landmark.
    let subjectId = existingSubjectId;
    if (!subjectId && newPlace && newCategory) {
      const res = await createSubjectFromPlace({
        place: newPlace,
        category: newCategory,
        name: newName,
        description: "",
        userId: session.user.id,
      });
      if (res.kind === "error") {
        setBusy(null);
        setError(res.message);
        return;
      }
      // If the landmark already existed, just add the viewpoint to it.
      subjectId =
        res.kind === "created" ? res.subject.id : res.conflictSubjectId;
    }
    if (!subjectId) {
      setBusy(null);
      setError("Pick what you can see from here.");
      return;
    }

    const finalName = vpName.trim() || `View of ${landmarkName}`;
    const res = await createViewpoint({
      subjectId,
      name: finalName,
      description: vpDescription,
      coords,
      userId: session.user.id,
    });
    setBusy(null);
    if (res.kind === "error") {
      setError(res.message);
      return;
    }
    onCreated(res.viewpointId);
    onClose();
  }

  async function handleSubjectOnly() {
    if (!session || !newPlace || !newCategory) return;
    setBusy("saving");
    setError(null);
    const res = await createSubjectFromPlace({
      place: newPlace,
      category: newCategory,
      name: newName,
      description: "",
      userId: session.user.id,
    });
    setBusy(null);
    if (res.kind === "error") {
      setError(res.message);
      return;
    }
    if (res.kind === "conflict") {
      onOpenExistingSubject(res.conflictSubjectId);
    } else {
      onSubjectOnlyCreated(res.subject.id);
    }
    onClose();
  }

  function notify(msg: string) {
    Platform.OS === "web"
      ? // eslint-disable-next-line no-alert
        window.alert(msg)
      : Alert.alert("Heads up", msg);
  }

  // ── Landmark mode: a single screen to add a new landmark (subject) ────
  if (mode === "landmark") {
    return (
      <BottomSheet
        visible={visible}
        onClose={onClose}
        title="Add a landmark"
        subtitle="A new thing to look at — a peak, waterfall, or skyline."
      >
        <View style={{ gap: 14 }}>
          <Text style={styles.label}>Find the landmark</Text>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={14} color={colors.textTertiary} />
            <TextInput
              style={styles.searchInput}
              value={addQuery}
              onChangeText={setAddQuery}
              placeholder="Search a peak, waterfall, skyline…"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="words"
              autoCorrect={false}
            />
            {searchLoading ? <ActivityIndicator size="small" /> : null}
          </View>

          {/* Already in PeakAboo → offer to open it instead of duplicating */}
          {existing.length > 0 ? (
            <View style={{ gap: 4 }}>
              {existing.map((s) => (
                <Pressable
                  key={s.id}
                  style={styles.resultRow}
                  onPress={() => {
                    onOpenExistingSubject(s.id);
                    onClose();
                  }}
                >
                  <Ionicons name="triangle" size={14} color={colors.forest} />
                  <Text style={styles.resultText} numberOfLines={1}>
                    {s.name}
                  </Text>
                  <Text style={styles.resultTag}>already added</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {suggestions.length > 0 ? (
            <View style={{ gap: 4 }}>
              {suggestions.map((p) => (
                <Pressable
                  key={p.placeId}
                  style={styles.resultRow}
                  onPress={() => stageNewLandmark(p)}
                >
                  <Ionicons
                    name="add-circle"
                    size={16}
                    color={colors.forestSoft}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultText} numberOfLines={1}>
                      {p.mainText}
                    </Text>
                    <Text style={styles.resultSub} numberOfLines={1}>
                      {p.secondaryText}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}

          {newPlace ? (
            <View style={styles.newPanel}>
              <Text style={styles.newPanelTitle}>New landmark</Text>
              <TextInput
                style={styles.input}
                value={newName}
                onChangeText={setNewName}
                placeholder="Name"
                placeholderTextColor={colors.textTertiary}
              />
              <Text style={styles.label}>Category</Text>
              <View style={styles.chipRow}>
                {SUBJECT_CATEGORIES.map((c) => (
                  <Pressable
                    key={c.value}
                    onPress={() => setNewCategory(c.value)}
                    style={[
                      styles.chip,
                      newCategory === c.value && styles.chipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        newCategory === c.value && styles.chipTextActive,
                      ]}
                    >
                      {c.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable
            onPress={handleSubjectOnly}
            disabled={
              busy === "saving" || !newPlace || !newCategory || !newName.trim()
            }
            style={[
              styles.primaryBtn,
              (busy === "saving" ||
                !newPlace ||
                !newCategory ||
                !newName.trim()) && { opacity: 0.5 },
            ]}
          >
            {busy === "saving" ? (
              <ActivityIndicator color={colors.textOn} />
            ) : (
              <Text style={styles.primaryBtnText}>Add landmark</Text>
            )}
          </Pressable>
        </View>
      </BottomSheet>
    );
  }

  // ── Viewpoint mode: landmark-first 3-step wizard ──────────────────────
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Add a viewpoint"
      subtitle={`Step ${step} of 3`}
    >
      <View style={{ gap: 18 }}>
        {/* ── STEP 2 — Location (where you look from) ───────────────── */}
        {step === 2 ? (
          <View style={{ gap: 12 }}>
            <Text style={styles.stepTitle}>Where are you?</Text>
            <Text style={styles.stepHint}>
              The spot you're standing at — where the view is from.
            </Text>

            <Pressable
              onPress={useMyLocation}
              disabled={busy === "location"}
              style={[styles.heroBtn, busy === "location" && { opacity: 0.6 }]}
            >
              {busy === "location" ? (
                <ActivityIndicator color={colors.textOn} />
              ) : (
                <>
                  <Ionicons name="navigate" size={18} color={colors.textOn} />
                  <Text style={styles.heroBtnText}>Use my location</Text>
                </>
              )}
            </Pressable>

            <Pressable onPress={onRequestPinDrop} style={styles.secondaryBtn}>
              <Ionicons name="location" size={16} color={colors.text} />
              <Text style={styles.secondaryBtnText}>Drop a pin on the map</Text>
            </Pressable>

            {showCoordInput ? (
              <View style={{ gap: 8 }}>
                <View style={styles.coordRow}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="Latitude"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="numbers-and-punctuation"
                    value={coordInput.lat}
                    onChangeText={(t) =>
                      setCoordInput((c) => ({ ...c, lat: t }))
                    }
                  />
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="Longitude"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="numbers-and-punctuation"
                    value={coordInput.lng}
                    onChangeText={(t) =>
                      setCoordInput((c) => ({ ...c, lng: t }))
                    }
                  />
                </View>
                <Pressable onPress={applyCoordInput} style={styles.secondaryBtn}>
                  <Text style={styles.secondaryBtnText}>Use these coordinates</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => setShowCoordInput(true)}
                style={styles.moreLink}
              >
                <Text style={styles.moreLinkText}>Enter coordinates instead</Text>
              </Pressable>
            )}

            {coords ? (
              <View style={styles.coordsConfirm}>
                <Ionicons name="location" size={14} color={colors.forest} />
                <Text style={styles.coordsConfirmText}>
                  {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* ── STEP 1 — Which landmark? ──────────────────────────────── */}
        {step === 1 ? (
          <View style={{ gap: 14 }}>
            <Text style={styles.stepTitle}>Which landmark can you see?</Text>
            <Text style={styles.stepHint}>
              Pick one, or search to add a new landmark.
            </Text>

            <SubjectPicker
              subjects={subjects}
              selectedId={existingSubjectId}
              onSelect={pickExistingLandmark}
            />

            <View style={styles.divider} />

            <Text style={styles.label}>Don't see it? Add a new landmark</Text>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={14} color={colors.textTertiary} />
              <TextInput
                style={styles.searchInput}
                value={addQuery}
                onChangeText={setAddQuery}
                placeholder="Search a peak, waterfall, skyline…"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="words"
                autoCorrect={false}
              />
              {searchLoading ? <ActivityIndicator size="small" /> : null}
            </View>

            {existing.length > 0 ? (
              <View style={{ gap: 4 }}>
                {existing.map((s) => (
                  <Pressable
                    key={s.id}
                    style={styles.resultRow}
                    onPress={() => pickExistingLandmark(s.id)}
                  >
                    <Ionicons name="triangle" size={14} color={colors.forest} />
                    <Text style={styles.resultText} numberOfLines={1}>
                      {s.name}
                    </Text>
                    <Text style={styles.resultTag}>in PeakAboo</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {suggestions.length > 0 ? (
              <View style={{ gap: 4 }}>
                {suggestions.map((p) => (
                  <Pressable
                    key={p.placeId}
                    style={styles.resultRow}
                    onPress={() => stageNewLandmark(p)}
                  >
                    <Ionicons
                      name="add-circle"
                      size={16}
                      color={colors.forestSoft}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.resultText} numberOfLines={1}>
                        {p.mainText}
                      </Text>
                      <Text style={styles.resultSub} numberOfLines={1}>
                        {p.secondaryText}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {/* Staged-new landmark mini-form: required category + editable name */}
            {newPlace ? (
              <View style={styles.newPanel}>
                <Text style={styles.newPanelTitle}>New landmark</Text>
                <TextInput
                  style={styles.input}
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="Name"
                  placeholderTextColor={colors.textTertiary}
                />
                <Text style={styles.label}>Category</Text>
                <View style={styles.chipRow}>
                  {SUBJECT_CATEGORIES.map((c) => (
                    <Pressable
                      key={c.value}
                      onPress={() => setNewCategory(c.value)}
                      style={[
                        styles.chip,
                        newCategory === c.value && styles.chipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          newCategory === c.value && styles.chipTextActive,
                        ]}
                      >
                        {c.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Selected confirmation */}
            {existingSubjectId ? (
              <View style={styles.selectedBanner}>
                <Ionicons name="triangle" size={16} color={colors.textOn} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.selectedBannerLabel}>This spot shows</Text>
                  <Text style={styles.selectedBannerName} numberOfLines={1}>
                    {landmarkName}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* ── STEP 3 — Name + Save ──────────────────────────────────── */}
        {step === 3 ? (
          <View style={{ gap: 14 }}>
            <Text style={styles.stepTitle}>Name this spot</Text>
            <View style={styles.selectedBanner}>
              <Ionicons name="triangle" size={16} color={colors.textOn} />
              <View style={{ flex: 1 }}>
                <Text style={styles.selectedBannerLabel}>This spot shows</Text>
                <Text style={styles.selectedBannerName} numberOfLines={1}>
                  {landmarkName}
                </Text>
              </View>
            </View>

            <View style={{ gap: 6 }}>
              <Text style={styles.label}>Spot name (optional)</Text>
              <TextInput
                style={styles.input}
                value={vpName}
                onChangeText={setVpName}
                placeholder={`View of ${landmarkName}`}
                placeholderTextColor={colors.textTertiary}
              />
            </View>

            <View style={{ gap: 6 }}>
              <Text style={styles.label}>Description (optional)</Text>
              <TextInput
                style={[styles.input, styles.multiline]}
                value={vpDescription}
                onChangeText={setVpDescription}
                placeholder="Tip: best at sunset, partial blockage…"
                placeholderTextColor={colors.textTertiary}
                multiline
              />
            </View>

            {nearbyMatches.length > 0 && !overrideDedup ? (
              <View style={styles.dedupPanel}>
                <View style={styles.dedupHeaderRow}>
                  <Ionicons
                    name="information-circle"
                    size={16}
                    color={colors.ember}
                  />
                  <Text style={styles.dedupTitle}>
                    Looks like this might already exist
                  </Text>
                </View>
                <Text style={styles.dedupSubtitle}>
                  {nearbyMatches.length === 1
                    ? "1 viewpoint"
                    : `${nearbyMatches.length} viewpoints`}{" "}
                  within 200m:
                </Text>
                {nearbyMatches.map((m) => (
                  <Pressable
                    key={m.id}
                    onPress={() => {
                      onOpenExistingViewpoint(m.id);
                      onClose();
                    }}
                    style={styles.dedupRow}
                  >
                    <Ionicons
                      name="location-outline"
                      size={14}
                      color={colors.text}
                    />
                    <Text numberOfLines={1} style={styles.dedupName}>
                      {m.name}
                    </Text>
                    <Text style={styles.dedupDistance}>
                      {Math.round(m.distance_m)}m
                    </Text>
                  </Pressable>
                ))}
                <Pressable
                  onPress={() => setOverrideDedup(true)}
                  style={styles.dedupOverride}
                >
                  <Text style={styles.dedupOverrideText}>
                    Add anyway — this is a different spot
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              onPress={handleSave}
              disabled={busy === "saving"}
              style={[styles.primaryBtn, busy === "saving" && { opacity: 0.6 }]}
            >
              {busy === "saving" ? (
                <ActivityIndicator color={colors.textOn} />
              ) : (
                <Text style={styles.primaryBtnText}>Save spot</Text>
              )}
            </Pressable>

            {newPlace ? (
              <Pressable
                onPress={handleSubjectOnly}
                disabled={busy === "saving"}
                style={styles.tertiaryBtn}
              >
                <Text style={styles.tertiaryBtnText}>
                  Just add the landmark for now
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {/* ── Wizard navigation ─────────────────────────────────────── */}
        <View style={styles.navRow}>
          {step > 1 ? (
            <Pressable
              onPress={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
              style={styles.backBtn}
            >
              <Ionicons name="chevron-back" size={16} color={colors.text} />
              <Text style={styles.backBtnText}>Back</Text>
            </Pressable>
          ) : (
            <View style={{ flex: 1 }} />
          )}

          {step < 3 ? (
            <Pressable
              onPress={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
              disabled={step === 1 ? !landmarkChosen : !coords}
              style={[
                styles.nextBtn,
                (step === 1 ? !landmarkChosen : !coords) && { opacity: 0.45 },
              ]}
            >
              <Text style={styles.nextBtnText}>Next</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textOn} />
            </Pressable>
          ) : null}
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  bodyText: { fontSize: 14, color: colors.text, lineHeight: 20 },
  stepTitle: { fontSize: 17, fontWeight: "800", color: colors.text },
  stepHint: { fontSize: 13, color: colors.textSecondary, marginTop: -4 },
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
  coordRow: { flexDirection: "row", gap: 8 },

  heroBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.forestSoft,
    paddingVertical: 14,
    borderRadius: radii.md,
  },
  heroBtnText: { color: colors.textOn, fontWeight: "800", fontSize: 15 },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.surfaceSoft,
    paddingVertical: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryBtnText: { color: colors.text, fontWeight: "700", fontSize: 14 },
  moreLink: { alignItems: "center", paddingVertical: 4 },
  moreLinkText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "600",
    textDecorationLine: "underline",
  },

  coordsConfirm: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.leafBg,
    borderRadius: radii.sm,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  coordsConfirmText: { color: colors.forest, fontWeight: "600", fontSize: 13 },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 2,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: 13, color: colors.text, padding: 0 },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceSoft,
  },
  resultText: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.text },
  resultSub: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  resultTag: { fontSize: 11, color: colors.textTertiary, fontWeight: "600" },

  newPanel: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.md,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  newPanelTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.forest, borderColor: colors.forest },
  chipText: { color: colors.textSecondary, fontWeight: "600", fontSize: 13 },
  chipTextActive: { color: colors.textOn },

  selectedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.forest,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  selectedBannerLabel: {
    fontSize: 11,
    color: colors.textOn,
    opacity: 0.75,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  selectedBannerName: {
    fontSize: 15,
    color: colors.textOn,
    fontWeight: "800",
    marginTop: 1,
  },

  dedupPanel: {
    backgroundColor: colors.peakSoft,
    borderRadius: radii.md,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.peak,
  },
  dedupHeaderRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dedupTitle: { fontSize: 13, fontWeight: "700", color: colors.emberDark },
  dedupSubtitle: { fontSize: 12, color: colors.text },
  dedupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  dedupName: { flex: 1, fontSize: 13, fontWeight: "600", color: colors.text },
  dedupDistance: { fontSize: 11, color: colors.textSecondary, fontWeight: "600" },
  dedupOverride: { paddingVertical: 6, alignItems: "center" },
  dedupOverrideText: {
    fontSize: 12,
    color: colors.emberDark,
    fontWeight: "700",
    textDecorationLine: "underline",
  },

  errorText: { fontSize: 12, color: colors.clay, fontWeight: "600" },

  primaryBtn: {
    backgroundColor: colors.forestSoft,
    paddingVertical: 14,
    borderRadius: radii.md,
    alignItems: "center",
  },
  primaryBtnText: { color: colors.textOn, fontWeight: "700", fontSize: 15 },
  tertiaryBtn: { alignItems: "center", paddingVertical: 8 },
  tertiaryBtnText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "700",
    textDecorationLine: "underline",
  },

  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  backBtnText: { fontSize: 14, fontWeight: "700", color: colors.text },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.forest,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: radii.md,
  },
  nextBtnText: { fontSize: 14, fontWeight: "800", color: colors.textOn },
});
