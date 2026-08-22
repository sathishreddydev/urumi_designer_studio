import { NextResponse } from "next/server";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { getSession } from "@/lib/auth";

// Helper: only ADMIN can manage sessions
async function requireAdmin() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (session.role !== "ADMIN") return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { session };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

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

  // Emit event so revoked device(s) get pushed to logout via SSE
  const { eventBus } = await import("@/lib/events");
  eventBus.emit({
    type: "session_revoked",
    userId: id,
    sessionId: sessionId ?? undefined, // undefined = all sessions for this user
    timestamp: Date.now(),
  });

  return NextResponse.json({ success: true });
}