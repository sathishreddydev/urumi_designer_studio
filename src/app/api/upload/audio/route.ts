import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant-registry/context";
import { withPermission } from "@/lib/api-guard";

const ALLOWED_AUDIO = ["audio/webm", "audio/mp4", "audio/ogg", "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav"];
const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

export const POST = withPermission(
  { resource: "reference", action: "upload" },
  async (request: Request) => {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_AUDIO.includes(file.type.split(";")[0])) {
      return NextResponse.json({ error: "Invalid file type. Only audio files are allowed." }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File too large. Max 20MB." }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const detectedFormat = detectAudioFormat(buffer);
    if (!detectedFormat || !mimeMatchesAudio(file.type.split(";")[0], detectedFormat)) {
      return NextResponse.json({ error: "Invalid file type. Only audio files are allowed." }, { status: 400 });
    }

    const url = await uploadAudioToCloudinary(buffer, file.name);
    return NextResponse.json({ url, filename: file.name });
  } catch (error) {
    console.error("Audio upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
  }
);

function detectAudioFormat(buffer: Buffer): string | null {
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return "webm";
  if (buffer.length >= 4 && buffer.subarray(0, 4).toString("ascii") === "OggS") return "ogg";
  if (buffer.length >= 12 &&
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WAVE") return "wav";
  if (buffer.length >= 12 &&
      buffer.subarray(4, 8).toString("ascii") === "ftyp") return "mp4";
  if (buffer.length >= 3 &&
      buffer.subarray(0, 3).toString("ascii") === "ID3") return "mpeg";
  if (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) return "mpeg";
  return null;
}

function mimeMatchesAudio(mimeType: string, format: string): boolean {
  if (format === "webm") return mimeType === "audio/webm";
  if (format === "ogg") return mimeType === "audio/ogg";
  if (format === "wav") return mimeType === "audio/wav" || mimeType === "audio/x-wav";
  if (format === "mp4") return mimeType === "audio/mp4";
  if (format === "mpeg") return mimeType === "audio/mpeg" || mimeType === "audio/mp3";
  return false;
}

async function uploadAudioToCloudinary(buffer: Buffer, originalName: string): Promise<string> {
  const tenant = getTenantContext();
  const { cloudName, apiKey, apiSecret } = tenant.cloudinary;

  const timestamp = Math.round(Date.now() / 1000);
  const folder = `${tenant.domain}/voice-notes`;

  const crypto = await import("crypto");
  const signatureStr = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash("sha1").update(signatureStr).digest("hex");

  const formData = new FormData();
  formData.append("file", new Blob([new Uint8Array(buffer)]), originalName);
  formData.append("api_key", apiKey);
  formData.append("timestamp", String(timestamp));
  formData.append("signature", signature);
  formData.append("folder", folder);
  formData.append("resource_type", "video"); // Cloudinary uses "video" for audio too

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/video/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Cloudinary audio error:", err);
    throw new Error("Cloudinary audio upload failed");
  }

  const data = await res.json();
  return data.secure_url;
}
