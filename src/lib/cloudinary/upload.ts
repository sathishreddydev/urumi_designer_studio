/**
 * Cloudinary Upload Utilities
 *
 * Shared upload and delete functions that use the per-studio config.
 * These replace the duplicated Cloudinary functions that were in each route.
 */

import { getCloudinaryConfig, type CloudinaryConfig } from "./config";

/**
 * Upload an image to Cloudinary using the current studio's config.
 *
 * Returns the secure URL of the uploaded image.
 * Throws if Cloudinary is not configured or upload fails.
 */
export async function uploadImageToCloudinary(
  buffer: Buffer,
  originalName: string,
  subfolder?: string
): Promise<string> {
  const config = await getCloudinaryConfig();
  if (!config) {
    throw new Error("Cloudinary is not configured for this studio");
  }

  const folder = subfolder
    ? `${config.folder}/${subfolder}`
    : config.folder;

  return uploadToCloudinary(buffer, originalName, config, folder, "image");
}

/**
 * Upload an audio file to Cloudinary.
 * Cloudinary uses the "video" resource type for audio files too.
 */
export async function uploadAudioToCloudinary(
  buffer: Buffer,
  originalName: string,
  subfolder?: string
): Promise<string> {
  const config = await getCloudinaryConfig();
  if (!config) {
    throw new Error("Cloudinary is not configured for this studio");
  }

  const folder = subfolder
    ? `${config.folder}/${subfolder}`
    : `${config.folder}/voice-notes`;

  return uploadToCloudinary(buffer, originalName, config, folder, "video");
}

/**
 * Delete a resource from Cloudinary by its URL.
 * Extracts the public ID from the URL and calls the destroy API.
 *
 * Best-effort — doesn't throw if deletion fails (logs the error).
 */
export async function deleteFromCloudinary(url: string): Promise<void> {
  const config = await getCloudinaryConfig();
  if (!config) {
    // Can't delete without config — log and return
    console.warn("[Cloudinary] Cannot delete: no config for current studio");
    return;
  }

  try {
    // Extract public ID from URL
    // URL format: https://res.cloudinary.com/{cloud}/image/upload/v123/folder/filename.jpg
    //             https://res.cloudinary.com/{cloud}/video/upload/v123/folder/filename.webm
    const parts = url.split("/upload/");
    if (parts.length < 2) return;

    const pathAfterUpload = parts[1];
    // Remove version prefix (v123/) and file extension
    const publicId = pathAfterUpload
      .replace(/^v\d+\//, "")
      .replace(/\.[^.]+$/, "");

    // Determine resource type from URL
    const isVideo = url.includes("/video/upload/");
    const resourceType = isVideo ? "video" : "image";

    const timestamp = Math.round(Date.now() / 1000);
    const crypto = await import("crypto");
    const signature = crypto
      .createHash("sha1")
      .update(`public_id=${publicId}&timestamp=${timestamp}${config.apiSecret}`)
      .digest("hex");

    const formData = new FormData();
    formData.append("public_id", publicId);
    formData.append("api_key", config.apiKey);
    formData.append("timestamp", String(timestamp));
    formData.append("signature", signature);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${config.cloudName}/${resourceType}/destroy`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("[Cloudinary] Delete failed:", err);
    }
  } catch (error) {
    console.error("[Cloudinary] Delete error:", error);
    // Don't throw — deletion is best-effort
  }
}

/**
 * Check if Cloudinary is configured for the current studio.
 * Use this to decide whether to upload to Cloudinary or use local storage.
 */
export async function isCloudinaryConfigured(): Promise<boolean> {
  const config = await getCloudinaryConfig();
  return config !== null;
}

// ─── INTERNAL ────────────────────────────────────────────────────────────────

/**
 * Core upload function — shared by image and audio uploads.
 */
async function uploadToCloudinary(
  buffer: Buffer,
  originalName: string,
  config: CloudinaryConfig,
  folder: string,
  resourceType: "image" | "video"
): Promise<string> {
  const timestamp = Math.round(Date.now() / 1000);

  // Generate signature
  const crypto = await import("crypto");
  const signatureStr = `folder=${folder}&timestamp=${timestamp}${config.apiSecret}`;
  const signature = crypto.createHash("sha1").update(signatureStr).digest("hex");

  const formData = new FormData();
  formData.append("file", new Blob([new Uint8Array(buffer)]), originalName);
  formData.append("api_key", config.apiKey);
  formData.append("timestamp", String(timestamp));
  formData.append("signature", signature);
  formData.append("folder", folder);
  formData.append("resource_type", resourceType);

  const endpoint = `https://api.cloudinary.com/v1_1/${config.cloudName}/${resourceType}/upload`;

  const res = await fetch(endpoint, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[Cloudinary] Upload error:", err);
    throw new Error("Cloudinary upload failed");
  }

  const data = await res.json();
  return data.secure_url;
}
