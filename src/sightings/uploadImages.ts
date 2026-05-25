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

/**
 * Pick photos from the library, resize+compress, upload to Supabase Storage,
 * and create sighting_images rows. Returns the saved rows (with public URLs).
 */
export async function pickAndUploadImages(args: {
  sightingId: string;
  userId: string;
}): Promise<UploadedImage[]> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (perm.status !== "granted") {
    throw new Error("Photo library permission denied.");
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: true,
    quality: 1,
  });
  if (result.canceled || result.assets.length === 0) return [];

  const uploads: UploadedImage[] = [];

  for (const asset of result.assets) {
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

    uploads.push({
      id: row.id,
      storage_path: row.storage_path,
      width: row.width,
      height: row.height,
      publicUrl: pub.publicUrl,
    });
  }

  return uploads;
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 10);
}
