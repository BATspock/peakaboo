import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  useViewpointWeather,
  weatherIcon,
  type WeatherHour,
} from "../data/useViewpointWeather";
import { colors, radii } from "../theme";

type Props = {
  latitude: number;
  longitude: number;
};

export default function WeatherStrip({ latitude, longitude }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { data, loading, error } = useViewpointWeather({
    latitude,
    longitude,
    enabled: true,
  });

  if (loading) {
    return (
      <View style={[styles.line, styles.lineNeutral]}>
        <ActivityIndicator size="small" color={colors.textSecondary} />
        <Text style={styles.lineText}>Checking weather…</Text>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={[styles.line, styles.lineNeutral]}>
        <Ionicons
          name="cloud-offline-outline"
          size={14}
          color={colors.textSecondary}
        />
        <Text style={styles.lineText}>Weather unavailable</Text>
      </View>
    );
  }

  const c = data.current;
  const icon = weatherIcon(c.conditionCode, c.isDay);

  return (
    <View>
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        style={({ pressed }) => [
          styles.line,
          pressed && { opacity: 0.85 },
        ]}
      >
        <Ionicons
          name={icon as never}
          size={16}
          color={iconColor(icon)}
        />
        <Text style={styles.tempText}>{c.tempF}°</Text>
        <Text style={styles.divider}>·</Text>
        <Text style={styles.lineText} numberOfLines={1}>
          {c.conditionText}
        </Text>
        <Text style={styles.divider}>·</Text>
        <Text style={styles.lineText} numberOfLines={1}>
          {Math.round(c.visibilityKm)} km vis
        </Text>
        <View style={styles.spacer} />
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={14}
          color={colors.textSecondary}
        />
      </Pressable>

      {expanded ? (
        <View style={styles.panel}>
          <View style={styles.panelGrid}>
            <Stat label="Cloud cover" value={`${c.cloudPct}%`} />
            <Stat label="Wind" value={`${c.windMph} mph`} />
            <Stat label="Humidity" value={`${c.humidityPct}%`} />
          </View>

          {data.next6Hours.length > 0 ? (
            <>
              <Text style={styles.forecastTitle}>Next 6 hours</Text>
              <View style={styles.forecastRow}>
                {data.next6Hours.map((h) => (
                  <ForecastSlot key={h.time} hour={h} />
                ))}
              </View>
            </>
          ) : null}

          <Text style={styles.attribution}>
            Powered by WeatherAPI.com · cached up to 30 min
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ForecastSlot({ hour }: { hour: WeatherHour }) {
  const icon = weatherIcon(hour.conditionCode, hour.isDay);
  const time = formatHour(hour.time);
  return (
    <View style={styles.slot}>
      <Text style={styles.slotTime}>{time}</Text>
      <Ionicons name={icon as never} size={18} color={iconColor(icon)} />
      <Text style={styles.slotTemp}>{hour.tempF}°</Text>
      <Text style={styles.slotMeta}>{hour.cloudPct}% cl</Text>
      {hour.precipChancePct > 10 ? (
        <Text style={styles.slotPrecip}>{hour.precipChancePct}%</Text>
      ) : null}
    </View>
  );
}

function formatHour(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: true,
    timeZone: "America/Los_Angeles",
  }).format(d);
}

function iconColor(name: ReturnType<typeof weatherIcon>): string {
  switch (name) {
    case "sunny":
    case "partly-sunny":
      return colors.peak;
    case "moon":
      return colors.glacier;
    case "cloudy":
      return colors.textSecondary;
    case "rainy":
      return colors.glacier;
    case "snow":
      return colors.glacierSoft;
    case "thunderstorm":
      return colors.clay;
    default:
      return colors.textSecondary;
  }
}

const styles = StyleSheet.create({
  line: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  lineNeutral: { opacity: 0.85 },
  lineText: { fontSize: 13, color: colors.textSecondary, fontWeight: "600" },
  tempText: { fontSize: 13, fontWeight: "700", color: colors.text },
  divider: { color: colors.borderStrong, fontSize: 12 },
  spacer: { flex: 1 },

  panel: {
    marginTop: 6,
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 10,
  },
  panelGrid: { flexDirection: "row", gap: 8 },
  stat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  statValue: { fontSize: 14, fontWeight: "700", color: colors.text },
  statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },

  forecastTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
    marginTop: 4,
  },
  forecastRow: { flexDirection: "row", gap: 4 },
  slot: {
    flex: 1,
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingVertical: 6,
    paddingHorizontal: 2,
    gap: 2,
  },
  slotTime: { fontSize: 10, color: colors.textSecondary, fontWeight: "600" },
  slotTemp: { fontSize: 12, fontWeight: "700", color: colors.text },
  slotMeta: { fontSize: 9, color: colors.textTertiary },
  slotPrecip: { fontSize: 9, color: colors.glacier, fontWeight: "700" },

  attribution: {
    fontSize: 10,
    color: colors.textTertiary,
    textAlign: "center",
    marginTop: 4,
  },
});
