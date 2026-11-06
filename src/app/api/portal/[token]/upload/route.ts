import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { customers, orders, outfits, referenceImages } from "@/lib/db/schema";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { sanitizeFilename } from "@/lib/utils";
import { uploadLimiter, getClientIp } from "@/lib/rate-limit";
import { getStudioDb } from "@/lib/multi-tenant/studio";
import { isCloudinaryConfigured, uploadImageToCloudinary } from "@/lib/cloudinary/upload";

const CUSTOMER_UPLOAD_STATUSES = [
  "DRAFT",
  "DESIGN_IN_PROGRESS",
  "WAITING_FOR_REFERENCES",
  "WAITING_FOR_DEPENDENCIES",
];

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

    // Get the correct database for this studio
    const db = await getStudioDb();

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
    const rawType = (formData.get("type") as string) || "PATTERN";
    const allowedReferenceTypes = ["PATTERN", "MAGGAM", "FABRIC"] as const;
    const type = allowedReferenceTypes.includes(rawType as any) ? (rawType as typeof allowedReferenceTypes[number]) : null;

    if (!(file instanceof File) || !outfitId) {
      return NextResponse.json({ error: "File and outfitId are required" }, { status: 400 });
    }

    if (!type) {
      return NextResponse.json({ error: "Invalid reference type" }, { status: 400 });
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

    if (!CUSTOMER_UPLOAD_STATUSES.includes(outfit.status)) {
      return NextResponse.json(
        { error: "Uploads are closed after production begins" },
        { status: 409 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    let url: string;
    const filename = sanitizeFilename(file.name);

    // Use Cloudinary if configured
    if (await isCloudinaryConfigured()) {
      url = await uploadImageToCloudinary(buffer, filename, "customer-uploads");
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
        type,
        url,
        filename,
        uploadedBy: "customer",
        isCustomerUpload: true,
      })
      .returning();

    // Emit event so designers see the new upload in real-time
    const { eventBus } = await import("@/lib/events");
    eventBus.emit({
      type: "reference_updated",
      outfitId,
      customerId: customer.id,
      timestamp: Date.now(),
    });

    return NextResponse.json(reference, { status: 201 });
  } catch (error) {
    console.error("Portal upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Get the correct database for this studio
    const db = await getStudioDb();

    // Validate portal token
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.portalToken, token))
      .limit(1);

    if (!customer) {
      return NextResponse.json({ error: "Invalid portal link" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const referenceId = searchParams.get("referenceId");

    if (!referenceId) {
      return NextResponse.json({ error: "Reference ID is required" }, { status: 400 });
    }

    // Get the reference image
    const [reference] = await db
      .select()
      .from(referenceImages)
      .where(eq(referenceImages.id, referenceId))
      .limit(1);

    if (!reference) {
      return NextResponse.json({ error: "Reference not found" }, { status: 404 });
    }

    // Verify the reference belongs to an outfit owned by this customer
    const [outfit] = await db
      .select()
      .from(outfits)
      .where(eq(outfits.id, reference.outfitId))
      .limit(1);

    if (!outfit) {
      return NextResponse.json({ error: "Invalid outfit" }, { status: 400 });
    }

    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, outfit.orderId))
      .limit(1);

    if (!order || order.customerId !== customer.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (!CUSTOMER_UPLOAD_STATUSES.includes(outfit.status)) {
      return NextResponse.json(
        { error: "Changes are closed after production begins" },
        { status: 409 }
      );
    }

    // Only allow deletion of customer-uploaded images
    if (!reference.isCustomerUpload) {
      return NextResponse.json(
        { error: "You can only delete images you uploaded" },
        { status: 403 }
      );
    }

    // Delete the reference from database
    await db.delete(referenceImages).where(eq(referenceImages.id, referenceId));

    // Optionally delete from Cloudinary or local storage
    // (This is a soft delete - we keep the file but remove the database record)
    // If you want to delete the actual file, you'd need to implement that here

    // Emit event so designers see the update in real-time
    const { eventBus } = await import("@/lib/events");
    eventBus.emit({
      type: "reference_updated",
      outfitId: reference.outfitId,
      customerId: customer.id,
      timestamp: Date.now(),
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Portal delete error:", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
