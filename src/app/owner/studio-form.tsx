"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Studio {
  name: string;
  domain: string;
  logoUrl: string;
  active: boolean;
}

interface StudioFormProps {
  studioId?: string;
}

export function StudioForm({ studioId }: StudioFormProps) {
  const router = useRouter();
  const editing = Boolean(studioId);
  const [studio, setStudio] = useState<Studio>({
    name: "",
    domain: "",
    logoUrl: "",
    active: true,
  });
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!studioId) return;

    fetch(`/api/owner/studios/${encodeURIComponent(studioId)}`, { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) {
          router.replace("/owner/login");
          return null;
        }
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load studio");
        return result.studio as Studio;
      })
      .then((result) => {
        if (result) setStudio(result);
      })
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : "Could not load studio");
      })
      .finally(() => setLoading(false));
  }, [router, studioId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);
    const formData = new FormData(event.currentTarget);
    const payload: Record<string, string | boolean> = {
      name: studio.name,
      domain: studio.domain,
      logoUrl: studio.logoUrl,
    };

    if (editing) {
      payload.active = studio.active;
    }

    const databaseUrl = String(formData.get("databaseUrl") || "").trim();
    const cloudinaryUrl = String(formData.get("cloudinaryUrl") || "").trim();
    if (databaseUrl) payload.databaseUrl = databaseUrl;
    if (cloudinaryUrl) payload.cloudinaryUrl = cloudinaryUrl;

    try {
      const response = await fetch(
        editing ? `/api/owner/studios/${encodeURIComponent(studioId!)}` : "/api/owner/studios",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || (editing ? "Could not update studio" : "Could not register studio"));
        return;
      }

      router.push("/owner/studios");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not save studio");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main className="mx-auto min-h-screen w-full max-w-3xl p-4 sm:p-8">Loading studio...</main>;
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl space-y-6 p-4 sm:p-8">
      <header className="space-y-2">
        <Link href="/owner/studios" className="text-sm text-muted-foreground hover:underline">
          Back to studios
        </Link>
        <h1 className="text-2xl font-bold">{editing ? "Edit studio" : "Register studio"}</h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Studio details</CardTitle>
          <CardDescription>
            Database and Cloudinary credentials are encrypted before storage and are never shown after saving.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Studio name</Label>
              <Input
                id="name"
                name="name"
                maxLength={120}
                required
                value={studio.name}
                onChange={(event) => setStudio((current) => ({ ...current, name: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="domain">Domain</Label>
              <Input
                id="domain"
                name="domain"
                placeholder="studio.example.com"
                required
                value={studio.domain}
                onChange={(event) => setStudio((current) => ({ ...current, domain: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="logoUrl">Logo image URL</Label>
              <Input
                id="logoUrl"
                name="logoUrl"
                type="url"
                placeholder="https://example.com/logo.png"
                required
                value={studio.logoUrl}
                onChange={(event) => setStudio((current) => ({ ...current, logoUrl: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="databaseUrl">Studio PostgreSQL URL</Label>
              <Input
                id="databaseUrl"
                name="databaseUrl"
                type="password"
                autoComplete="new-password"
                placeholder={editing ? "Leave blank to keep the current URL" : "postgresql://..."}
                required={!editing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cloudinaryUrl">Cloudinary URL</Label>
              <Input
                id="cloudinaryUrl"
                name="cloudinaryUrl"
                type="password"
                autoComplete="new-password"
                placeholder={editing ? "Leave blank to keep the current URL" : "cloudinary://key:secret@cloud-name"}
                required={!editing}
              />
            </div>
            {editing && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="active"
                  checked={studio.active}
                  onChange={(event) => setStudio((current) => ({ ...current, active: event.target.checked }))}
                />
                Studio is active
              </label>
            )}
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : editing ? "Save changes" : "Register studio"}
              </Button>
              <Button asChild type="button" variant="outline">
                <Link href="/owner/studios">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
