// Time formatting in the viewpoint's local timezone.
// All current subjects (Mt Rainier / Adams / Baker) are in America/Los_Angeles.
// When we add subjects in other timezones, store a `timezone` column on
// subjects/viewpoints and pass it through here.

export const DEFAULT_VIEWPOINT_TZ = "America/Los_Angeles";

const HHMM = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: DEFAULT_VIEWPOINT_TZ,
});

const DATE_LONG = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: DEFAULT_VIEWPOINT_TZ,
});

export function formatViewpointTime(
  iso: string,
  tz: string = DEFAULT_VIEWPOINT_TZ,
): string {
  const fmt =
    tz === DEFAULT_VIEWPOINT_TZ
      ? HHMM
      : new Intl.DateTimeFormat("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
          timeZone: tz,
        });
  return fmt.format(new Date(iso));
}

export function formatViewpointDate(
  iso: string,
  tz: string = DEFAULT_VIEWPOINT_TZ,
): string {
  const fmt =
    tz === DEFAULT_VIEWPOINT_TZ
      ? DATE_LONG
      : new Intl.DateTimeFormat("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          timeZone: tz,
        });
  return fmt.format(new Date(iso));
}

/**
 * "Today" / "Yesterday" / "Mon, Mar 5" — relative to the viewpoint's timezone.
 */
export function formatViewpointDay(
  iso: string,
  tz: string = DEFAULT_VIEWPOINT_TZ,
): string {
  const dayKey = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: tz,
    }).format(d);

  const target = new Date(iso);
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const tk = dayKey(target);
  if (tk === dayKey(now)) return "Today";
  if (tk === dayKey(yesterday)) return "Yesterday";
  return formatViewpointDate(iso, tz);
}

/**
 * Returns the date key (YYYY-MM-DD) that the DB uses for the per-day uniqueness
 * check, in the viewpoint's timezone. Use this to detect if the user already
 * has a sighting "today" for upsert behavior.
 */
export function viewpointDateKey(
  iso: string = new Date().toISOString(),
  tz: string = DEFAULT_VIEWPOINT_TZ,
): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: tz,
  }).format(new Date(iso));
}
