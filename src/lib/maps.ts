import { Linking, Platform } from "react-native";

/**
 * Open the user's preferred maps app with directions to the given coords.
 * - Web: opens google.com/maps directions in a new tab
 * - iOS: tries Apple Maps; the user can switch to Google Maps via the system
 *   sheet on Apple devices that have Google Maps installed
 * - Android: uses geo: which lets the OS show a chooser (Google Maps,
 *   Waze, etc.)
 */
export async function openInMaps(args: {
  latitude: number;
  longitude: number;
  label?: string;
}) {
  const { latitude, longitude, label } = args;
  const labelEncoded = encodeURIComponent(label ?? "Viewpoint");

  if (Platform.OS === "web") {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
    if (typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
    }
    return;
  }

  if (Platform.OS === "ios") {
    const apple = `maps://?daddr=${latitude},${longitude}&q=${labelEncoded}`;
    const canOpen = await Linking.canOpenURL(apple);
    if (canOpen) {
      await Linking.openURL(apple);
      return;
    }
    // Fallback to Google Maps universal link.
    await Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
    );
    return;
  }

  // Android — geo: triggers the chooser.
  const geo = `geo:0,0?q=${latitude},${longitude}(${labelEncoded})`;
  const canOpen = await Linking.canOpenURL(geo);
  if (canOpen) {
    await Linking.openURL(geo);
  } else {
    await Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
    );
  }
}
