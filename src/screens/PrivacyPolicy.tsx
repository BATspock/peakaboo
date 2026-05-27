import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii } from "../theme";

const LAST_UPDATED = "May 27, 2026";

export default function PrivacyPolicy() {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            if (typeof window !== "undefined") {
              window.location.href = "/";
            }
          }}
          hitSlop={6}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={18} color={colors.forest} />
          <Text style={styles.backText}>Back to PeakAboo</Text>
        </Pressable>
        <Text style={styles.title}>
          <Text style={styles.titlePeak}>Peak</Text>
          <Text style={styles.titleAboo}>Aboo</Text>
          <Text style={styles.titleSuffix}> · Privacy Policy</Text>
        </Text>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
      >
        <Text style={styles.lastUpdated}>Last updated: {LAST_UPDATED}</Text>

        <P>
          PeakAboo is an early-access app for spotting Pacific Northwest peaks
          (Mt Rainier, Mt Adams, Mt Baker) and logging whether they're visible
          from a given viewpoint. This page describes what data we collect, why,
          and how it's stored.
        </P>

        <H>What we collect</H>
        <P>
          When you sign in with Google, we receive your name, email address, and
          public profile photo. This is the only personal information we store
          about you.
        </P>
        <P>
          When you log a sighting, we store: which viewpoint you were observing,
          whether the peak was visible, the conditions you reported, your 0–10
          visibility rating, any optional notes, and any photos you attach. The
          time of the sighting is captured automatically.
        </P>
        <P>
          When you save a viewpoint as a favorite, rate it, or add a new
          viewpoint, those actions are stored and associated with your account.
        </P>
        <P>
          When you ask the app to use your current location (to add a viewpoint
          near you), the app reads your device location once and uses it
          locally; we do not store your real-time position or track you in the
          background.
        </P>

        <H>What we do not collect</H>
        <P>
          We do not collect device identifiers, advertising IDs, contacts,
          calendar data, or background location. We do not run analytics,
          tracking pixels, or third-party advertising.
        </P>

        <H>How we use your data</H>
        <P>
          Your sightings, ratings, photos, and viewpoint contributions are
          public by default — other PeakAboo users can see them, identified by
          your Google display name. This is the core function of the app: a
          shared record of when each peak is visible.
        </P>
        <P>
          Your favorites are visible only to you.
        </P>
        <P>
          We do not sell your data, share it with advertisers, or use it for any
          purpose besides operating the app.
        </P>

        <H>Where your data is stored</H>
        <P>
          PeakAboo uses Supabase (a managed Postgres + storage provider) for the
          database and Vercel for web hosting. Data is stored in their US data
          centers. Sign-in is handled by Google's OAuth service. These
          providers each have their own privacy policies that apply.
        </P>

        <H>Your rights</H>
        <P>
          You can sign out at any time from the header menu. To delete your
          account and all associated data — sightings, photos, favorites,
          ratings, and the contributed viewpoints you authored — email{" "}
          <Text style={styles.email}>adkishore.ak@gmail.com</Text> and we'll
          process the deletion within 7 days.
        </P>
        <P>
          You can also remove individual sightings, photos, or favorites
          directly within the app.
        </P>

        <H>Children</H>
        <P>
          PeakAboo is not directed at children under 13. We do not knowingly
          collect data from children.
        </P>

        <H>Changes to this policy</H>
        <P>
          If we materially change how we collect or use data, we'll update this
          page and post a notice in the app.
        </P>

        <H>Contact</H>
        <P>
          Questions: <Text style={styles.email}>adkishore.ak@gmail.com</Text>
        </P>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return <Text style={styles.heading}>{children}</Text>;
}

function P({ children }: { children: React.ReactNode }) {
  return <Text style={styles.paragraph}>{children}</Text>;
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
  title: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  titlePeak: { color: colors.forest },
  titleAboo: { color: colors.peak, fontStyle: "italic" },
  titleSuffix: {
    color: colors.textSecondary,
    fontWeight: "600",
    fontStyle: "normal",
  },
  body: { flex: 1 },
  bodyContent: {
    padding: 20,
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
  },
  lastUpdated: {
    fontSize: 12,
    color: colors.textTertiary,
    marginBottom: 16,
  },
  heading: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.forest,
    marginTop: 18,
    marginBottom: 6,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.text,
    marginBottom: 10,
  },
  email: { color: colors.forestSoft, fontWeight: "600" },
});
