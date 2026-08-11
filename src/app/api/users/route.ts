import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { withPermission } from "@/lib/api-guard";
import { userSchema } from "@/lib/validations";

export const GET = withPermission(
  { resource: "user", action: "read" },
  async () => {
    const allUsers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        phone: users.phone,
        active: users.active,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));

    return NextResponse.json(allUsers);
  }
);

export const POST = withPermission(
  { resource: "user", action: "create" },
  async (request) => {
    const body = await request.json();
    const parsed = userSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(parsed.data.password, 10);

    try {
      const [user] = await db
        .insert(users)
        .values({
          name: parsed.data.name,
          email: parsed.data.email,
          password: hashedPassword,
          role: parsed.data.role,
          phone: parsed.data.phone,
        })
        .returning({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          phone: users.phone,
          active: users.active,
        });

      return NextResponse.json(user, { status: 201 });
    } catch (error: any) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Email already exists" }, { status: 409 });
      }
      throw error;
    }
  }
);
