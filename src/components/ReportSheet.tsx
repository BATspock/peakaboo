import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import BottomSheet from "./BottomSheet";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthContext";
import { colors, radii } from "../theme";
import type { ReportTargetType } from "../data/types";

type Reason =
  | "spam"
  | "inappropriate"
  | "off_topic"
  | "harassment"
  | "misinformation"
  | "other";

const REASONS: { value: Reason; label: string }[] = [
  { value: "spam", label: "Spam" },
  { value: "inappropriate", label: "Inappropriate" },
  { value: "harassment", label: "Harassment" },
  { value: "misinformation", label: "Misinformation" },
  { value: "off_topic", label: "Off-topic" },
  { value: "other", label: "Other" },
];

type Props = {
  target: { type: ReportTargetType; id: string } | null;
  onClose: () => void;
};

export default function ReportSheet({ target, onClose }: Props) {
  const { session } = useAuth();
  const [reason, setReason] = useState<Reason | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Reset on open.
  useEffect(() => {
    if (target) {
      setReason(null);
      setNotes("");
      setError(null);
      setDone(false);
      setSubmitting(false);
    }
  }, [target]);

  async function handleSubmit() {
    if (!session || !target || !reason) return;
    setSubmitting(true);
    setError(null);
    const { error: insertError } = await supabase.from("reports").insert({
      target_type: target.type,
      target_id: target.id,
      // Keep sighting_id populated for the deprecated alias period if
      // the target is a sighting — this lets old admin queries keep
      // working. Drops in a follow-up migration.
      sighting_id: target.type === "sighting" ? target.id : null,
      reporter_user_id: session.user.id,
      reason,
      notes: notes.trim() || null,
    });
    setSubmitting(false);
    if (insertError) {
      const msg =
        insertError.code === "23505"
          ? `You've already reported this ${target.type}. Thanks — we'll review it.`
          : insertError.message;
      setError(msg);
      return;
    }
    setDone(true);
  }

  const targetLabel =
    target?.type === "sighting"
      ? "sighting"
      : target?.type === "viewpoint"
        ? "viewpoint"
        : target?.type === "subject"
          ? "place"
          : "item";

  return (
    <BottomSheet
      visible={!!target}
      onClose={onClose}
      title={done ? "Report submitted" : `Report ${targetLabel}`}
      subtitle={
        done
          ? "Thanks for flagging this. We'll review it shortly."
          : "Help us keep PeakAboo a useful, honest record."
      }
    >
      {done ? (
        <View style={{ gap: 12 }}>
          <Text style={styles.bodyText}>
            Your report has been logged. The PeakAboo team will review it
            and take action if needed. The reported user will not see who
            reported them.
          </Text>
          <Pressable onPress={onClose} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Done</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ gap: 16 }}>
          <View style={{ gap: 8 }}>
            <Text style={styles.label}>
              What's wrong with this {targetLabel}?
            </Text>
            <View style={styles.chipRow}>
              {REASONS.map((r) => (
                <Pressable
                  key={r.value}
                  onPress={() => setReason(r.value)}
                  style={[
                    styles.chip,
                    reason === r.value && styles.chipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      reason === r.value && styles.chipTextActive,
                    ]}
                  >
                    {r.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={{ gap: 6 }}>
            <Text style={styles.label}>Additional context (optional)</Text>
            <TextInput
              style={styles.notes}
              placeholder="Anything else we should know…"
              placeholderTextColor={colors.textTertiary}
              multiline
              value={notes}
              onChangeText={setNotes}
            />
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable
            onPress={handleSubmit}
            disabled={!reason || submitting}
            style={[
              styles.primaryBtn,
              (!reason || submitting) && { opacity: 0.5 },
            ]}
          >
            {submitting ? (
              <ActivityIndicator color={colors.textOn} />
            ) : (
              <Text style={styles.primaryBtnText}>Submit report</Text>
            )}
          </Pressable>
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  bodyText: { fontSize: 14, color: colors.text, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: "700", color: colors.text },
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
  errorText: { fontSize: 12, color: colors.clay, fontWeight: "600" },
  primaryBtn: {
    backgroundColor: colors.forestSoft,
    paddingVertical: 14,
    borderRadius: radii.md,
    alignItems: "center",
  },
  primaryBtnText: { color: colors.textOn, fontWeight: "700", fontSize: 15 },
});
