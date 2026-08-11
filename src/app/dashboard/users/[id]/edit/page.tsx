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
import { useEffect } from "react";

interface EditUserForm {
  name: string;
  phone: string;
  role: string;
  password: string;
  active: boolean;
}

export default function EditUserPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const user = users?.find((u: any) => u.id === params.id);

  const { register, handleSubmit, setValue, watch, reset } = useForm<EditUserForm>({
    defaultValues: { name: "", phone: "", role: "", password: "", active: true },
  });

  useEffect(() => {
    if (user) {
      reset({
        name: user.name,
        phone: user.phone || "",
        role: user.role,
        password: "",
        active: user.active,
      });
    }
  }, [user, reset]);

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<EditUserForm>) => {
      const payload: any = {};
      if (data.name) payload.name = data.name;
      if (data.phone !== undefined) payload.phone = data.phone;
      if (data.role) payload.role = data.role;
      if (data.password) payload.password = data.password;
      if (data.active !== undefined) payload.active = data.active;

      const res = await fetch(`/api/users/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      router.push("/dashboard/users");
    },
  });

  if (!user) {
    return <div className="h-8 w-48 animate-pulse rounded bg-muted" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/users">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="text-2xl font-bold lg:text-3xl">Edit User</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{user.email}</CardTitle>
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
                <Label>Role</Label>
                <Select value={watch("role")} onValueChange={(val) => setValue("role", val)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="RECEPTION">Reception</SelectItem>
                    <SelectItem value="DESIGNER">Designer</SelectItem>
                    <SelectItem value="MASTER">Master</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>New Password (leave blank to keep)</Label>
                <Input type="password" {...register("password")} placeholder="••••••••" />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Switch
                checked={watch("active")}
                onCheckedChange={(checked: boolean) => setValue("active", checked)}
              />
              <Label>{watch("active") ? "Login Enabled" : "Login Disabled"}</Label>
            </div>

            {updateMutation.error && (
              <p className="text-sm text-destructive">{updateMutation.error.message}</p>
            )}

            <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
              <Link href="/dashboard/users">
                <Button variant="outline" type="button" className="w-full">Cancel</Button>
              </Link>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
