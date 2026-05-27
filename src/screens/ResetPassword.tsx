import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../lib/supabase";
import { colors, radii } from "../theme";

/**
 * Lands here from the password-reset email Supabase sends. The URL hash
 * carries access_token + refresh_token + type=recovery. We hydrate the
 * session, then let the user pick a new password.
 */
export default function ResetPasswordScreen() {
  const [phase, setPhase] = useState<
    "hydrating" | "ready" | "saving" | "done" | "expired"
  >("hydrating");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    (async () => {
      // Supabase puts tokens in the URL hash for recovery flows.
      const hash = window.location.hash.startsWith("#")
        ? window.location.hash.slice(1)
        : "";
      const params = new URLSearchParams(hash);
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");
      const type = params.get("type");

      if (type === "recovery" && access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });
        if (cancelled) return;
        if (error) {
          setError(error.message);
          setPhase("expired");
          return;
        }
        setPhase("ready");
        return;
      }

      // No tokens in URL — link expired or already used.
      setPhase("expired");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave() {
    setError(null);
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setPhase("saving");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setPhase("ready");
      return;
    }
    setPhase("done");
  }

  function handleHome() {
    if (typeof window !== "undefined") window.location.href = "/";
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable onPress={handleHome} hitSlop={6} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={18} color={colors.forest} />
          <Text style={styles.backText}>Back to PeakAboo</Text>
        </Pressable>
        <Text style={styles.title}>
          <Text style={styles.titlePeak}>Peak</Text>
          <Text style={styles.titleAboo}>Aboo</Text>
          <Text style={styles.titleSuffix}> · Reset password</Text>
        </Text>
      </View>

      <View style={styles.body}>
        {phase === "hydrating" ? (
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        ) : null}

        {phase === "expired" ? (
          <View style={{ gap: 12 }}>
            <Text style={styles.bodyText}>
              This reset link is invalid or has expired. Open PeakAboo, click
              Sign in → Forgot password to request a new one.
            </Text>
            <Pressable onPress={handleHome} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Back to PeakAboo</Text>
            </Pressable>
          </View>
        ) : null}

        {(phase === "ready" || phase === "saving") ? (
          <View style={{ gap: 12 }}>
            <Text style={styles.bodyText}>Pick a new password.</Text>
            <View style={{ gap: 6 }}>
              <Text style={styles.label}>New password</Text>
              <TextInput
                style={styles.input}
                placeholder="At least 6 characters"
                placeholderTextColor={colors.textTertiary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
              />
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <Pressable
              onPress={handleSave}
              disabled={phase === "saving"}
              style={({ pressed }) => [
                styles.primaryBtn,
                pressed && { opacity: 0.85 },
                phase === "saving" && { opacity: 0.6 },
              ]}
            >
              {phase === "saving" ? (
                <ActivityIndicator color={colors.textOn} />
              ) : (
                <Text style={styles.primaryBtnText}>Save new password</Text>
              )}
            </Pressable>
          </View>
        ) : null}

        {phase === "done" ? (
          <View style={{ gap: 12, alignItems: "center" }}>
            <Ionicons
              name="checkmark-circle"
              size={48}
              color={colors.forestSoft}
            />
            <Text style={styles.bodyText}>
              Password updated. You're signed in.
            </Text>
            <Pressable onPress={handleHome} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Open PeakAboo</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 6,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingVertical: 4,
  },
  backText: { color: colors.forest, fontWeight: "600", fontSize: 13 },
  title: { fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  titlePeak: { color: colors.forest },
  titleAboo: { color: colors.peak, fontStyle: "italic" },
  titleSuffix: {
    color: colors.textSecondary,
    fontWeight: "600",
    fontStyle: "normal",
  },
  body: {
    padding: 20,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
  },
  bodyText: { fontSize: 14, color: colors.text, lineHeight: 20 },
  center: { padding: 24, alignItems: "center" },
  label: { fontSize: 13, fontWeight: "700", color: colors.text },
  input: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.text,
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
