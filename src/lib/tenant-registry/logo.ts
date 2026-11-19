import sharp from "sharp";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_INPUT_PIXELS = 20_000_000;

export class LogoUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LogoUploadError";
  }
}

async function compressImageUpload(
  value: FormDataEntryValue | null,
  required: boolean,
  maxDimension: number,
  imageName: string,
  outputFormat: "png" | "webp"
): Promise<Buffer | null> {
  if (value === null || typeof value === "string" || value.size === 0) {
    if (required) {
      throw new LogoUploadError(`Choose a ${imageName.toLowerCase()} image to upload.`);
    }
    return null;
  }

  if (value.size > MAX_IMAGE_BYTES) {
    throw new LogoUploadError(`${imageName} images must be 4 MB or smaller.`);
  }

  const input = Buffer.from(await value.arrayBuffer());
  let format: string | undefined;
  try {
    format = (await sharp(input, {
      failOn: "error",
      limitInputPixels: MAX_INPUT_PIXELS,
    }).metadata()).format;
  } catch {
    throw new LogoUploadError(`Upload a valid PNG, JPEG, or WebP ${imageName.toLowerCase()}.`);
  }

  if (!format || !["jpeg", "png", "webp"].includes(format)) {
    throw new LogoUploadError(`Upload a PNG, JPEG, or WebP ${imageName.toLowerCase()}.`);
  }

  try {
    const resized = sharp(input, {
      failOn: "error",
      limitInputPixels: MAX_INPUT_PIXELS,
    })
      .rotate()
      .resize({
        width: maxDimension,
        height: maxDimension,
        fit: "inside",
        withoutEnlargement: true,
      });

    return outputFormat === "png"
      ? await resized.png({ compressionLevel: 9 }).toBuffer()
      : await resized.webp({ quality: 82 }).toBuffer();
  } catch {
    throw new LogoUploadError(`The uploaded ${imageName.toLowerCase()} could not be processed.`);
  }
}

export function compressLogoUpload(
  value: FormDataEntryValue | null,
  required: boolean
): Promise<Buffer | null> {
  return compressImageUpload(value, required, 512, "Logo", "webp");
}

export function compressFaviconUpload(
  value: FormDataEntryValue | null,
  required: boolean
): Promise<Buffer | null> {
  return compressImageUpload(value, required, 64, "Favicon", "png");
}

export function getStudioLogoUrl(logoUrl: string, logoData: Buffer | null | undefined): string {
  if (!logoData || logoData.length === 0) return logoUrl;
  return `data:image/webp;base64,${logoData.toString("base64")}`;
}

export function getStudioFaviconUrl(faviconData: Buffer | null | undefined): string | null {
  if (!faviconData || faviconData.length === 0) return null;
  return `data:image/png;base64,${faviconData.toString("base64")}`;
}
