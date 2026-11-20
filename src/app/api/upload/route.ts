import { NextResponse } from "next/server";
import { sanitizeFilename } from "@/lib/utils";
import { getTenantContext } from "@/lib/tenant-registry/context";
import { withPermission } from "@/lib/api-guard";

export const POST = withPermission(
  { resource: "reference", action: "upload" },
  async (request: Request) => {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only JPEG, PNG, and WebP are allowed." },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB." },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const detectedFormat = detectImageFormat(buffer);
    if (!detectedFormat || !mimeMatchesImage(file.type, detectedFormat)) {
      return NextResponse.json(
        { error: "Invalid file contents. Only JPEG, PNG, and WebP are allowed." },
        { status: 400 }
      );
    }

    const url = await uploadToCloudinary(buffer, file.name);
    return NextResponse.json({ url, filename: sanitizeFilename(file.name) });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
  }
);

function detectImageFormat(buffer: Buffer): "jpeg" | "png" | "webp" | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpeg";
  }
  if (buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "png";
  }
  if (buffer.length >= 12 &&
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    return "webp";
  }
  return null;
}

function mimeMatchesImage(mimeType: string, format: "jpeg" | "png" | "webp"): boolean {
  if (format === "jpeg") return mimeType === "image/jpeg" || mimeType === "image/jpg";
  if (format === "png") return mimeType === "image/png";
  return mimeType === "image/webp";
}

async function uploadToCloudinary(buffer: Buffer, originalName: string): Promise<string> {
  const tenant = getTenantContext();
  const { cloudName, apiKey, apiSecret } = tenant.cloudinary;

  const timestamp = Math.round(Date.now() / 1000);
  const folder = tenant.domain;

  // Generate signature
  const crypto = await import("crypto");
  const signatureStr = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash("sha1").update(signatureStr).digest("hex");

  // Upload via Cloudinary REST API (no SDK needed)
  const formData = new FormData();
  formData.append("file", new Blob([new Uint8Array(buffer)]), originalName);
  formData.append("api_key", apiKey);
  formData.append("timestamp", String(timestamp));
  formData.append("signature", signature);
  formData.append("folder", folder);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Cloudinary error:", err);
    throw new Error("Cloudinary upload failed");
  }

  const data = await res.json();
  return data.secure_url;
}
