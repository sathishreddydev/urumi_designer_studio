import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-registry/runtime";

export const GET = withTenant(async (_request: Request) => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(session);
});
