import { NextResponse } from "next/server";
import { ilike, or, desc, count } from "drizzle-orm";
import { db } from "@/lib/db";
import { employees } from "@/lib/db/schema";
import { withPermission } from "@/lib/api-guard";
import { z } from "zod";

const employeeSchema = z.object({
  name: z.string().min(2, "Name is required"),
  phone: z.string().min(7, "Valid phone number required"),
  jobRole: z.string().min(1, "Job role is required"),
  payCycle: z.enum(["WEEKLY", "MONTHLY"]).default("MONTHLY"),
  salaryAmount: z.number().positive("Salary must be positive"),
  shiftStart: z.string().optional(),
  shiftEnd: z.string().optional(),
  active: z.boolean().default(true),
  notes: z.string().optional(),
});

export const GET = withPermission(
  { resource: "employee", action: "read" },
  async (request) => {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    const condition = search
      ? or(
          ilike(employees.name, `%${search}%`),
          ilike(employees.phone, `%${search}%`),
          ilike(employees.jobRole, `%${search}%`)
        )
      : undefined;

    const rows = await db
      .select()
      .from(employees)
      .where(condition)
      .orderBy(desc(employees.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ total }] = await db.select({ total: count() }).from(employees).where(condition);

    return NextResponse.json({ employees: rows, total, page, limit });
  }
);

export const POST = withPermission(
  { resource: "employee", action: "create" },
  async (request) => {
    const body = await request.json();
    const parsed = employeeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    try {
      const [emp] = await db
        .insert(employees)
        .values({
          name: parsed.data.name,
          phone: parsed.data.phone,
          jobRole: parsed.data.jobRole,
          payCycle: parsed.data.payCycle,
          salaryAmount: String(parsed.data.salaryAmount),
          shiftStart: parsed.data.shiftStart ?? null,
          shiftEnd: parsed.data.shiftEnd ?? null,
          active: parsed.data.active,
          notes: parsed.data.notes ?? null,
        })
        .returning();
      return NextResponse.json(emp, { status: 201 });
    } catch (error: any) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Phone number already exists" }, { status: 409 });
      }
      throw error;
    }
  }
);
