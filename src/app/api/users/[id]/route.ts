import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { withPermission } from "@/lib/api-guard";
import { userUpdateSchema } from "@/lib/validations";
import { normalizePhoneNumber } from "@/lib/phone-utils";

export const PATCH = withPermission(
  { resource: "user", action: "update" },
  async (request, { params }) => {
    const { id } = await params;
    const body = await request.json();
    const parsed = userUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const updateData: any = { updatedAt: new Date() };

    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (body.phone !== undefined) updateData.phone = normalizePhoneNumber(parsed.data.phone) ?? null;
    if (parsed.data.role !== undefined) updateData.role = parsed.data.role;
    if (parsed.data.active !== undefined) updateData.active = parsed.data.active;
    if (parsed.data.password) {
      updateData.password = await bcrypt.hash(parsed.data.password, 10);
    }

    const [user] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        phone: users.phone,
        active: users.active,
      });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  }
);
