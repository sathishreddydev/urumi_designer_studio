import { NextResponse } from "next/server";
import { normalizeDomain } from "@/lib/tenant-registry/domain";
import { getStudioBranding } from "@/lib/tenant-registry/branding";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const host = request.headers.get("host");
  if (!host) {
    return NextResponse.json({ error: "Request host is missing" }, { status: 400 });
  }

  let domain: string;
  try {
    domain = normalizeDomain(host);
  } catch {
    return NextResponse.json({ error: "Unrecognized studio domain" }, { status: 404 });
  }

  try {
    const studio = await getStudioBranding(domain);
    if (!studio) {
      return NextResponse.json({ studio: null }, {
        headers: { "Cache-Control": "no-store" },
      });
    }

    return NextResponse.json(
      { studio },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Could not resolve studio branding:", error);
    return NextResponse.json({ error: "Could not resolve studio domain" }, { status: 500 });
  }
}
