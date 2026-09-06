"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface EmployeeForm {
  name: string;
  phone: string;
  jobRole: string;
  payCycle: "WEEKLY" | "MONTHLY";
  salaryAmount: string;
  shiftStart: string;
  shiftEnd: string;
  notes: string;
}

const JOB_ROLES = ["Tailor", "Embroidery", "Helper", "Designer", "Cutter", "Finisher", "Other"];

export default function NewEmployeePage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<EmployeeForm>({
    defaultValues: { payCycle: "MONTHLY" },
  });

  const createMutation = useMutation({
    mutationFn: async (data: EmployeeForm) => {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          salaryAmount: parseFloat(data.salaryAmount),
          shiftStart: data.shiftStart || undefined,
          shiftEnd: data.shiftEnd || undefined,
          notes: data.notes || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create employee");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      router.push("/dashboard/employees");
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/employees">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="text-2xl font-bold">New Employee</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Employee Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit((d) => createMutation.mutate(d))}
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Name */}
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input {...register("name", { required: "Name is required" })} placeholder="Full name" />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label>Phone *</Label>
                <Input {...register("phone", { required: "Phone is required" })} placeholder="Mobile number" />
                {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
              </div>

              {/* Job Role */}
              <div className="space-y-2">
                <Label>Job Role *</Label>
                <Select onValueChange={(val) => setValue("jobRole", val)}>
                  <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                  <SelectContent>
                    {JOB_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  {...register("jobRole", { required: "Job role is required" })}
                  placeholder="Or type a custom role"
                  className="mt-1"
                />
                {errors.jobRole && <p className="text-xs text-destructive">{errors.jobRole.message}</p>}
              </div>

              {/* Pay Cycle */}
              <div className="space-y-2">
                <Label>Pay Cycle *</Label>
                <Select
                  defaultValue="MONTHLY"
                  onValueChange={(val: any) => setValue("payCycle", val)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WEEKLY">Weekly</SelectItem>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Salary */}
              <div className="space-y-2">
                <Label>Salary Amount (₹) *</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  {...register("salaryAmount", { required: "Salary is required" })}
                  placeholder="e.g. 15000"
                />
                {errors.salaryAmount && <p className="text-xs text-destructive">{errors.salaryAmount.message}</p>}
              </div>

              {/* Shift Start */}
              <div className="space-y-2">
                <Label>Shift Start <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input type="time" {...register("shiftStart")} />
              </div>

              {/* Shift End */}
              <div className="space-y-2">
                <Label>Shift End <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input type="time" {...register("shiftEnd")} />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input {...register("notes")} placeholder="Any additional notes…" />
            </div>

            {createMutation.error && (
              <p className="text-sm text-destructive">{createMutation.error.message}</p>
            )}

            <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
              <Link href="/dashboard/employees">
                <Button variant="outline" type="button" className="w-full">Cancel</Button>
              </Link>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating…" : "Create Employee"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
