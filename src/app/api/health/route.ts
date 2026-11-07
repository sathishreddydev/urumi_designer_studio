/**
 * GET /api/health
 *
 * Simple health check endpoint.
 * Used by DNS verification to confirm the domain resolves to our platform.
 */

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
