import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getTenantContext } from "@/lib/tenant-registry/context";
import { withTenant } from "@/lib/tenant-registry/runtime";

const ALLOWED_AUDIO = ["audio/webm", "audio/mp4", "audio/ogg", "audio/mpeg", "audio/wav"];
const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

export const POST = withTenant(async (request: Request) => {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    const url = await uploadAudioToCloudinary(buffer, file.name);
    return NextResponse.json({ url, filename: file.name });
  } catch (error) {
    console.error("Audio upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
});

async function uploadAudioToCloudinary(buffer: Buffer, originalName: string): Promise<string> {
  const { cloudName, apiKey, apiSecret } = getTenantContext().cloudinary;

  const timestamp = Math.round(Date.now() / 1000);
  const folder = "urumi-by-mounika/voice-notes";

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
