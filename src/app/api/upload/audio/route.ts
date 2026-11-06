import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { isCloudinaryConfigured, uploadAudioToCloudinary } from "@/lib/cloudinary/upload";

const ALLOWED_AUDIO = ["audio/webm", "audio/mp4", "audio/ogg", "audio/mpeg", "audio/wav"];
const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

export async function POST(request: Request) {
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

    // Use Cloudinary if configured
    if (await isCloudinaryConfigured()) {
      const url = await uploadAudioToCloudinary(buffer, file.name);
      return NextResponse.json({ url, filename: file.name });
    }

    // Local fallback
    const ext = path.extname(file.name) || ".webm";
    const filename = `${uuidv4()}${ext}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, filename), buffer);

    return NextResponse.json({ url: `/uploads/${filename}`, filename: file.name });
  } catch (error) {
    console.error("Audio upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
