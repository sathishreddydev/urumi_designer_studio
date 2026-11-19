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
  faviconUrl: string | null;
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
    faviconUrl: null,
    active: true,
  });
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null);
  const [useLogoAsFavicon, setUseLogoAsFavicon] = useState(false);

  useEffect(() => {
    if (!logoFile) {
      setLogoPreview(null);
      return;
    }

    const previewUrl = URL.createObjectURL(logoFile);
    setLogoPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [logoFile]);

  useEffect(() => {
    if (!faviconFile) {
      setFaviconPreview(null);
      return;
    }

    const previewUrl = URL.createObjectURL(faviconFile);
    setFaviconPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [faviconFile]);

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
        if (result) {
          setStudio(result);
          setUseLogoAsFavicon(false);
        }
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
    if (editing) {
      formData.set("active", String(studio.active));
      formData.set("clearFavicon", String(useLogoAsFavicon));
    }

    try {
      const response = await fetch(
        editing ? `/api/owner/studios/${encodeURIComponent(studioId!)}` : "/api/owner/studios",
        {
          method: editing ? "PATCH" : "POST",
          body: formData,
        }
      );
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || (editing ? "Could not update studio" : "Could not register studio"));
        return;
      }

      router.push("/owner");
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
        <Link href="/owner" className="text-sm text-muted-foreground hover:underline">
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
              <Label htmlFor="logo">Logo image</Label>
              <Input
                id="logo"
                name="logo"
                type="file"
                accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                required={!editing}
                onChange={(event) => setLogoFile(event.target.files?.[0] ?? null)}
              />
              <p className="text-sm text-muted-foreground">
                PNG, JPEG, or WebP up to 4 MB. Images are resized, compressed, and stored in the master database.
              </p>
              {(logoPreview || studio.logoUrl) && (
                <img
                  src={logoPreview || studio.logoUrl}
                  alt="Studio logo preview"
                  className="h-16 w-16 rounded border object-contain p-1"
                />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="favicon">Favicon image (optional)</Label>
              <Input
                id="favicon"
                name="favicon"
                type="file"
                accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                onChange={(event) => {
                  setFaviconFile(event.target.files?.[0] ?? null);
                  setUseLogoAsFavicon(false);
                }}
              />
              <p className="text-sm text-muted-foreground">
                PNG, JPEG, or WebP up to 4 MB. If omitted, the studio logo is used.
              </p>
              {(faviconPreview || studio.faviconUrl || logoPreview || studio.logoUrl) && (
                <img
                  src={
                    faviconPreview ||
                    (useLogoAsFavicon || !studio.faviconUrl
                      ? logoPreview || studio.logoUrl
                      : studio.faviconUrl)
                  }
                  alt="Favicon preview"
                  className="h-10 w-10 rounded border object-contain p-1"
                />
              )}
              {editing && studio.faviconUrl && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={useLogoAsFavicon}
                    onChange={(event) => setUseLogoAsFavicon(event.target.checked)}
                  />
                  Use the studio logo instead of the saved favicon
                </label>
              )}
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
                <Link href="/owner">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
