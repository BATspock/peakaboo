import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii } from "../theme";
import { useSubjectSearch, type PlaceSuggestion } from "../data/useSubjectSearch";
import {
  SUBJECT_CATEGORIES,
  type Subject,
  type SubjectCategory,
} from "../data/types";
import { useAuth } from "../auth/AuthContext";
import { useSubjectPins } from "../data/useSubjectPins";
import { recordRecentSubject } from "../data/recentSubjects";

type Props = {
  subjects: Subject[];                            // featured (initial peaks)
  allSubjects: Subject[];                         // full catalog, for category browse
  activeSubjectId: string | null;
  onSelectSubject: (id: string) => void;          // existing subject picked
  onSelectPlace: (place: PlaceSuggestion) => void; // new place to add
  onReportSubject: (subject: Subject) => void;    // flag a subject
};

export type SubjectSearchHandle = {
  focus: () => void;
};

// forwardRef so the parent ([+] button) can call .focus() imperatively
// during the click handler. We tried a state-based focusNonce approach,
// but on web the click → blur → effect ordering races with itself; the
// nonce strategy intermittently dropped focus. Imperative handle = no race.
const SubjectSearch = forwardRef<SubjectSearchHandle, Props>(function SubjectSearch(
  {
    subjects,
    allSubjects,
    activeSubjectId,
    onSelectSubject,
    onSelectPlace,
    onReportSubject,
  },
  ref,
) {
  const { session } = useAuth();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  // When set, the empty-state dropdown shows landmarks in this category
  // (alphabetical) instead of the Featured list.
  const [browseCategory, setBrowseCategory] = useState<SubjectCategory | null>(
    null,
  );
  const inputRef = useRef<TextInput>(null);
  // Pending blur-close timer (see onBlur). Kept in a ref so an in-dropdown
  // tap (e.g. a category pill) can cancel it and keep the dropdown open.
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { existing, suggestions, loading, error } = useSubjectSearch(query);

  // Tapping inside the dropdown (pills) blurs the input on web, which would
  // schedule a close. Cancel that and re-focus so the dropdown stays open.
  function keepOpen() {
    if (blurTimer.current) {
      clearTimeout(blurTimer.current);
      blurTimer.current = null;
    }
    inputRef.current?.focus();
  }

  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus();
    },
  }));

  // Keep the dropdown open while focused OR while there's a query, so a
  // mid-result blur (browser quirks, scroll, etc.) doesn't yank the
  // results out from under the user. They close it explicitly via the
  // close button or by picking a result.
  const hasQuery = query.trim().length > 0;
  const showDropdown = focused || hasQuery;

  function closeAfterPick() {
    if (blurTimer.current) {
      clearTimeout(blurTimer.current);
      blurTimer.current = null;
    }
    setQuery("");
    setFocused(false);
    setBrowseCategory(null);
  }

  function pickExisting(s: Subject) {
    closeAfterPick();
    onSelectSubject(s.id);
    recordRecentSubject(s.id);
  }

  function pickPlace(p: PlaceSuggestion) {
    closeAfterPick();
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
          ref={inputRef}
          style={styles.input}
          placeholder="Search for a landmark"
          placeholderTextColor={colors.textTertiary}
          value={query}
          onChangeText={setQuery}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            // Defer the close so a tap on a dropdown row registers first.
            // On web, mousedown on a row blurs the input synchronously; without
            // this delay `showDropdown` flips false and the dropdown unmounts
            // before the row's onPress fires — so clicks did nothing. A pill
            // tap calls keepOpen() to cancel this timer and stay open. The pick
            // handlers set focused=false themselves; this is the
            // dismiss-on-click-away path, which also resets the category browse.
            blurTimer.current = setTimeout(() => {
              setFocused(false);
              setBrowseCategory(null);
            }, 150);
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
            <CategoryBrowse
              allSubjects={allSubjects}
              featured={subjects}
              browseCategory={browseCategory}
              setBrowseCategory={setBrowseCategory}
              onKeepOpen={keepOpen}
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
});

export default SubjectSearch;

// Empty-state dropdown: a row of category pills + either the landmarks in the
// selected category (A–Z) or the Featured list when no pill is active.
function CategoryBrowse({
  allSubjects,
  featured,
  browseCategory,
  setBrowseCategory,
  onKeepOpen,
  activeSubjectId,
  onPick,
  session,
  onReport,
}: {
  allSubjects: Subject[];
  featured: Subject[];
  browseCategory: SubjectCategory | null;
  setBrowseCategory: (c: SubjectCategory | null) => void;
  onKeepOpen: () => void;
  activeSubjectId: string | null;
  onPick: (s: Subject) => void;
  session: { user: { id: string } } | null;
  onReport: (s: Subject) => void;
}) {
  const inCategory =
    browseCategory === null
      ? []
      : allSubjects
          .filter((s) => s.kind === browseCategory)
          .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <View>
      {/* Category pills — horizontally scrollable, all 7 always shown. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillRow}
        keyboardShouldPersistTaps="handled"
      >
        {SUBJECT_CATEGORIES.map((c) => {
          const active = browseCategory === c.value;
          return (
            <Pressable
              key={c.value}
              onPress={() => {
                onKeepOpen();
                setBrowseCategory(active ? null : c.value);
              }}
              style={[styles.pill, active && styles.pillActive]}
            >
              <Ionicons
                name={c.icon}
                size={13}
                color={active ? colors.textOn : colors.textSecondary}
              />
              <Text
                style={[styles.pillText, active && styles.pillTextActive]}
                numberOfLines={1}
              >
                {c.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {browseCategory === null ? (
        <>
          <Text style={styles.sectionTitle}>Featured</Text>
          {featured.map((s) => (
            <ExistingRow
              key={s.id}
              subject={s}
              active={activeSubjectId === s.id}
              onPick={() => onPick(s)}
              session={session}
              onReport={() => onReport(s)}
            />
          ))}
        </>
      ) : inCategory.length > 0 ? (
        inCategory.map((s) => (
          <ExistingRow
            key={s.id}
            subject={s}
            active={activeSubjectId === s.id}
            onPick={() => onPick(s)}
            session={session}
            onReport={() => onReport(s)}
          />
        ))
      ) : (
        <Text style={styles.emptyText}>
          No landmarks here yet — add one with the buttons below the search.
        </Text>
      )}
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
  const { pinnedIds, canPin, pin } = useSubjectPins();
  const canReport =
    session && subject.createdBy && subject.createdBy !== session.user.id;
  const isPinned = pinnedIds.has(subject.id);
  const showPinAction = !!session && !isPinned && canPin;
  return (
    <View style={styles.row}>
      <Pressable style={styles.rowBody} onPress={onPick}>
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
            {isPinned ? " · pinned" : ""}
          </Text>
        </View>
      </Pressable>
      {showPinAction ? (
        <Pressable
          hitSlop={6}
          onPress={() => pin(subject.id)}
          style={styles.iconBtn}
        >
          <Ionicons
            name="bookmark-outline"
            size={14}
            color={colors.forest}
          />
        </Pressable>
      ) : null}
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
  // Lift the wrap above sibling header content so the absolutely-positioned
  // dropdown floats over the map instead of being covered.
  wrap: { position: "relative", zIndex: 100 },
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
  pillRow: {
    gap: 6,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 6,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillActive: { backgroundColor: colors.forest, borderColor: colors.forest },
  pillText: { fontSize: 12, color: colors.textSecondary, fontWeight: "600" },
  pillTextActive: { color: colors.textOn },
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
