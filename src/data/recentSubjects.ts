// Recent-subjects store — tracks the last 3 subjects the user picked from
// the subject search dropdown. Persisted in localStorage on web (and
// AsyncStorage if we ever build native; currently web-only since the
// only writers run in the search component).
//
// Why a separate module: AddViewpointSheet shows recent picks as a
// shortcut, but the writer is SubjectSearch. Centralizing avoids
// circular component dependencies.

import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "peakaboo:recent-subjects:v1";
const MAX = 3;

export async function recordRecentSubject(subjectId: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const existing: string[] = raw ? JSON.parse(raw) : [];
    const next = [subjectId, ...existing.filter((id) => id !== subjectId)].slice(
      0,
      MAX,
    );
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors — best-effort
  }
}

export async function getRecentSubjects(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX) : [];
  } catch {
    return [];
  }
}
