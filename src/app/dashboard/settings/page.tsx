"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Settings, Database, Shield, Palette } from "lucide-react";

export default function SettingsPage() {
  const { data: templates } = useQuery({
    queryKey: ["measurement-templates"],
    queryFn: async () => {
      const res = await fetch("/api/templates");
      if (!res.ok) return [];
      return res.json();
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Application configuration</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Database className="h-5 w-5" /> Measurement Templates
            </CardTitle>
            <CardDescription>Reusable templates for outfit measurements</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {templates?.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(t.fields as string[]).length} fields
                    </p>
                  </div>
                  <Badge variant="outline">{t.type}</Badge>
                </div>
              ))}
              {(!templates || templates.length === 0) && (
                <p className="text-sm text-muted-foreground">No templates configured</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5" /> Application Info
            </CardTitle>
            <CardDescription>System information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Version</span>
              <span className="font-medium">1.0.0</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Framework</span>
              <span className="font-medium">Next.js 15</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Database</span>
              <span className="font-medium">PostgreSQL + Prisma</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">UI</span>
              <span className="font-medium">Tailwind + shadcn/ui</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Palette className="h-5 w-5" /> Outfit Types
            </CardTitle>
            <CardDescription>Supported outfit categories</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {[
                "Bridal Blouse",
                "Reception Blouse",
                "Lehenga",
                "Gown",
                "Kurta",
                "Saree Blouse",
                "Anarkali",
                "Sharara",
              ].map((type) => (
                <Badge key={type} variant="outline">{type}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings className="h-5 w-5" /> Production Statuses
            </CardTitle>
            <CardDescription>Workflow stages</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {[
                "Draft",
                "Design In Progress",
                "Waiting For References",
                "Waiting For Dependencies",
                "Production Ready",
                "Pattern Drafting",
                "Maggam Work",
                "Fabric Cutting",
                "Stitching",
                "Production Completed",
                "Trial",
                "Alteration",
                "QC",
                "Ready For Delivery",
                "Delivered",
              ].map((s) => (
                <Badge key={s} variant="secondary">{s}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
