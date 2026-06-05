import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { Platform } from "react-native";
import { supabase } from "../lib/supabase";

const MAX_LONG_EDGE = 2048;
const JPEG_QUALITY = 0.85;

export type UploadedImage = {
  id: string;
  storage_path: string;
  width: number | null;
  height: number | null;
  publicUrl: string;
};

export type ImageSource = "library" | "camera";

/**
 * Pick or capture photos, resize+compress, upload to Supabase Storage,
 * and create sighting_images rows. Returns the saved rows (with public URLs).
 *
 * source = "library": multi-pick from photo library (cap 5)
 * source = "camera":  single capture from camera
 */
export async function pickAndUploadImages(args: {
  sightingId: string;
  userId: string;
  source?: ImageSource;
}): Promise<UploadedImage[]> {
  const source = args.source ?? "library";
  const result = source === "camera"
    ? await captureFromCamera()
    : await pickFromLibrary();
  if (result.canceled || result.assets.length === 0) return [];

  const uploads: UploadedImage[] = [];
  for (const asset of result.assets) {
    const saved = await processAndUpload({
      asset,
      sightingId: args.sightingId,
      userId: args.userId,
    });
    uploads.push(saved);
  }
  return uploads;
}

async function pickFromLibrary(): Promise<ImagePicker.ImagePickerResult> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (perm.status !== "granted") {
    throw new Error("Photo library permission denied.");
  }
  return ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: true,
    selectionLimit: 5,
    quality: 1,
  });
}

async function captureFromCamera(): Promise<ImagePicker.ImagePickerResult> {
  // On native, requestCameraPermissionsAsync triggers the iOS/Android prompt.
  // On web, expo-image-picker delegates to the browser's input[type=file]
  // with capture=environment, which on mobile browsers opens the camera
  // directly and on desktop falls back to the OS file picker.
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (perm.status !== "granted") {
    throw new Error("Camera permission denied.");
  }
  return ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    quality: 1,
  });
}

async function processAndUpload(args: {
  asset: ImagePicker.ImagePickerAsset;
  sightingId: string;
  userId: string;
}): Promise<UploadedImage> {
  const { asset } = args;
  const longEdge = Math.max(asset.width ?? 0, asset.height ?? 0);
  const needsResize = longEdge > MAX_LONG_EDGE;
  const resizeAction = needsResize
    ? asset.width >= asset.height
      ? [{ resize: { width: MAX_LONG_EDGE } }]
      : [{ resize: { height: MAX_LONG_EDGE } }]
    : [];

  const manipulated = await ImageManipulator.manipulateAsync(
    asset.uri,
    resizeAction,
    { compress: JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG },
  );

  const body =
    Platform.OS === "web"
      ? await (await fetch(manipulated.uri)).blob()
      : ({
          uri: manipulated.uri,
          type: "image/jpeg",
          name: `${Date.now()}.jpg`,
        } as unknown as Blob);

  const objectPath = `${args.userId}/${args.sightingId}/${Date.now()}-${randomSuffix()}.jpg`;
  const { error: upErr } = await supabase.storage
    .from("sightings")
    .upload(objectPath, body, {
      contentType: "image/jpeg",
      upsert: false,
    });
  if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

  const { data: pub } = supabase.storage
    .from("sightings")
    .getPublicUrl(objectPath);

  const { data: row, error: rowErr } = await supabase
    .from("sighting_images")
    .insert({
      sighting_id: args.sightingId,
      storage_path: objectPath,
      width: manipulated.width,
      height: manipulated.height,
    })
    .select("id, storage_path, width, height")
    .single();

  if (rowErr || !row) {
    throw new Error(`Image record failed: ${rowErr?.message ?? "unknown"}`);
  }

  return {
    id: row.id,
    storage_path: row.storage_path,
    width: row.width,
    height: row.height,
    publicUrl: pub.publicUrl,
  };
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 10);
}
