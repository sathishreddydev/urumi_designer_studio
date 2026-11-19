/**
 * Compresses an image File using the Canvas API before upload.
 *
 * - Resizes so the longest edge is at most `maxDimension` pixels (default 1920)
 * - Re-encodes as JPEG at the given `quality` (0–1, default 0.82)
 * - Falls back to the original file if the browser lacks Canvas support or if
 *   the file is already smaller than the target
 */
export async function compressImage(
  file: File,
  {
    maxDimension = 1920,
    quality = 0.82,
  }: { maxDimension?: number; quality?: number } = {}
): Promise<File> {
  // Only compress image types we can draw to canvas
  if (!file.type.startsWith("image/")) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;

      // Scale down if either dimension exceeds maxDimension
      if (width > maxDimension || height > maxDimension) {
        if (width >= height) {
          height = Math.round((height / width) * maxDimension);
          width = maxDimension;
        } else {
          width = Math.round((width / height) * maxDimension);
          height = maxDimension;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        // Canvas not supported — return original
        resolve(file);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }

          // Only use the compressed version if it's actually smaller
          if (blob.size >= file.size) {
            resolve(file);
            return;
          }

          const compressed = new File(
            [blob],
            file.name.replace(/\.[^.]+$/, ".jpg"),
            { type: "image/jpeg", lastModified: Date.now() }
          );
          resolve(compressed);
        },
        "image/jpeg",
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file); // fallback to original on error
    };

    img.src = objectUrl;
  });
}

/**
 * Compresses an image File using the Canvas API.
 * Used for logo/favicon compression in the browser — replaces sharp on the server.
 *
 * - Resizes so the longest edge is at most `maxDimension` pixels
 * - Re-encodes as the requested MIME type at the given quality (0–1)
 * - Falls back to the original File if canvas is unavailable
 */
export async function compressImageForUpload(
  file: File,
  {
    maxDimension,
    mimeType = "image/webp",
    quality = 0.82,
    outputFileName,
  }: {
    maxDimension: number;
    mimeType?: "image/webp" | "image/png" | "image/jpeg";
    quality?: number;
    outputFileName?: string;
  }
): Promise<File> {
  // Proceed even if file.type is empty — browsers sometimes omit it for dragged files.
  // The canvas will fail to load non-images and fall back to the original.

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width >= height) {
          height = Math.round((height / width) * maxDimension);
          width = maxDimension;
        } else {
          width = Math.round((width / height) * maxDimension);
          height = maxDimension;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(file); return; }

      ctx.drawImage(img, 0, 0, width, height);

      const ext = mimeType === "image/png" ? ".png" : mimeType === "image/webp" ? ".webp" : ".jpg";
      const name = outputFileName ?? file.name.replace(/\.[^.]+$/, ext);

      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          // Keep compressed version even if larger — we're enforcing size limits, not just minimising
          resolve(new File([blob], name, { type: mimeType, lastModified: Date.now() }));
        },
        mimeType,
        quality
      );
    };

    img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
    img.src = objectUrl;
  });
}
