import React from "react";
import { StyleSheet, View } from "react-native";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
} from "@vis.gl/react-google-maps";

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

type Props = {
  region: MapRegion;
  markers: MapMarker[];
  onMarkerPress?: (id: string) => void;
  onMapPress?: (coords: { latitude: number; longitude: number }) => void;
};

const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

function regionToZoom(latitudeDelta: number) {
  // rough mapping: smaller delta = higher zoom
  return Math.max(2, Math.min(20, Math.round(Math.log2(360 / latitudeDelta))));
}

export default function MapView({
  region,
  markers,
  onMarkerPress,
  onMapPress,
}: Props) {
  return (
    <View style={styles.container}>
      <APIProvider apiKey={apiKey}>
        <Map
          mapId="peakaboo-map"
          style={{ width: "100%", height: "100%" }}
          defaultCenter={{ lat: region.latitude, lng: region.longitude }}
          defaultZoom={regionToZoom(region.latitudeDelta)}
          gestureHandling="greedy"
          disableDefaultUI={false}
          onClick={(e) => {
            if (!e.detail.latLng) return;
            onMapPress?.({
              latitude: e.detail.latLng.lat,
              longitude: e.detail.latLng.lng,
            });
          }}
        >
          {markers.map((m) => (
            <AdvancedMarker
              key={m.id}
              position={{ lat: m.latitude, lng: m.longitude }}
              title={m.title}
              onClick={() => onMarkerPress?.(m.id)}
            >
              <Pin
                background={
                  m.tint === "favorite"
                    ? "#F59E0B"
                    : m.tint === "secondary"
                      ? "#3B82F6"
                      : m.tint === "draft"
                        ? "#22C55E"
                        : "#EF4444"
                }
                borderColor="#0F172A"
                glyphColor="#FFFFFF"
              />
            </AdvancedMarker>
          ))}
        </Map>
      </APIProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
