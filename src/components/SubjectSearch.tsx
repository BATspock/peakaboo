import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii } from "../theme";
import { useSubjectSearch, type PlaceSuggestion } from "../data/useSubjectSearch";
import type { Subject } from "../data/types";
import { useAuth } from "../auth/AuthContext";

type Props = {
  subjects: Subject[];                            // featured (initial 3 peaks)
  activeSubjectId: string | null;
  onSelectSubject: (id: string) => void;          // existing subject picked
  onSelectPlace: (place: PlaceSuggestion) => void; // new place to add
  onReportSubject: (subject: Subject) => void;    // flag a subject
};

export default function SubjectSearch({
  subjects,
  activeSubjectId,
  onSelectSubject,
  onSelectPlace,
  onReportSubject,
}: Props) {
  const { session } = useAuth();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const { existing, suggestions, loading, error } = useSubjectSearch(query);

  const showDropdown = focused;
  const hasQuery = query.trim().length > 0;

  function pickExisting(s: Subject) {
    setQuery("");
    setFocused(false);
    onSelectSubject(s.id);
  }

  function pickPlace(p: PlaceSuggestion) {
    setQuery("");
    setFocused(false);
    onSelectPlace(p);
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.searchBar}>
        <Ionicons
          name="search"
          size={16}
          color={colors.textTertiary}
          style={{ marginRight: 8 }}
        />
        <TextInput
          style={styles.input}
          placeholder="Search a peak, waterfall, skyline…"
          placeholderTextColor={colors.textTertiary}
          value={query}
          onChangeText={setQuery}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            // Delay the close so a tap on a result lands before we collapse.
            setTimeout(() => setFocused(false), 150);
          }}
          autoCorrect={false}
          autoCapitalize="words"
        />
        {hasQuery ? (
          <Pressable hitSlop={8} onPress={() => setQuery("")}>
            <Ionicons
              name="close-circle"
              size={16}
              color={colors.textTertiary}
            />
          </Pressable>
        ) : null}
      </View>

      {showDropdown ? (
        <View style={styles.dropdown}>
          {!hasQuery ? (
            <FeaturedSection
              subjects={subjects}
              activeSubjectId={activeSubjectId}
              onPick={pickExisting}
              session={session}
              onReport={onReportSubject}
            />
          ) : (
            <>
              {loading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color={colors.textSecondary} />
                  <Text style={styles.loadingText}>Searching…</Text>
                </View>
              ) : null}
              {error ? (
                <Text style={styles.errorText}>{error}</Text>
              ) : null}
              {existing.length > 0 ? (
                <>
                  <Text style={styles.sectionTitle}>In PeakAboo</Text>
                  {existing.map((s) => (
                    <ExistingRow
                      key={s.id}
                      subject={s}
                      active={activeSubjectId === s.id}
                      onPick={() => pickExisting(s)}
                      session={session}
                      onReport={() => onReportSubject(s)}
                    />
                  ))}
                </>
              ) : null}
              {suggestions.length > 0 ? (
                <>
                  <Text style={styles.sectionTitle}>Add new</Text>
                  {suggestions.map((p) => (
                    <PlaceRow
                      key={p.placeId}
                      place={p}
                      onPick={() => pickPlace(p)}
                    />
                  ))}
                </>
              ) : null}
              {!loading && existing.length === 0 && suggestions.length === 0 ? (
                <Text style={styles.emptyText}>
                  No matches. Try a different name.
                </Text>
              ) : null}
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

function FeaturedSection({
  subjects,
  activeSubjectId,
  onPick,
  session,
  onReport,
}: {
  subjects: Subject[];
  activeSubjectId: string | null;
  onPick: (s: Subject) => void;
  session: { user: { id: string } } | null;
  onReport: (s: Subject) => void;
}) {
  return (
    <View>
      <Text style={styles.sectionTitle}>Featured</Text>
      {subjects.map((s) => (
        <ExistingRow
          key={s.id}
          subject={s}
          active={activeSubjectId === s.id}
          onPick={() => onPick(s)}
          session={session}
          onReport={() => onReport(s)}
        />
      ))}
    </View>
  );
}

function ExistingRow({
  subject,
  active,
  onPick,
  session,
  onReport,
}: {
  subject: Subject;
  active: boolean;
  onPick: () => void;
  session: { user: { id: string } } | null;
  onReport: () => void;
}) {
  const canReport =
    session && subject.createdBy && subject.createdBy !== session.user.id;
  return (
    <View style={styles.row}>
      <Pressable
        style={styles.rowBody}
        onPress={onPick}
      >
        <Ionicons
          name="triangle"
          size={14}
          color={active ? colors.peak : colors.forest}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {subject.name}
          </Text>
          <Text style={styles.rowSubtitle} numberOfLines={1}>
            {prettyKind(subject.kind)}
            {active ? " · viewing" : ""}
          </Text>
        </View>
      </Pressable>
      {canReport ? (
        <Pressable hitSlop={6} onPress={onReport} style={styles.iconBtn}>
          <Ionicons
            name="flag-outline"
            size={14}
            color={colors.textTertiary}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

function PlaceRow({
  place,
  onPick,
}: {
  place: PlaceSuggestion;
  onPick: () => void;
}) {
  return (
    <Pressable style={styles.row} onPress={onPick}>
      <View style={styles.rowBody}>
        <Ionicons name="add-circle" size={16} color={colors.forestSoft} />
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {place.mainText}
          </Text>
          <Text style={styles.rowSubtitle} numberOfLines={1}>
            {place.secondaryText}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function prettyKind(k: string): string {
  return k
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const styles = StyleSheet.create({
  wrap: { position: "relative" },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    padding: 0,
  },
  dropdown: {
    position: "absolute",
    top: 48,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 6,
    shadowColor: colors.forest,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 1000,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textTertiary,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 8,
  },
  rowBody: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  rowTitle: { fontSize: 14, fontWeight: "600", color: colors.text },
  rowSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  iconBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  loadingText: { fontSize: 12, color: colors.textSecondary },
  errorText: {
    fontSize: 12,
    color: colors.clay,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textSecondary,
    paddingHorizontal: 12,
    paddingVertical: 12,
    textAlign: "center",
  },
});
