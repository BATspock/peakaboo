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

// A photo captured/picked locally but NOT yet uploaded. Held in form state
// until the user saves the sighting (capture is decoupled from persistence).
export type PendingImage = {
  uri: string;
  width: number | null;
  height: number | null;
};

export type ImageSource = "library" | "camera";

/**
 * Open the camera or photo library and return the chosen photos as local
 * assets. Does NOT upload or touch the database — capturing a photo is
 * independent of saving the sighting. Returns [] if the user cancels.
 *
 * source = "library": multi-pick from photo library (cap 5)
 * source = "camera":  single capture from camera
 */
export async function pickImages(
  source: ImageSource,
): Promise<PendingImage[]> {
  const result =
    source === "camera" ? await captureFromCamera() : await pickFromLibrary();
  if (result.canceled || result.assets.length === 0) return [];
  return result.assets.map((a) => ({
    uri: a.uri,
    width: a.width ?? null,
    height: a.height ?? null,
  }));
}

/**
 * Upload previously-picked photos to Supabase Storage and create the
 * sighting_images rows under the given sighting. Called at save time, once
 * the parent sighting row exists.
 */
export async function uploadPendingImages(args: {
  sightingId: string;
  userId: string;
  pending: PendingImage[];
}): Promise<UploadedImage[]> {
  const uploads: UploadedImage[] = [];
  for (const p of args.pending) {
    const saved = await processAndUpload({
      pending: p,
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
  pending: PendingImage;
  sightingId: string;
  userId: string;
}): Promise<UploadedImage> {
  const { pending } = args;
  const w = pending.width ?? 0;
  const h = pending.height ?? 0;
  const longEdge = Math.max(w, h);
  const needsResize = longEdge > MAX_LONG_EDGE;
  const resizeAction = needsResize
    ? w >= h
      ? [{ resize: { width: MAX_LONG_EDGE } }]
      : [{ resize: { height: MAX_LONG_EDGE } }]
    : [];

  const manipulated = await ImageManipulator.manipulateAsync(
    pending.uri,
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
