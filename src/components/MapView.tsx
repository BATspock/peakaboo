import React from "react";
import { StyleSheet, View } from "react-native";
import RNMaps, { PROVIDER_GOOGLE, Marker } from "react-native-maps";

export type MapMarker = {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  description?: string;
  tint?: "primary" | "secondary" | "draft";
};

export type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

type Props = {
  region: MapRegion;
  markers: MapMarker[];
  onMarkerPress?: (id: string) => void;
  onMapPress?: (coords: { latitude: number; longitude: number }) => void;
};

export default function MapView({
  region,
  markers,
  onMarkerPress,
  onMapPress,
}: Props) {
  return (
    <View style={styles.container}>
      <RNMaps
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
              m.tint === "secondary"
                ? "#3B82F6"
                : m.tint === "draft"
                  ? "#22C55E"
                  : "#EF4444"
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
