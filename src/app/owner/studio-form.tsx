"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Building2,
  Globe,
  ImageIcon,
  Database,
  Cloud,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  CalendarClock,
  X,
} from "lucide-react";
import { compressImageForUpload } from "@/lib/compress-image";

interface Studio {
  name: string;
  domain: string;
  logoUrl: string;
  faviconUrl: string | null;
  active: boolean;
  deactivateAt: string | null;
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

function ImagePickerBox({
  label,
  badge,
  previewSrc,
  previewAlt,
  fileName,
  fileSize,
  hint,
  error,
  disabled,
  onChoose,
  onRemove,
  size = "lg",
}: {
  label: string;
  badge?: string;
  previewSrc: string | null | undefined;
  previewAlt: string;
  fileName?: string;
  fileSize?: number;
  hint: string;
  error?: string;
  disabled?: boolean;
  onChoose: () => void;
  onRemove?: () => void;
  size?: "sm" | "lg";
}) {
  const boxSize = size === "lg" ? "h-20 w-20" : "h-16 w-16";
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <ImageIcon className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm font-medium">{label}</Label>
        {badge && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {badge}
          </span>
        )}
      </div>
      <div
        className={`flex items-center gap-4 rounded-xl border bg-muted/30 p-4 transition-colors ${error ? "border-destructive/60" : "border-border"}`}
      >
        <div
          className={`${boxSize} shrink-0 overflow-hidden rounded-lg border bg-background shadow-sm`}
        >
          {previewSrc ? (
            <img
              src={previewSrc}
              alt={previewAlt}
              className="h-full w-full object-contain p-1"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-sm font-medium leading-tight">
            {fileName ? (
              <span className="text-foreground">{fileName}</span>
            ) : previewSrc ? (
              <span className="text-muted-foreground">Current image saved</span>
            ) : (
              <span className="text-muted-foreground">No image selected</span>
            )}
          </p>
          {fileSize !== undefined && (
            <p className="text-xs text-muted-foreground">
              {Math.max(1, Math.ceil(fileSize / 1024))} KB
            </p>
          )}
          <div className="flex flex-wrap gap-2 pt-0.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={onChoose}
              className="h-7 text-xs"
            >
              {previewSrc ? "Change" : "Choose file"}
            </Button>
            {onRemove && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={onRemove}
                className="h-7 text-xs text-muted-foreground"
              >
                Remove
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground/70">{hint}</p>
        </div>
      </div>
      {error && (
        <div className="flex items-center gap-1.5 text-sm text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
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
    deactivateAt: null,
  });
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
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
    if (!logoFile) { setLogoPreview(null); return; }
    const url = URL.createObjectURL(logoFile);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  useEffect(() => {
    if (!faviconFile) { setFaviconPreview(null); return; }
    const url = URL.createObjectURL(faviconFile);
    setFaviconPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [faviconFile]);

  useEffect(() => {
    if (!studioId) return;
    fetch(`/api/owner/studios/${encodeURIComponent(studioId)}`, { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 401) { router.replace("/owner/login"); return null; }
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Could not load studio");
        return result.studio as Studio;
      })
      .then((result) => { if (result) { setStudio(result); setUseLogoAsFavicon(false); } })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load studio"))
      .finally(() => setLoading(false));
  }, [router, studioId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccessMessage("");
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
      // Send deactivateAt: ISO string, "clear" to remove, or omit if unchanged
      if (studio.deactivateAt !== undefined) {
        formData.set("deactivateAt", studio.deactivateAt ?? "clear");
      }
    }

    try {
      const response = await fetch(
        editing ? `/api/owner/studios/${encodeURIComponent(studioId!)}` : "/api/owner/studios",
        { method: editing ? "PATCH" : "POST", body: formData }
      );
      const result = await response.json();
      if (!response.ok) {
        const message = result.error || (editing ? "Could not update studio" : "Could not register studio");
        setError(result.diagnosticCode ? `${message} (${result.diagnosticCode})` : message);
        return;
      }
      if (editing) {
        setSuccessMessage("Studio updated successfully.");
        setTimeout(() => setSuccessMessage(""), 4000);
      } else {
        router.push("/owner");
        router.refresh();
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not save studio");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading studio…</span>
        </div>
      </main>
    );
  }

  /* favicon preview src resolution */
  const faviconDisplaySrc =
    faviconPreview ||
    (useLogoAsFavicon
      ? logoPreview || studio.logoUrl || null
      : studio.faviconUrl || logoPreview || studio.logoUrl || null);

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl space-y-6 p-4 sm:p-8">
      {/* Header */}
      <header className="space-y-1">
        <Link href="/owner" className="text-xs text-muted-foreground hover:underline">
          ← Back to studios
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">
          {editing ? "Edit studio" : "Register studio"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {editing
            ? "Update the studio's details, branding, and credentials."
            : "Fill in the details to register a new studio."}
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* ── Studio Identity ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              Studio identity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Name + Domain side by side */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Building2 className="h-3 w-3" /> Studio name
                </Label>
                <Input
                  id="name"
                  name="name"
                  maxLength={120}
                  required
                  placeholder="e.g. Urumi by Mounika"
                  value={studio.name}
                  onChange={(e) => setStudio((s) => ({ ...s, name: e.target.value }))}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="domain" className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Globe className="h-3 w-3" /> Domain
                </Label>
                <Input
                  id="domain"
                  name="domain"
                  placeholder="studio.example.com"
                  required
                  value={studio.domain}
                  onChange={(e) => setStudio((s) => ({ ...s, domain: e.target.value }))}
                  className="h-10"
                />
              </div>
            </div>

            {editing && (
              <>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border bg-muted/30 px-4 py-3 text-sm transition-colors hover:bg-muted/50">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={studio.active}
                    onChange={(e) => setStudio((s) => ({ ...s, active: e.target.checked }))}
                  />
                  <span className="font-medium">Studio is active</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {studio.active ? "Visible to users" : "Hidden from users"}
                  </span>
                </label>

                {/* Scheduled deactivation date */}
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <CalendarClock className="h-3 w-3" /> Auto-deactivate on
                  </Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="datetime-local"
                      className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      value={
                        studio.deactivateAt
                          ? new Date(studio.deactivateAt).toISOString().slice(0, 16)
                          : ""
                      }
                      min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                      onChange={(e) =>
                        setStudio((s) => ({
                          ...s,
                          deactivateAt: e.target.value
                            ? new Date(e.target.value).toISOString()
                            : null,
                        }))
                      }
                    />
                    {studio.deactivateAt && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-10 px-3 text-muted-foreground"
                        onClick={() => setStudio((s) => ({ ...s, deactivateAt: null }))}
                        title="Clear scheduled date"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {studio.deactivateAt
                      ? `Will automatically go inactive on ${new Date(studio.deactivateAt).toLocaleString()}`
                      : "Leave blank to keep the studio active indefinitely"}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* ── Branding ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
              Branding
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Hidden file inputs */}
            <input
              ref={logoInputRef}
              type="file"
              className="hidden"
              accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
              disabled={saving}
              onChange={async (e) => {
                const file = e.currentTarget.files?.[0];
                if (!file) return;
                const err = getImageUploadError(file);
                if (err) { setLogoFile(null); setLogoError(err); e.currentTarget.value = ""; return; }
                setLogoError("");
                // Compress in browser: resize to 512px max, encode as WebP — mirrors what sharp used to do
                const compressed = await compressImageForUpload(file, {
                  maxDimension: 512,
                  mimeType: "image/webp",
                  quality: 0.82,
                  outputFileName: file.name.replace(/\.[^.]+$/, ".webp"),
                });
                setLogoFile(compressed);
              }}
            />
            <input
              ref={faviconInputRef}
              type="file"
              className="hidden"
              accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
              disabled={saving}
              onChange={async (e) => {
                const file = e.currentTarget.files?.[0];
                if (!file) return;
                const err = getImageUploadError(file);
                if (err) { setFaviconFile(null); setFaviconError(err); e.currentTarget.value = ""; return; }
                setFaviconError("");
                // Compress in browser: resize to 64px max, encode as PNG — mirrors what sharp used to do
                const compressed = await compressImageForUpload(file, {
                  maxDimension: 64,
                  mimeType: "image/png",
                  quality: 1,
                  outputFileName: file.name.replace(/\.[^.]+$/, ".png"),
                });
                setFaviconFile(compressed);
                setUseLogoAsFavicon(false);
              }}
            />

            {/* Logo + Favicon side by side */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ImagePickerBox
                label="Logo image"
                previewSrc={logoPreview || studio.logoUrl || null}
                previewAlt={logoFile ? "New logo preview" : "Current studio logo"}
                fileName={logoFile?.name}
                fileSize={logoFile?.size}
                hint="PNG, JPEG or WebP · max 4 MB · resized to 512px & compressed"
                error={logoError}
                disabled={saving}
                onChoose={() => logoInputRef.current?.click()}
                onRemove={
                  logoFile
                    ? () => { setLogoFile(null); setLogoError(""); if (logoInputRef.current) logoInputRef.current.value = ""; }
                    : undefined
                }
                size="lg"
              />
              <ImagePickerBox
                label="Favicon image"
                badge="optional"
                previewSrc={faviconDisplaySrc}
                previewAlt={faviconFile ? "New favicon preview" : "Favicon preview"}
                fileName={faviconFile?.name}
                fileSize={faviconFile?.size}
                hint={editing ? "Resized to 64px · leave unchanged to keep saved" : "Resized to 64px · uses logo if not set"}
                error={faviconError}
                disabled={saving}
                onChoose={() => faviconInputRef.current?.click()}
                onRemove={
                  faviconFile
                    ? () => { setFaviconFile(null); setFaviconError(""); setUseLogoAsFavicon(false); if (faviconInputRef.current) faviconInputRef.current.value = ""; }
                    : undefined
                }
                size="sm"
              />
            </div>

            {editing && studio.faviconUrl && (
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border bg-muted/30 px-4 py-3 text-sm transition-colors hover:bg-muted/50">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={useLogoAsFavicon}
                  disabled={saving}
                  onChange={(e) => {
                    setUseLogoAsFavicon(e.target.checked);
                    if (e.target.checked) { setFaviconFile(null); setFaviconError(""); if (faviconInputRef.current) faviconInputRef.current.value = ""; }
                  }}
                />
                <span className="font-medium">Use logo as favicon</span>
                <span className="ml-auto text-xs text-muted-foreground">Replaces the saved favicon</span>
              </label>
            )}
          </CardContent>
        </Card>

        {/* ── Credentials ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-4 w-4 text-muted-foreground" />
              Credentials
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
              Credentials are encrypted before storage and are never shown after saving.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="databaseUrl" className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Database className="h-3 w-3" /> PostgreSQL URL
              </Label>
              <Input
                id="databaseUrl"
                name="databaseUrl"
                type="password"
                autoComplete="new-password"
                placeholder={editing ? "Leave blank to keep the current URL" : "postgresql://user:pass@host/db"}
                required={!editing}
                className="h-10 font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cloudinaryUrl" className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Cloud className="h-3 w-3" /> Cloudinary URL
              </Label>
              <Input
                id="cloudinaryUrl"
                name="cloudinaryUrl"
                type="password"
                autoComplete="new-password"
                placeholder={editing ? "Leave blank to keep the current URL" : "cloudinary://key:secret@cloud-name"}
                required={!editing}
                className="h-10 font-mono text-sm"
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Status messages ── */}
        {error && (
          <div className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMessage && (
          <div className="flex items-center gap-2.5 rounded-xl border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* ── Actions ── */}
        <div className="flex gap-2">
          <Button type="submit" disabled={saving} className="min-w-[130px]">
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : editing ? (
              "Save changes"
            ) : (
              "Register studio"
            )}
          </Button>
          <Button asChild type="button" variant="outline">
            <Link href="/owner">Cancel</Link>
          </Button>
        </div>
      </form>
    </main>
  );
}
