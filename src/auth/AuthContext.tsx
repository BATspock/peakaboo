import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Platform } from "react-native";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

WebBrowser.maybeCompleteAuthSession();

type AuthState = {
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signUpWithEmail: (args: {
    email: string;
    password: string;
    displayName: string;
  }) => Promise<void>;
  signInWithEmail: (args: { email: string; password: string }) => Promise<void>;
  resetPasswordForEmail: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  // Sheet control — any component can prompt the user to sign in.
  authSheetOpen: boolean;
  openAuthSheet: () => void;
  closeAuthSheet: () => void;
};

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authSheetOpen, setAuthSheetOpen] = useState(false);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "SIGNED_IN") setAuthSheetOpen(false);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function signInWithGoogle() {
    if (Platform.OS === "web") {
      // On web, Supabase handles the full redirect dance — just point it at the origin.
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
      return;
    }

    // Native: open the OAuth URL in an in-app browser, then deep-link back.
    const redirectTo = AuthSession.makeRedirectUri({ scheme: "peakaboo" });
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });
    if (error) throw error;
    if (!data?.url) throw new Error("No OAuth URL returned from Supabase");

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== "success" || !result.url) return;

    const url = new URL(result.url);
    const params = new URLSearchParams(
      url.hash.startsWith("#") ? url.hash.slice(1) : url.search,
    );
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    if (access_token && refresh_token) {
      await supabase.auth.setSession({ access_token, refresh_token });
    }
  }

  async function signUpWithEmail(args: {
    email: string;
    password: string;
    displayName: string;
  }) {
    const { error } = await supabase.auth.signUp({
      email: args.email,
      password: args.password,
      options: {
        data: { full_name: args.displayName, name: args.displayName },
      },
    });
    if (error) throw error;
  }

  async function signInWithEmail(args: { email: string; password: string }) {
    const { error } = await supabase.auth.signInWithPassword({
      email: args.email,
      password: args.password,
    });
    if (error) throw error;
  }

  async function resetPasswordForEmail(email: string) {
    const redirectTo =
      Platform.OS === "web"
        ? `${window.location.origin}/reset-password`
        : AuthSession.makeRedirectUri({
            scheme: "peakaboo",
            path: "reset-password",
          });
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    if (error) throw error;
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  const openAuthSheet = useCallback(() => setAuthSheetOpen(true), []);
  const closeAuthSheet = useCallback(() => setAuthSheetOpen(false), []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      loading,
      signInWithGoogle,
      signUpWithEmail,
      signInWithEmail,
      resetPasswordForEmail,
      signOut,
      authSheetOpen,
      openAuthSheet,
      closeAuthSheet,
    }),
    [session, loading, authSheetOpen, openAuthSheet, closeAuthSheet],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(AuthCtx);
  if (!v) throw new Error("useAuth must be used inside <AuthProvider>");
  return v;
}
