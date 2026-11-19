import { NextResponse } from "next/server";
import { normalizeDomain } from "@/lib/tenant-registry/domain";
import { queryMaster } from "@/lib/tenant-registry/db";

export const runtime = "nodejs";

interface BrandingRow {
  name: string;
  logo_url: string;
}

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
    const { rows } = await queryMaster<BrandingRow>(
      "SELECT name, logo_url FROM tenant_registry_studios WHERE domain = $1 AND active = true LIMIT 1",
      [domain]
    );
    if (!rows[0]) {
      return NextResponse.json({ studio: null }, {
        headers: { "Cache-Control": "no-store" },
      });
    }

    return NextResponse.json(
      { studio: { name: rows[0].name, logoUrl: rows[0].logo_url } },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Could not resolve studio branding:", error);
    return NextResponse.json({ error: "Could not resolve studio domain" }, { status: 500 });
  }
}
