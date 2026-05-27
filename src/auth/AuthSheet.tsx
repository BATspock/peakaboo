import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import BottomSheet from "../components/BottomSheet";
import { useAuth } from "./AuthContext";
import { colors, radii } from "../theme";

type Mode = "signin" | "signup" | "forgot";

export default function AuthSheet() {
  const {
    authSheetOpen,
    closeAuthSheet,
    signInWithGoogle,
    signUpWithEmail,
    signInWithEmail,
    resetPasswordForEmail,
  } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"google" | "email" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  function reset() {
    setMode("signin");
    setDisplayName("");
    setEmail("");
    setPassword("");
    setError(null);
    setBusy(null);
    setResetSent(false);
  }

  function handleClose() {
    reset();
    closeAuthSheet();
  }

  async function handleGoogle() {
    setError(null);
    setBusy("google");
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function handleEmailSubmit() {
    setError(null);

    if (mode === "forgot") {
      if (!email.trim()) {
        setError("Enter your email.");
        return;
      }
      setBusy("email");
      try {
        await resetPasswordForEmail(email.trim());
        setResetSent(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(null);
      }
      return;
    }

    if (mode === "signup") {
      if (!displayName.trim()) {
        setError("Display name is required.");
        return;
      }
      if (!email.trim()) {
        setError("Email is required.");
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
      setBusy("email");
      try {
        await signUpWithEmail({
          email: email.trim(),
          password,
          displayName: displayName.trim(),
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(null);
      }
      return;
    }

    // signin
    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }
    setBusy("email");
    try {
      await signInWithEmail({ email: email.trim(), password });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const titleByMode: Record<Mode, string> = {
    signin: "Sign in",
    signup: "Create account",
    forgot: "Reset password",
  };

  const subtitleByMode: Record<Mode, string> = {
    signin: "Welcome back to PeakAboo.",
    signup: "Log sightings, save spots, share photos.",
    forgot: "We'll email you a link to set a new password.",
  };

  const ctaLabelByMode: Record<Mode, string> = {
    signin: "Sign in",
    signup: "Create account",
    forgot: "Send reset link",
  };

  return (
    <BottomSheet
      visible={authSheetOpen}
      onClose={handleClose}
      title={titleByMode[mode]}
      subtitle={subtitleByMode[mode]}
    >
      <View style={{ gap: 16 }}>
        {mode !== "forgot" ? (
          <Pressable
            onPress={handleGoogle}
            disabled={!!busy}
            style={({ pressed }) => [
              styles.googleBtn,
              pressed && { opacity: 0.85 },
              busy && { opacity: 0.6 },
            ]}
          >
            <Ionicons name="logo-google" size={18} color={colors.text} />
            <Text style={styles.googleBtnText}>
              {busy === "google" ? "Opening Google…" : "Continue with Google"}
            </Text>
          </Pressable>
        ) : null}

        {mode !== "forgot" ? (
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>
        ) : null}

        {mode === "signup" ? (
          <View style={{ gap: 6 }}>
            <Text style={styles.label}>Display name</Text>
            <TextInput
              style={styles.input}
              placeholder="What should we call you?"
              placeholderTextColor={colors.textTertiary}
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
            />
          </View>
        ) : null}

        <View style={{ gap: 6 }}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor={colors.textTertiary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
        </View>

        {mode !== "forgot" ? (
          <View style={{ gap: 6 }}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder={mode === "signup" ? "At least 6 characters" : ""}
              placeholderTextColor={colors.textTertiary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
          </View>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {resetSent ? (
          <Text style={styles.successText}>
            Check your email for the reset link. It may land in spam.
          </Text>
        ) : null}

        <Pressable
          onPress={handleEmailSubmit}
          disabled={!!busy}
          style={({ pressed }) => [
            styles.primaryBtn,
            pressed && { opacity: 0.85 },
            busy && { opacity: 0.6 },
          ]}
        >
          {busy === "email" ? (
            <ActivityIndicator color={colors.textOn} />
          ) : (
            <Text style={styles.primaryBtnText}>{ctaLabelByMode[mode]}</Text>
          )}
        </Pressable>

        <View style={styles.footerRow}>
          {mode === "signin" ? (
            <>
              <Pressable onPress={() => { setMode("forgot"); setError(null); }}>
                <Text style={styles.linkText}>Forgot password?</Text>
              </Pressable>
              <Pressable onPress={() => { setMode("signup"); setError(null); }}>
                <Text style={styles.linkText}>Create account</Text>
              </Pressable>
            </>
          ) : null}
          {mode === "signup" ? (
            <Pressable onPress={() => { setMode("signin"); setError(null); }}>
              <Text style={styles.linkText}>Already have an account? Sign in</Text>
            </Pressable>
          ) : null}
          {mode === "forgot" ? (
            <Pressable onPress={() => { setMode("signin"); setError(null); setResetSent(false); }}>
              <Text style={styles.linkText}>Back to sign in</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 12,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  googleBtnText: { fontSize: 14, fontWeight: "700", color: colors.text },

  divider: { flexDirection: "row", alignItems: "center", gap: 10 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  dividerText: { fontSize: 12, color: colors.textTertiary, fontWeight: "600" },

  label: { fontSize: 13, fontWeight: "700", color: colors.text },
  input: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    fontSize: 14,
    color: colors.text,
  },

  errorText: { fontSize: 12, color: colors.clay, fontWeight: "600" },
  successText: { fontSize: 12, color: colors.forestSoft, fontWeight: "600" },

  primaryBtn: {
    backgroundColor: colors.forestSoft,
    paddingVertical: 14,
    borderRadius: radii.md,
    alignItems: "center",
  },
  primaryBtnText: { color: colors.textOn, fontWeight: "700", fontSize: 15 },

  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
    paddingTop: 4,
  },
  linkText: {
    color: colors.forest,
    fontSize: 13,
    fontWeight: "700",
  },
});
