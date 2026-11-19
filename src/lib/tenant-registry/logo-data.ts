/**
 * Detect MIME type from image magic bytes.
 * Falls back to image/webp (the original stored format) for legacy rows.
 */
function detectMimeType(data: Buffer): string {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    data.length >= 8 &&
    data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47 &&
    data[4] === 0x0d && data[5] === 0x0a && data[6] === 0x1a && data[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    data.length >= 12 &&
    data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46 &&
    data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50
  ) {
    return "image/webp";
  }
  // Legacy rows were stored as webp by sharp — default to webp
  return "image/webp";
}

export function getStudioLogoUrl(logoUrl: string, logoData: Buffer | null | undefined): string {
  if (!logoData || logoData.length === 0) return logoUrl;
  const mime = detectMimeType(logoData);
  return `data:${mime};base64,${logoData.toString("base64")}`;
}

export function getStudioFaviconUrl(faviconData: Buffer | null | undefined): string | null {
  if (!faviconData || faviconData.length === 0) return null;
  const mime = detectMimeType(faviconData);
  return `data:${mime};base64,${faviconData.toString("base64")}`;
}
