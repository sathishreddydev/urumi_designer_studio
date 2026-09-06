"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Briefcase, Phone, Clock } from "lucide-react";

const PAY_CYCLE_COLORS: Record<string, string> = {
  WEEKLY: "bg-blue-100 text-blue-700",
  MONTHLY: "bg-green-100 text-green-700",
};

export default function EmployeesPage() {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["employees", search],
    queryFn: async () => {
      const res = await fetch(`/api/employees?search=${encodeURIComponent(search)}&limit=100`);
      if (!res.ok) throw new Error("Failed to fetch employees");
      return res.json();
    },
  });

  const employees = data?.employees ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Employees</h1>
          <p className="text-xs text-muted-foreground">Manage staff, attendance &amp; payroll</p>
        </div>
        <Link href="/dashboard/employees/new">
          <Button className="w-full sm:w-auto">
            <Plus className="h-4 w-4" /> Add Employee
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by name, phone or role…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Summary */}
      {!isLoading && (
        <p className="text-xs text-muted-foreground">
          {employees.filter((e: any) => e.active).length} active ·{" "}
          {employees.filter((e: any) => !e.active).length} inactive
        </p>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-20 pt-6" />
            </Card>
          ))}
        </div>
      ) : employees.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No employees found. Add your first employee to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {employees.map((emp: any) => (
            <Link key={emp.id} href={`/dashboard/employees/${emp.id}`}>
              <Card className={`hover:border-primary/40 transition-colors cursor-pointer ${!emp.active ? "opacity-60" : ""}`}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Briefcase className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{emp.name}</p>
                        <Badge className={PAY_CYCLE_COLORS[emp.payCycle]}>{emp.payCycle}</Badge>
                        {!emp.active && <Badge variant="outline" className="text-xs">Inactive</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">{emp.jobRole}</p>
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      <p className="font-semibold text-sm">₹{Number(emp.salaryAmount).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">per {emp.payCycle === "WEEKLY" ? "week" : "month"}</p>
                    </div>
                  </div>
                  <div className="mt-2 ml-[52px] flex flex-wrap gap-4 text-xs text-muted-foreground">
                    {emp.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {emp.phone}
                      </span>
                    )}
                    {emp.shiftStart && emp.shiftEnd && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {emp.shiftStart} – {emp.shiftEnd}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
