import React, { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import RNMaps, { PROVIDER_GOOGLE, Marker } from "react-native-maps";

export type MapMarker = {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  description?: string;
  tint?: "primary" | "secondary" | "draft" | "favorite";
};

export type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export type CameraTarget = {
  latitude: number;
  longitude: number;
  // Optional override on the region delta when flying to this target.
  // If omitted, falls back to the initial region's delta.
  delta?: number;
  // Bumped externally when the same coordinates should re-trigger animation.
  nonce?: number;
};

type Props = {
  region: MapRegion;
  markers: MapMarker[];
  onMarkerPress?: (id: string) => void;
  onMapPress?: (coords: { latitude: number; longitude: number }) => void;
  cameraTarget?: CameraTarget | null;
};

export default function MapView({
  region,
  markers,
  onMarkerPress,
  onMapPress,
  cameraTarget,
}: Props) {
  const mapRef = useRef<RNMaps>(null);

  useEffect(() => {
    if (!cameraTarget || !mapRef.current) return;
    const delta = cameraTarget.delta ?? 0.6;
    mapRef.current.animateToRegion(
      {
        latitude: cameraTarget.latitude,
        longitude: cameraTarget.longitude,
        latitudeDelta: delta,
        longitudeDelta: delta,
      },
      600,
    );
  }, [cameraTarget]);

  return (
    <View style={styles.container}>
      <RNMaps
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={region}
        onPress={(e) =>
          onMapPress?.({
            latitude: e.nativeEvent.coordinate.latitude,
            longitude: e.nativeEvent.coordinate.longitude,
          })
        }
      >
        {markers.map((m) => (
          <Marker
            key={m.id}
            coordinate={{ latitude: m.latitude, longitude: m.longitude }}
            title={m.title}
            description={m.description}
            pinColor={
              m.tint === "favorite"
                ? "#F4A45A"
                : m.tint === "secondary"
                  ? "#4A8BBF"
                  : m.tint === "draft"
                    ? "#4DA070"
                    : "#1B3A2F"
            }
            onPress={() => onMarkerPress?.(m.id)}
          />
        ))}
      </RNMaps>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: "100%", height: "100%" },
});
