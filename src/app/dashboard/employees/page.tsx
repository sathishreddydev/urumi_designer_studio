"use client";

import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ShieldAlert } from "lucide-react";
import { StaffTab } from "@/components/employees/staff-tab";
import { AttendanceTab } from "@/components/employees/attendance-tab";
import { SalaryTab } from "@/components/employees/salary-tab";
import { AdvancesTab } from "@/components/employees/advances-tab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function EmployeesPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"staff" | "attendance" | "salary" | "advances">("staff");
  const [visitedTabs, setVisitedTabs] = useState(() => new Set(["staff"]));
  const tabs = ["staff", "attendance", "salary", "advances"] as const;
  const tabLabels = { staff: "Staff", attendance: "Attendance", salary: "Salary", advances: "Advances" } as const;

  function selectTab(nextTab: typeof tabs[number]) {
    setTab(nextTab);
    setVisitedTabs((visited) => new Set(visited).add(nextTab));
  }

  // Check authorization
  const {
    data: authData,
    isLoading: authLoading,
    isError: authError,
    refetch: refetchAuth,
  } = useQuery({
    queryKey: ["auth"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me");
      if (!res.ok) throw new Error("Unauthorized");
      return res.json();
    },
  });

  // Redirect store managers
  useEffect(() => {
    if (!authLoading && authData?.role === "STORE_MANAGER") {
      router.replace("/dashboard");
    }
  }, [authData, authLoading, router]);

  // Show access denied for store managers
  if (authLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  if (authError || !authData) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="space-y-4 pt-6 text-center">
            <h3 className="font-semibold text-lg">Could not verify access</h3>
            <p className="text-sm text-muted-foreground">
              Please check your connection and try again.
            </p>
            <Button onClick={() => refetchAuth()}>Try again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (authData?.role === "STORE_MANAGER") {
    return (
      <div className="flex h-96 items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="flex justify-center">
              <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <ShieldAlert className="h-6 w-6 text-destructive" />
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-lg">Access Denied</h3>
              <p className="text-sm text-muted-foreground mt-2">
                You don't have permission to access this page.
              </p>
            </div>
            <Button onClick={() => router.push("/dashboard")} className="mt-4">
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Employees</h1>
          <p className="text-xs text-muted-foreground">Staff · Attendance · Payroll · Advances</p>
        </div>
        <Link href="/dashboard/employees/new">
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" /> Add Employee
          </Button>
        </Link>
      </div>

      <Tabs value={tab} onValueChange={(value) => selectTab(value as typeof tabs[number])}>
        <TabsList
          aria-label="Employee management"
          className="h-auto w-full justify-start rounded-none border-b bg-transparent p-0"
        >
          {tabs.map((t) => (
            <TabsTrigger
              key={t}
              value={t}
              className="flex-1 rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm text-muted-foreground sm:flex-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
            >
              {tabLabels[t]}
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map((t) => (
          <TabsContent key={t} value={t} className="mt-4">
            {visitedTabs.has(t) && (
              <>
                {t === "staff" && <StaffTab />}
                {t === "attendance" && <AttendanceTab isAdmin={authData.role === "ADMIN"} />}
                {t === "salary" && <SalaryTab />}
                {t === "advances" && <AdvancesTab />}
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
