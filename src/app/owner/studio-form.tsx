"use client";

import { useEffect, useRef, useState } from "react";
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

const MAX_IMAGE_SIZE_BYTES = 4 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

function getImageUploadError(file: File): string | null {
  if (file.size === 0) return "This image is empty. Choose another file.";
  if (file.size > MAX_IMAGE_SIZE_BYTES) return "Images must be 4 MB or smaller.";
  if (file.type && !ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return "Choose a PNG, JPEG, or WebP image.";
  }
  return null;
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
  const [logoError, setLogoError] = useState("");
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null);
  const [faviconError, setFaviconError] = useState("");
  const [useLogoAsFavicon, setUseLogoAsFavicon] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

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
    if (logoError || faviconError) return;
    if (!editing && !logoFile) {
      setLogoError("Choose a logo image to register this studio.");
      return;
    }

    setSaving(true);
    const formData = new FormData(event.currentTarget);
    formData.delete("logo");
    formData.delete("favicon");
    if (logoFile) formData.set("logo", logoFile);
    if (faviconFile && !useLogoAsFavicon) formData.set("favicon", faviconFile);
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
        const message = result.error || (editing ? "Could not update studio" : "Could not register studio");
        setError(result.diagnosticCode ? `${message} (${result.diagnosticCode})` : message);
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
                ref={logoInputRef}
                id="logo"
                name="logo"
                type="file"
                className="hidden"
                accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                disabled={saving}
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  if (!file) return;
                  const uploadError = getImageUploadError(file);
                  if (uploadError) {
                    setLogoFile(null);
                    setLogoError(uploadError);
                    event.currentTarget.value = "";
                    return;
                  }
                  setLogoError("");
                  setLogoFile(file);
                }}
              />
              <div className="flex items-center gap-4 rounded-lg border p-4">
                <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-md border bg-muted">
                  {(logoPreview || studio.logoUrl) ? (
                    <img
                      src={logoPreview || studio.logoUrl}
                      alt={logoFile ? "Selected logo preview" : "Current studio logo"}
                      className="h-full w-full object-contain p-1"
                    />
                  ) : (
                    <span className="px-2 text-center text-xs text-muted-foreground">No logo</span>
                  )}
                </div>
                <div className="min-w-0 space-y-2">
                  <p className="text-sm font-medium">
                    {logoFile ? "New logo selected" : studio.logoUrl ? "Current studio logo" : "No logo selected"}
                  </p>
                  {logoFile && (
                    <p className="max-w-full truncate text-xs text-muted-foreground" title={logoFile.name}>
                      {logoFile.name} · {Math.max(1, Math.ceil(logoFile.size / 1024))} KB
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={saving}
                      onClick={() => logoInputRef.current?.click()}
                    >
                      {logoFile || studio.logoUrl ? "Choose another" : "Choose logo"}
                    </Button>
                    {logoFile && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={saving}
                        onClick={() => {
                          setLogoFile(null);
                          setLogoError("");
                          if (logoInputRef.current) logoInputRef.current.value = "";
                        }}
                      >
                        Remove selection
                      </Button>
                    )}
                  </div>
                  <p id="logo-help" className="text-xs text-muted-foreground">
                    PNG, JPEG, or WebP, up to 4 MB. We resize and compress it before saving.
                  </p>
                </div>
              </div>
              {logoError && <p role="alert" className="text-sm text-destructive">{logoError}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="favicon">Favicon image (optional)</Label>
              <Input
                id="favicon"
                name="favicon"
                ref={faviconInputRef}
                type="file"
                className="hidden"
                accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  if (!file) return;
                  const uploadError = getImageUploadError(file);
                  if (uploadError) {
                    setFaviconFile(null);
                    setFaviconError(uploadError);
                    event.currentTarget.value = "";
                    return;
                  }
                  setFaviconError("");
                  setFaviconFile(file);
                  setUseLogoAsFavicon(false);
                }}
              />
              <div className="flex items-center gap-4 rounded-lg border p-4">
                <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-md border bg-muted">
                  {(faviconPreview || (useLogoAsFavicon || !studio.faviconUrl
                    ? logoPreview || studio.logoUrl
                    : studio.faviconUrl)) ? (
                    <img
                      src={
                        faviconPreview ||
                        (useLogoAsFavicon || !studio.faviconUrl
                          ? logoPreview || studio.logoUrl
                          : studio.faviconUrl)
                      }
                      alt={faviconFile ? "Selected favicon preview" : "Favicon preview"}
                      className="h-full w-full object-contain p-1"
                    />
                  ) : (
                    <span className="px-1 text-center text-xs text-muted-foreground">No image</span>
                  )}
                </div>
                <div className="min-w-0 space-y-2">
                  <p className="text-sm font-medium">
                    {faviconFile
                      ? "New favicon selected"
                      : useLogoAsFavicon
                        ? "Studio logo will be used"
                        : studio.faviconUrl
                          ? "Current favicon"
                          : "Studio logo is used as the favicon"}
                  </p>
                  {faviconFile && (
                    <p className="max-w-full truncate text-xs text-muted-foreground" title={faviconFile.name}>
                      {faviconFile.name} · {Math.max(1, Math.ceil(faviconFile.size / 1024))} KB
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={saving}
                      onClick={() => faviconInputRef.current?.click()}
                    >
                      {faviconFile || studio.faviconUrl ? "Choose another" : "Choose favicon"}
                    </Button>
                    {faviconFile && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={saving}
                        onClick={() => {
                          setFaviconFile(null);
                          setFaviconError("");
                          setUseLogoAsFavicon(false);
                          if (faviconInputRef.current) faviconInputRef.current.value = "";
                        }}
                      >
                        Remove selection
                      </Button>
                    )}
                  </div>
                  <p id="favicon-help" className="text-xs text-muted-foreground">
                    PNG, JPEG, or WebP, up to 4 MB. {editing
                      ? "Leave unchanged to keep the saved favicon."
                      : "The studio logo is used if you do not upload one."}
                  </p>
                </div>
              </div>
              {faviconError && <p role="alert" className="text-sm text-destructive">{faviconError}</p>}
              {editing && studio.faviconUrl && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={useLogoAsFavicon}
                    disabled={saving}
                    onChange={(event) => {
                      setUseLogoAsFavicon(event.target.checked);
                      if (event.target.checked) {
                        setFaviconFile(null);
                        setFaviconError("");
                        if (faviconInputRef.current) faviconInputRef.current.value = "";
                      }
                    }}
                  />
                  Replace the saved favicon with the studio logo
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
