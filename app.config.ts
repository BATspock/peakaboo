import type { ExpoConfig } from "expo/config";

const googleMapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

const config: ExpoConfig = {
  name: "PeakAboo",
  slug: "peakaboo",
  version: "0.1.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  scheme: "peakaboo",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.batspock.peakaboo",
    config: {
      googleMapsApiKey: googleMapsKey,
    },
  },
  android: {
    package: "com.batspock.peakaboo",
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
    config: {
      googleMaps: {
        apiKey: googleMapsKey,
      },
    },
  },
  web: {
    favicon: "./assets/favicon.png",
    bundler: "metro",
  },
  plugins: [
    "expo-web-browser",
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "PeakAboo uses your location to add viewpoints near you and show the map.",
      },
    ],
    [
      "expo-image-picker",
      {
        photosPermission:
          "PeakAboo accesses your photos so you can attach them to a sighting.",
        cameraPermission:
          "PeakAboo uses the camera so you can capture a sighting on the spot.",
      },
    ],
  ],
};

export default config;
