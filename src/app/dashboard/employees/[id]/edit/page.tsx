"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
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
  active: boolean;
  notes: string;
}

export default function EditEmployeePage() {
  const params = useParams();
  const id = params.id as string;

  const { data: emp, isLoading } = useQuery({
    queryKey: ["employee", id],
    queryFn: async () => {
      const res = await fetch(`/api/employees/${id}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
  });

  if (isLoading || !emp) {
    return <div className="h-8 w-48 animate-pulse rounded bg-muted" />;
  }

  return <EditForm emp={emp} id={id} />;
}

function EditForm({ emp, id }: { emp: any; id: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { register, handleSubmit, setValue, watch } = useForm<EmployeeForm>({
    defaultValues: {
      name: emp.name,
      phone: emp.phone,
      jobRole: emp.jobRole,
      payCycle: emp.payCycle,
      salaryAmount: String(emp.salaryAmount),
      shiftStart: emp.shiftStart ?? "",
      shiftEnd: emp.shiftEnd ?? "",
      active: emp.active,
      notes: emp.notes ?? "",
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: EmployeeForm) => {
      const res = await fetch(`/api/employees/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          salaryAmount: parseFloat(data.salaryAmount),
          shiftStart: data.shiftStart || null,
          shiftEnd: data.shiftEnd || null,
          notes: data.notes || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["employee", id] });
      router.push(`/dashboard/employees/${id}`);
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/employees/${id}`}>
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="text-2xl font-bold">Edit Employee</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{emp.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit((d) => updateMutation.mutate(d))} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input {...register("name")} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input {...register("phone")} />
              </div>
              <div className="space-y-2">
                <Label>Job Role</Label>
                <Input {...register("jobRole")} />
              </div>
              <div className="space-y-2">
                <Label>Pay Cycle</Label>
                <Select
                  value={watch("payCycle")}
                  onValueChange={(val: any) => setValue("payCycle", val)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WEEKLY">Weekly</SelectItem>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Salary Amount (₹)</Label>
                <Input type="number" min={0} step={0.01} {...register("salaryAmount")} />
              </div>
              <div className="space-y-2">
                <Label>Shift Start</Label>
                <Input type="time" {...register("shiftStart")} />
              </div>
              <div className="space-y-2">
                <Label>Shift End</Label>
                <Input type="time" {...register("shiftEnd")} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Input {...register("notes")} />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Switch
                checked={watch("active")}
                onCheckedChange={(checked: boolean) => setValue("active", checked)}
              />
              <Label>{watch("active") ? "Active" : "Inactive"}</Label>
            </div>

            {updateMutation.error && (
              <p className="text-sm text-destructive">{updateMutation.error.message}</p>
            )}

            <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
              <Link href={`/dashboard/employees/${id}`}>
                <Button variant="outline" type="button" className="w-full">Cancel</Button>
              </Link>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
