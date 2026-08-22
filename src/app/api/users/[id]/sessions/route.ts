import { NextResponse } from "next/server";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { withPermission } from "@/lib/api-guard";

export const GET = withPermission(
  { resource: "user", action: "read" },
  async (_request, { params }) => {
    const { id } = await params;
    const activeSessions = await db
      .select({
        id: sessions.id,
        deviceName: sessions.deviceName,
        ipAddress: sessions.ipAddress,
        lastActiveAt: sessions.lastActiveAt,
        createdAt: sessions.createdAt,
      })
      .from(sessions)
      .where(and(
        eq(sessions.userId, id),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date()),
      ));

    return NextResponse.json(activeSessions);
  }
);

export const DELETE = withPermission(
  { resource: "user", action: "update" },
  async (request, { params }) => {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : null;

    await db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(
        eq(sessions.userId, id),
        isNull(sessions.revokedAt),
        ...(sessionId ? [eq(sessions.id, sessionId)] : []),
      ));

    return NextResponse.json({ success: true });
  }
);