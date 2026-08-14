// Helpers for the user-supplied observation time (spec 05).
//
// All wall-clock input is interpreted in the VIEWPOINT's timezone, not the
// device's, because sightings.observed_on is a generated column computed at
// `America/Los_Angeles` and every formatter in ./time.ts assumes it. Picking
// "2 PM yesterday" while travelling should still mean 2 PM at the mountain.
//
// No date library: the zone offset is derived from Intl for the specific date
// being converted, so DST is handled without hardcoding -8/-7.

import { DEFAULT_VIEWPOINT_TZ, formatViewpointDay, viewpointDateKey } from "./time";

export type ObservedAtSource = "now" | "manual" | "exif";

/** Hours offered for manual selection — daylight hours, when peaks are visible. */
export const HOUR_CHOICES: number[] = [
  5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
];

/** How many days back the manual day list reaches. Older photos come via EXIF. */
export const MANUAL_DAY_REACH = 30;

/** A backdate gap this large means the entry was logged well after the fact. */
const LOGGED_LATER_THRESHOLD_MS = 12 * 60 * 60 * 1000;

const PARTS_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: DEFAULT_VIEWPOINT_TZ,
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/**
 * Minutes the viewpoint timezone is ahead of UTC at the given instant.
 * Negative for America/Los_Angeles (e.g. -420 in PDT, -480 in PST).
 */
function zoneOffsetMinutes(instant: Date): number {
  const parts: Record<string, string> = {};
  for (const p of PARTS_FMT.formatToParts(instant)) {
    if (p.type !== "literal") parts[p.type] = p.value;
  }
  // hour12:false can render midnight as "24" in some engines.
  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return (asIfUtc - instant.getTime()) / 60000;
}

/**
 * Convert viewpoint-local wall-clock parts into a real instant.
 *
 * Two passes: the first uses the offset near the guessed instant, the second
 * corrects it if the guess landed on the other side of a DST transition.
 */
function wallClockToInstant(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
): Date {
  const asIfUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const firstOffset = zoneOffsetMinutes(new Date(asIfUtc));
  let ms = asIfUtc - firstOffset * 60000;
  const secondOffset = zoneOffsetMinutes(new Date(ms));
  if (secondOffset !== firstOffset) ms = asIfUtc - secondOffset * 60000;
  return new Date(ms);
}

/** Today's date in the viewpoint timezone, shifted back by `dayOffset` days. */
function viewpointCalendarDay(dayOffset: number): {
  year: number;
  month: number;
  day: number;
} {
  const [year, month, day] = viewpointDateKey().split("-").map(Number);
  // Date-only arithmetic in UTC is safe: no DST on a bare calendar date.
  const shifted = new Date(
    Date.UTC(year, month - 1, day) - dayOffset * 86400000,
  );
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

/** Never allow a timestamp past now — migration 0016 rejects those outright. */
export function clampToNow(iso: string): string {
  const now = Date.now();
  return Date.parse(iso) > now ? new Date(now).toISOString() : iso;
}

/**
 * ISO instant for "`hour`:00 on the day `dayOffset` days ago", viewpoint time.
 * Clamped to now, so "today at 9 PM" selected at noon yields noon.
 */
export function isoFromViewpointWallClock(
  dayOffset: number,
  hour: number,
): string {
  const { year, month, day } = viewpointCalendarDay(dayOffset);
  return clampToNow(wallClockToInstant(year, month, day, hour, 0, 0).toISOString());
}

/** The current hour (0-23) in the viewpoint timezone. */
export function currentViewpointHour(): number {
  const parts: Record<string, string> = {};
  for (const p of PARTS_FMT.formatToParts(new Date())) {
    if (p.type !== "literal") parts[p.type] = p.value;
  }
  return Number(parts.hour) % 24;
}

/** Hours selectable for a given day — the future is not selectable for today. */
export function hourChoicesForDay(dayOffset: number): number[] {
  if (dayOffset > 0) return HOUR_CHOICES;
  const limit = currentViewpointHour();
  const available = HOUR_CHOICES.filter((h) => h <= limit);
  // Before 5 AM nothing in HOUR_CHOICES qualifies; offer the current hour.
  return available.length > 0 ? available : [limit];
}

/** "5 AM", "12 PM", "9 PM" */
export function formatHourLabel(hour: number): string {
  const suffix = hour < 12 ? "AM" : "PM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12} ${suffix}`;
}

/** Day options for the manual picker, newest first, labelled Today/Yesterday/date. */
export function recentDays(
  count: number = MANUAL_DAY_REACH,
): { offset: number; label: string }[] {
  const days: { offset: number; label: string }[] = [];
  for (let offset = 0; offset < count; offset += 1) {
    const { year, month, day } = viewpointCalendarDay(offset);
    // Noon avoids any DST edge when only the calendar day matters. Not clamped:
    // labelling today must not collapse to "now".
    const iso = wallClockToInstant(year, month, day, 12, 0, 0).toISOString();
    days.push({ offset, label: formatViewpointDay(iso) });
  }
  return days;
}

const EXIF_DATE_RE = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/;
const EXIF_OFFSET_RE = /^([+-])(\d{2}):?(\d{2})$/;

/**
 * Capture time from a photo's EXIF block, or null when unavailable.
 *
 * EXIF DateTimeOriginal has the form "YYYY:MM:DD HH:MM:SS" and carries no
 * timezone, so it is read as viewpoint-local. Newer iOS images also expose
 * OffsetTimeOriginal ("-07:00"), which is exact and preferred when present.
 *
 * Returns null for missing, unparseable, or future timestamps. Note that
 * expo-image-picker only populates exif on Android and iOS — never on web.
 */
export function isoFromExif(
  exif: Record<string, unknown> | null | undefined,
): string | null {
  if (!exif) return null;

  const raw =
    typeof exif.DateTimeOriginal === "string"
      ? exif.DateTimeOriginal
      : typeof exif.DateTime === "string"
        ? exif.DateTime
        : null;
  if (!raw) return null;

  const m = EXIF_DATE_RE.exec(raw.trim());
  if (!m) return null;

  const [, year, month, day, hour, minute, second] = m.map(Number) as unknown as [
    unknown,
    number,
    number,
    number,
    number,
    number,
    number,
  ];

  const explicitOffset =
    typeof exif.OffsetTimeOriginal === "string"
      ? EXIF_OFFSET_RE.exec(exif.OffsetTimeOriginal.trim())
      : null;

  let instant: Date;
  if (explicitOffset) {
    const sign = explicitOffset[1] === "-" ? -1 : 1;
    const offsetMinutes =
      sign * (Number(explicitOffset[2]) * 60 + Number(explicitOffset[3]));
    instant = new Date(
      Date.UTC(year, month - 1, day, hour, minute, second) -
        offsetMinutes * 60000,
    );
  } else {
    instant = wallClockToInstant(year, month, day, hour, minute, second);
  }

  const ms = instant.getTime();
  if (!Number.isFinite(ms)) return null;
  if (ms > Date.now()) return null;
  return instant.toISOString();
}

/** True when a sighting was saved materially later than it was observed. */
export function wasLoggedLater(
  observedAt: string,
  createdAt: string | null | undefined,
): boolean {
  if (!createdAt) return false;
  const gap = Date.parse(createdAt) - Date.parse(observedAt);
  return Number.isFinite(gap) && gap > LOGGED_LATER_THRESHOLD_MS;
}
