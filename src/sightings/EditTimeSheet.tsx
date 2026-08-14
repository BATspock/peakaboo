import React, { useEffect, useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import BottomSheet from "../components/BottomSheet";
import DateTimeField from "../components/DateTimeField";
import { supabase } from "../lib/supabase";
import { colors, radii } from "../theme";
import type { ObservedAtSource } from "../lib/observedAt";

// Lets the owner correct WHEN a sighting was observed after saving it.
// Every change is recorded publicly by the trigger from migration 0017, and
// migration 0016 rejects future timestamps, so this screen does not need to
// re-implement either guarantee.

export type EditTimeTarget = {
  id: string;
  observed_at: string;
};

type Props = {
  target: EditTimeTarget | null;
  onClose: () => void;
  onSaved: () => void;
};

export default function EditTimeSheet({ target, onClose, onSaved }: Props) {
  const [observedAt, setObservedAt] = useState<string>(
    target?.observed_at ?? new Date().toISOString(),
  );
  const [source, setSource] = useState<ObservedAtSource>("manual");
  const [saving, setSaving] = useState(false);

  // Re-seed whenever a different sighting is opened.
  useEffect(() => {
    if (target) {
      setObservedAt(target.observed_at);
      setSource("manual");
    }
  }, [target?.id, target?.observed_at]);

  function notify(msg: string, title: string) {
    Platform.OS === "web"
      ? // eslint-disable-next-line no-alert
        window.alert(msg)
      : Alert.alert(title, msg);
  }

  async function handleSave() {
    if (!target) return;
    if (observedAt === target.observed_at) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("sightings")
        .update({ observed_at: observedAt })
        .eq("id", target.id);
      if (error) {
        // eslint-disable-next-line no-console
        console.warn("[sighting] time update failed", error);
        notify(error.message, "Couldn't update time");
        return;
      }
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet
      visible={target !== null}
      onClose={onClose}
      title="Update observation time"
      subtitle="Everyone can see that a time was changed."
    >
      <DateTimeField
        value={observedAt}
        source={source}
        onChange={(iso, src) => {
          setObservedAt(iso);
          setSource(src);
        }}
      />
      <View style={{ gap: 8 }}>
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
            {saving ? "Saving…" : "Save new time"}
          </Text>
        </Pressable>
        <Text style={styles.helperText}>
          The original upload time is kept and shown in the sighting's history.
        </Text>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  primaryBtn: {
    backgroundColor: colors.forestSoft,
    paddingVertical: 14,
    borderRadius: radii.md,
    alignItems: "center",
  },
  primaryBtnText: { color: colors.textOn, fontWeight: "700", fontSize: 15 },
  helperText: {
    fontSize: 11,
    color: colors.textTertiary,
    textAlign: "center",
  },
});
