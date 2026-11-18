"use client";

import React, { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Briefcase, Phone, Pencil, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export function StaffTab() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["employees", "staff", debouncedSearch, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        search: debouncedSearch,
        page: String(page),
        limit: "20",
      });
      const res = await fetch(`/api/employees?${params}`);
      if (!res.ok) throw new Error("Could not load employees");
      return res.json();
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const res = await fetch(`/api/employees/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: (_, { active }) => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast({ title: active ? "Employee activated" : "Employee deactivated" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Failed to update status" });
    },
  });

  const employees = data?.employees ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by name, phone or role…"
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {!isLoading && !isError && (
        <p className="text-xs text-muted-foreground">
          {total === 0
            ? "No employees"
            : `Showing ${(page - 1) * 20 + 1}–${Math.min(page * 20, total)} of ${total} employees`}
        </p>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse"><CardContent className="h-20 pt-6" /></Card>
          ))}
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-destructive" role="alert">Could not load employees. Please try again.</p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>Retry</Button>
          </CardContent>
        </Card>
      ) : employees.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No employees found.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {employees.map((emp: any) => (
            <Card
              key={emp.id}
              className={`transition-colors ${!emp.active ? "opacity-60" : ""}`}
            >
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Briefcase className="h-5 w-5 text-primary" />
                  </div>

                  {/* Main info — clicking navigates to detail */}
                  <Link href={`/dashboard/employees/${emp.id}`} className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{emp.name}</p>
                      <Badge className={emp.payCycle === "WEEKLY" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}>
                        {emp.payCycle}
                      </Badge>
                      {!emp.active && <Badge variant="outline" className="text-xs">Inactive</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{emp.jobRole}</p>
                  </Link>

                  {/* Salary */}
                  <div className="text-right shrink-0 space-y-1">
                    <p className="font-semibold text-sm">₹{Number(emp.salaryAmount).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">per {emp.payCycle === "WEEKLY" ? "week" : "month"}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Edit */}
                    <Link href={`/dashboard/employees/${emp.id}/edit`}>
                      <Button variant="ghost" size="icon" title="Edit employee">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </Link>

                    {/* Active / Inactive toggle */}
                    <Button
                      variant="ghost"
                      size="icon"
                      title={emp.active ? "Deactivate employee" : "Activate employee"}
                      disabled={toggleMutation.isPending}
                      onClick={() => toggleMutation.mutate({ id: emp.id, active: !emp.active })}
                    >
                      {emp.active
                        ? <ToggleRight className="h-5 w-5 text-green-600" />
                        : <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                      }
                    </Button>
                  </div>
                </div>

                <div className="mt-2 ml-[52px] flex flex-wrap gap-4 text-xs text-muted-foreground">
                  {emp.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{emp.phone}</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {!isLoading && !isError && total > 20 && (
        <div className="flex items-center justify-between">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
