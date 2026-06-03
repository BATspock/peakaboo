import { useEffect, useState } from "react";

// WeatherAPI.com — free tier, 1M calls/month.
// Docs: https://www.weatherapi.com/docs/

export type WeatherCurrent = {
  tempF: number;
  conditionText: string;
  conditionCode: number; // WeatherAPI's day-night agnostic code; we map to icons client-side
  isDay: boolean;
  cloudPct: number;
  visibilityKm: number;
  windMph: number;
  humidityPct: number;
};

export type WeatherHour = {
  time: string; // ISO
  tempF: number;
  conditionText: string;
  conditionCode: number;
  cloudPct: number;
  visibilityKm: number;
  precipChancePct: number;
  isDay: boolean;
};

export type WeatherData = {
  current: WeatherCurrent;
  next6Hours: WeatherHour[]; // 6 entries starting from "now or next hour"
  fetchedAt: number;
};

type State = {
  data: WeatherData | null;
  loading: boolean;
  error: string | null;
};

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min — refresh weather no more than twice per hour
const KEY = process.env.EXPO_PUBLIC_WEATHER_API_KEY ?? "";

function cacheKey(latitude: number, longitude: number): string {
  // Round to 3 decimals so two calls within ~100m share a cache slot.
  return `peakaboo:weather:${latitude.toFixed(3)},${longitude.toFixed(3)}`;
}

function readCache(latitude: number, longitude: number): WeatherData | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(cacheKey(latitude, longitude));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WeatherData;
    if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(
  latitude: number,
  longitude: number,
  data: WeatherData,
): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(cacheKey(latitude, longitude), JSON.stringify(data));
  } catch {
    // ignore quota errors etc.
  }
}

export function useViewpointWeather(args: {
  latitude: number;
  longitude: number;
  enabled: boolean;
}): State {
  const { latitude, longitude, enabled } = args;
  const [state, setState] = useState<State>({
    data: null,
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!enabled) return;
    if (!KEY) {
      setState({
        data: null,
        loading: false,
        error: "Weather is unavailable (missing API key).",
      });
      return;
    }

    // Cache hit — render immediately, no network.
    const cached = readCache(latitude, longitude);
    if (cached) {
      setState({ data: cached, loading: false, error: null });
      return;
    }

    let cancelled = false;
    setState({ data: null, loading: true, error: null });

    const url =
      `https://api.weatherapi.com/v1/forecast.json?key=${encodeURIComponent(KEY)}` +
      `&q=${latitude},${longitude}` +
      `&days=1&aqi=no&alerts=no`;

    fetch(url)
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.text().catch(() => "");
          throw new Error(`Weather API ${r.status}: ${body.slice(0, 200)}`);
        }
        return r.json();
      })
      .then((raw: any) => {
        if (cancelled) return;

        const c = raw.current ?? {};
        const current: WeatherCurrent = {
          tempF: Math.round(c.temp_f ?? 0),
          conditionText: c.condition?.text ?? "—",
          conditionCode: c.condition?.code ?? 1000,
          isDay: c.is_day === 1,
          cloudPct: c.cloud ?? 0,
          visibilityKm: c.vis_km ?? 0,
          windMph: Math.round(c.wind_mph ?? 0),
          humidityPct: c.humidity ?? 0,
        };

        const allHours: any[] =
          raw.forecast?.forecastday?.[0]?.hour ?? [];
        const nowMs = Date.now();
        const upcoming = allHours
          .filter((h) => new Date(h.time).getTime() >= nowMs - 30 * 60 * 1000)
          .slice(0, 6);

        const next6Hours: WeatherHour[] = upcoming.map((h) => ({
          time: h.time,
          tempF: Math.round(h.temp_f ?? 0),
          conditionText: h.condition?.text ?? "—",
          conditionCode: h.condition?.code ?? 1000,
          cloudPct: h.cloud ?? 0,
          visibilityKm: h.vis_km ?? 0,
          precipChancePct: h.chance_of_rain ?? 0,
          isDay: h.is_day === 1,
        }));

        const data: WeatherData = {
          current,
          next6Hours,
          fetchedAt: Date.now(),
        };
        writeCache(latitude, longitude, data);
        setState({ data, loading: false, error: null });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        // eslint-disable-next-line no-console
        console.warn("[weather] fetch failed", msg);
        setState({ data: null, loading: false, error: msg });
      });

    return () => {
      cancelled = true;
    };
  }, [latitude, longitude, enabled]);

  return state;
}

/**
 * Map WeatherAPI condition codes to Ionicons names. Codes documented at
 * https://www.weatherapi.com/docs/weather_conditions.json
 * We collapse the long list into a small set of icon buckets.
 */
export function weatherIcon(
  code: number,
  isDay: boolean,
): "sunny" | "partly-sunny" | "cloudy" | "rainy" | "snow" | "thunderstorm" | "moon" {
  // Sunny / clear
  if (code === 1000) return isDay ? "sunny" : "moon";
  // Partly cloudy
  if (code === 1003) return isDay ? "partly-sunny" : "cloudy";
  // Overcast / cloudy / mist / fog
  if ([1006, 1009, 1030, 1135, 1147].includes(code)) return "cloudy";
  // Snow / sleet / ice
  if (
    [
      1066, 1069, 1072, 1114, 1117, 1147, 1204, 1207, 1210, 1213, 1216, 1219,
      1222, 1225, 1237, 1249, 1252, 1255, 1258, 1261, 1264,
    ].includes(code)
  )
    return "snow";
  // Thunderstorm
  if ([1087, 1273, 1276, 1279, 1282].includes(code)) return "thunderstorm";
  // Rain / drizzle / showers — anything else with precipitation
  return "rainy";
}
