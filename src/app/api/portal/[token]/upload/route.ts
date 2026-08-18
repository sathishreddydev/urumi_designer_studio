import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { customers, orders, outfits, referenceImages } from "@/lib/db/schema";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { sanitizeFilename } from "@/lib/utils";
import { uploadLimiter, getClientIp } from "@/lib/rate-limit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    // Rate limiting
    const ip = getClientIp(request);
    const { allowed, resetMs } = uploadLimiter.check(ip);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many uploads. Please wait before trying again." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(resetMs / 1000)) } }
      );
    }

    const { token } = await params;

    // Validate portal token
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.portalToken, token))
      .limit(1);

    if (!customer) {
      return NextResponse.json({ error: "Invalid portal link" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const outfitId = formData.get("outfitId") as string;
    const type = (formData.get("type") as string) || "PATTERN";

    if (!file || !outfitId) {
      return NextResponse.json({ error: "File and outfitId are required" }, { status: 400 });
    }

    // Validate file size (max 5MB)
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File size must be less than 5MB" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Only image files (JPEG, PNG, WebP, GIF) are allowed" }, { status: 400 });
    }

    // Validate outfit belongs to this customer
    const [outfit] = await db
      .select()
      .from(outfits)
      .where(eq(outfits.id, outfitId))
      .limit(1);

    if (!outfit) {
      return NextResponse.json({ error: "Invalid outfit" }, { status: 400 });
    }

    // Check outfit's order belongs to this customer
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, outfit.orderId))
      .limit(1);

    if (!order || order.customerId !== customer.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    let url: string;
    const filename = sanitizeFilename(file.name);

    // Use Cloudinary if configured
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) {
      url = await uploadToCloudinary(buffer, filename);
    } else {
      // Local fallback
      const ext = path.extname(file.name) || ".jpg";
      const savedName = `${uuidv4()}${ext}`;
      const uploadDir = path.join(process.cwd(), "public", "uploads");
      await mkdir(uploadDir, { recursive: true });
      await writeFile(path.join(uploadDir, savedName), buffer);
      url = `/uploads/${savedName}`;
    }

    // Save as customer upload reference
    const [reference] = await db
      .insert(referenceImages)
      .values({
        outfitId,
        type: type as "PATTERN" | "MAGGAM",
        url,
        filename,
        uploadedBy: "customer",
        isCustomerUpload: true,
      })
      .returning();

    return NextResponse.json(reference, { status: 201 });
  } catch (error) {
    console.error("Portal upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

async function uploadToCloudinary(buffer: Buffer, originalName: string): Promise<string> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME!;
  const apiKey = process.env.CLOUDINARY_API_KEY!;
  const apiSecret = process.env.CLOUDINARY_API_SECRET!;

  const timestamp = Math.round(Date.now() / 1000);
  const folder = "designer-studio/customer-uploads";

  const crypto = await import("crypto");
  const signatureStr = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash("sha1").update(signatureStr).digest("hex");

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

  if (!res.ok) throw new Error("Cloudinary upload failed");
  const data = await res.json();
  return data.secure_url;
}
