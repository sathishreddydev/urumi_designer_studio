import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sanitizeFilename } from "@/lib/utils";
import { getTenantContext } from "@/lib/tenant-registry/context";
import { withTenant } from "@/lib/tenant-registry/runtime";

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

    const url = await uploadToCloudinary(buffer, file.name);
    return NextResponse.json({ url, filename: sanitizeFilename(file.name) });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
});

async function uploadToCloudinary(buffer: Buffer, originalName: string): Promise<string> {
  const { cloudName, apiKey, apiSecret } = getTenantContext().cloudinary;

  const timestamp = Math.round(Date.now() / 1000);
  const folder = "urumi-by-mounika";

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
