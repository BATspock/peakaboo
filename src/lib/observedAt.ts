// Helpers for the user-supplied observation time (spec 05).
//
// All wall-clock input is interpreted in the VIEWPOINT's timezone, not the
// device's, because sightings.observed_on is a generated column computed at
// `America/Los_Angeles` and every formatter in ./time.ts assumes it. Picking
// "2 PM yesterday" while travelling should still mean 2 PM at the mountain.
//
// No date library: the zone offset is derived from Intl for the specific date
// being converted, so DST is handled without hardcoding -8/-7.

import { DEFAULT_VIEWPOINT_TZ } from "./time";

export type ObservedAtSource = "now" | "manual" | "exif";

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

type WallClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

/** Break an instant into viewpoint-local wall-clock parts. */
export function viewpointParts(iso: string | Date): WallClock {
  const instant = typeof iso === "string" ? new Date(iso) : iso;
  const parts: Record<string, string> = {};
  for (const p of PARTS_FMT.formatToParts(instant)) {
    if (p.type !== "literal") parts[p.type] = p.value;
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    // hour12:false can render midnight as "24" in some engines.
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** Minutes the viewpoint timezone is ahead of UTC at the given instant. */
function zoneOffsetMinutes(instant: Date): number {
  const p = viewpointParts(instant);
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
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
  second: number = 0,
): Date {
  const asIfUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const firstOffset = zoneOffsetMinutes(new Date(asIfUtc));
  let ms = asIfUtc - firstOffset * 60000;
  const secondOffset = zoneOffsetMinutes(new Date(ms));
  if (secondOffset !== firstOffset) ms = asIfUtc - secondOffset * 60000;
  return new Date(ms);
}

/** Never allow a timestamp past now — migration 0016 rejects those outright. */
export function clampToNow(iso: string): string {
  const now = Date.now();
  return Date.parse(iso) > now ? new Date(now).toISOString() : iso;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** `YYYY-MM-DD` in viewpoint time — the value format of `<input type="date">`. */
export function viewpointDateInputValue(iso: string): string {
  const p = viewpointParts(iso);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** `HH:MM` (24h) in viewpoint time — the value format of `<input type="time">`. */
export function viewpointTimeInputValue(iso: string): string {
  const p = viewpointParts(iso);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** Today in viewpoint time, for the `max` attribute of a date input. */
export function todayViewpointDateInputValue(): string {
  return viewpointDateInputValue(new Date().toISOString());
}

/**
 * Combine a `YYYY-MM-DD` date and an `HH:MM` time, both read as viewpoint
 * wall-clock, into an ISO instant. Clamped to now. Returns the fallback when
 * either field is empty or malformed, which happens mid-typing in a browser
 * date input.
 */
export function isoFromViewpointDateTime(
  dateValue: string,
  timeValue: string,
  fallbackIso: string,
): string {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  const timeMatch = /^(\d{2}):(\d{2})/.exec(timeValue);
  if (!dateMatch || !timeMatch) return fallbackIso;

  const instant = wallClockToInstant(
    Number(dateMatch[1]),
    Number(dateMatch[2]),
    Number(dateMatch[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2]),
  );
  if (!Number.isFinite(instant.getTime())) return fallbackIso;
  return clampToNow(instant.toISOString());
}

/**
 * A Date whose DEVICE-local wall clock equals the instant's VIEWPOINT wall
 * clock. Native pickers only speak device-local time, so this is what to hand
 * them; pair it with isoFromLocalWallClock to read the result back.
 */
export function viewpointWallClockAsLocalDate(iso: string): Date {
  const p = viewpointParts(iso);
  return new Date(p.year, p.month - 1, p.day, p.hour, p.minute, 0, 0);
}

/**
 * Inverse of viewpointWallClockAsLocalDate: read a native picker's Date as if
 * its wall clock were viewpoint-local. Clamped to now.
 */
export function isoFromLocalWallClock(picked: Date): string {
  const instant = wallClockToInstant(
    picked.getFullYear(),
    picked.getMonth() + 1,
    picked.getDate(),
    picked.getHours(),
    picked.getMinutes(),
  );
  return clampToNow(instant.toISOString());
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

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = Number(m[6]);

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
