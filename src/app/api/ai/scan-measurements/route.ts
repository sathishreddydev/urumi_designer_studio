import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-guard";
import { getClientIp, aiLimiter } from "@/lib/rate-limit";

// ─── Field name aliases: maps whatever Gemini returns → canonical field names ─
const FIELD_ALIASES: Record<string, string> = {
  // Upper body
  shoulder: "Shoulder",
  "shoulder length": "Shoulder",
  "upper bust": "Upper Bust",
  bust: "Bust",
  chest: "Bust",
  "lower bust": "Lower Bust",
  waist: "Waist",
  "lower waist": "Lower Waist",
  hip: "Hip",
  hips: "Hip",
  // Apex & sleeves
  apex: "Apex Point",
  "apex point": "Apex Point",
  "apex down": "Apex Down",
  "apex gap": "Apex Gap",
  sleeve: "Sleeve Length",
  "sleeve length": "Sleeve Length",
  "sleeve loose": "Sleeve Loose",
  armhole: "Armhole",
  "arm hole": "Armhole",
  "neck front": "Neck Front",
  "neck back": "Neck Back",
  neck: "Neck Front",
  // Bottom
  "pant length": "Pant Length",
  "pant waist": "Pant Waist",
  "hip / seat": "Hip / Seat",
  "hip seat": "Hip / Seat",
  seat: "Hip / Seat",
  crotch: "Crotch (Rise)",
  rise: "Crotch (Rise)",
  thigh: "Thigh",
  knee: "Knee",
  ankle: "Ankle",
  "bottom loose": "Bottom Loose",
};

function canonicalize(raw: string): string {
  const lower = raw.toLowerCase().trim();
  if (FIELD_ALIASES[lower]) return FIELD_ALIASES[lower];
  // Partial match — longest alias wins
  let best: string | null = null;
  for (const alias of Object.keys(FIELD_ALIASES).sort((a, b) => b.length - a.length)) {
    if (lower.includes(alias)) {
      best = FIELD_ALIASES[alias];
      break;
    }
  }
  if (best) return best;
  // Title-case the raw label as a custom field
  return raw.trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

export const POST = withAuth(async (request) => {
  // ── Rate limit: 20 AI scans per 10 minutes per IP ──
  const ip = getClientIp(request);
  const limit = aiLimiter.check(ip);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${Math.ceil(limit.resetMs / 1000)}s.` },
      { status: 429 }
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI service not configured. Add GEMINI_API_KEY to environment variables." },
      { status: 503 }
    );
  }

  // ── Parse multipart form — expect a single "image" field ──
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = formData.get("image") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No image provided." }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only image files are supported." }, { status: 400 });
  }

  // 5 MB limit
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Image too large. Max 5 MB." }, { status: 400 });
  }

  // ── Convert to base64 for Gemini ──
  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const mimeType = file.type;

  // ── Call Gemini 1.5 Flash (cheapest, supports vision) ──
  const prompt = `You are an expert tailor reading a measurement chart or chit.
Extract all body measurements from this image. The image may be:
- A handwritten measurement slip
- A printed measurement chart
- A photo of a tailor's notebook
- Text in English, Telugu, Hindi, or mixed languages
- Numbers may be in inches or may have inch marks (")

Return ONLY a JSON object with field names as keys and numeric values as strings.
Example: {"Bust": "36", "Waist": "28.5", "Hip": "40", "Shoulder": "14"}

Rules:
- Values must be numbers only (no units, no inch marks)
- If a value is unclear or illegible, skip it
- Include ALL measurements you can read
- Use the exact label names visible in the image as keys
- Do not add measurements that are not in the image
- Return only valid JSON, nothing else`;

  let geminiResponse: Response;
  try {
    geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType,
                    data: base64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1024,
          },
        }),
      }
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to reach AI service. Check your internet connection." },
      { status: 502 }
    );
  }

  if (!geminiResponse.ok) {
    const errBody = await geminiResponse.text();
    console.error("Gemini API error:", geminiResponse.status, errBody);
    return NextResponse.json(
      { error: "AI service returned an error. Please try again." },
      { status: 502 }
    );
  }

  const geminiData = await geminiResponse.json();
  const rawText: string =
    geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  if (!rawText) {
    return NextResponse.json(
      { error: "AI could not read any measurements from this image." },
      { status: 422 }
    );
  }

  // ── Parse JSON from Gemini response ──
  // Gemini sometimes wraps it in ```json ... ```
  const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/) ||
    rawText.match(/```\s*([\s\S]*?)\s*```/) ||
    rawText.match(/(\{[\s\S]*\})/);

  if (!jsonMatch) {
    return NextResponse.json(
      { error: "AI could not extract measurements from this image." },
      { status: 422 }
    );
  }

  let rawFields: Record<string, string>;
  try {
    rawFields = JSON.parse(jsonMatch[1] ?? jsonMatch[0]);
  } catch {
    return NextResponse.json(
      { error: "AI returned an unexpected format. Please try again." },
      { status: 422 }
    );
  }

  // ── Canonicalize field names and validate values ──
  const measurements: Record<string, string> = {};
  for (const [rawKey, rawVal] of Object.entries(rawFields)) {
    if (typeof rawVal !== "string" && typeof rawVal !== "number") continue;
    const val = String(rawVal).replace(/["'inches]/gi, "").trim();
    const num = parseFloat(val);
    if (isNaN(num) || num <= 0 || num > 200) continue; // sanity check
    const canonical = canonicalize(rawKey);
    measurements[canonical] = String(num);
  }

  if (Object.keys(measurements).length === 0) {
    return NextResponse.json(
      { error: "No valid measurements found in this image. Make sure the image shows a measurement chart." },
      { status: 422 }
    );
  }

  return NextResponse.json({ measurements, count: Object.keys(measurements).length });
});
