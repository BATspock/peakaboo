import React, { useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "./AuthContext";

export default function SignInButton() {
  const { session, signInWithGoogle, signOut, loading } = useAuth();
  const [busy, setBusy] = useState(false);

  if (loading) return null;

  async function handleSignIn() {
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (Platform.OS === "web") {
        // eslint-disable-next-line no-alert
        window.alert(`Sign-in failed: ${msg}`);
      } else {
        Alert.alert("Sign-in failed", msg);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    setBusy(true);
    try {
      await signOut();
    } finally {
      setBusy(false);
    }
  }

  if (!session) {
    return (
      <Pressable
        onPress={handleSignIn}
        disabled={busy}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
          busy && styles.buttonBusy,
        ]}
      >
        <Text style={styles.buttonText}>{busy ? "…" : "Sign in"}</Text>
      </Pressable>
    );
  }

  const email = session.user.email ?? session.user.user_metadata?.email ?? "user";
  const name =
    session.user.user_metadata?.full_name ??
    session.user.user_metadata?.name ??
    email;

  return (
    <View style={styles.signedIn}>
      <Text numberOfLines={1} style={styles.userText}>
        {name}
      </Text>
      <Pressable onPress={handleSignOut} disabled={busy}>
        <Text style={styles.signOutText}>{busy ? "…" : "Sign out"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#0F172A",
  },
  buttonPressed: { opacity: 0.85 },
  buttonBusy: { opacity: 0.6 },
  buttonText: { color: "#FFFFFF", fontWeight: "600", fontSize: 13 },
  signedIn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    maxWidth: 220,
  },
  userText: { color: "#475569", fontSize: 13, flexShrink: 1 },
  signOutText: { color: "#0F172A", fontSize: 13, fontWeight: "600" },
});
