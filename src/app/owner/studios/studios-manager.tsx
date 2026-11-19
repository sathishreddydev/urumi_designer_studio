"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Studio {
  id: string;
  name: string;
  domain: string;
  logoUrl: string;
  active: boolean;
}

export function StudiosManager() {
  const router = useRouter();
  const [studios, setStudios] = useState<Studio[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadStudios() {
    const response = await fetch("/api/owner/studios", { cache: "no-store" });
    if (response.status === 401) {
      router.replace("/owner/login");
      return;
    }
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not load studios");
    setStudios(result.studios);
  }

  useEffect(() => {
    loadStudios()
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : "Could not load studios");
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setSaving(true);
    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await fetch("/api/owner/studios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          domain: formData.get("domain"),
          logoUrl: formData.get("logoUrl"),
          databaseUrl: formData.get("databaseUrl"),
          cloudinaryUrl: formData.get("cloudinaryUrl"),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "Could not register studio");
        return;
      }

      form.reset();
      setNotice("Studio registered. Its database and Cloudinary credentials were encrypted.");
      await loadStudios();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not register studio");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/owner/auth/logout", { method: "POST" });
    router.replace("/owner/login");
    router.refresh();
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl space-y-6 p-4 sm:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Studio registry</h1>
          <p className="text-sm text-muted-foreground">Register a domain and the studio’s private service credentials.</p>
        </div>
        <Button type="button" variant="outline" onClick={handleLogout}>Sign out</Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Register a studio</CardTitle>
          <CardDescription>
            Secrets are encrypted before storage. Use a logo image URL hosted over HTTPS.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Studio name</Label>
              <Input id="name" name="name" maxLength={120} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="domain">Domain</Label>
              <Input id="domain" name="domain" placeholder="studio.example.com" required />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="logoUrl">Logo image URL</Label>
              <Input id="logoUrl" name="logoUrl" type="url" placeholder="https://example.com/logo.png" required />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="databaseUrl">Studio PostgreSQL URL</Label>
              <Input id="databaseUrl" name="databaseUrl" type="password" autoComplete="new-password" placeholder="postgresql://..." required />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="cloudinaryUrl">Cloudinary URL</Label>
              <Input id="cloudinaryUrl" name="cloudinaryUrl" type="password" autoComplete="new-password" placeholder="cloudinary://key:secret@cloud-name" required />
            </div>
            {error && <p role="alert" className="text-sm text-destructive md:col-span-2">{error}</p>}
            {notice && <p role="status" className="text-sm text-green-700 md:col-span-2">{notice}</p>}
            <div className="md:col-span-2">
              <Button type="submit" disabled={saving}>{saving ? "Registering..." : "Register studio"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Registered studios</CardTitle>
          <CardDescription>Private database and Cloudinary credentials are never included in this list.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading studios...</p>
          ) : studios.length === 0 ? (
            <p className="text-sm text-muted-foreground">No studios have been registered yet.</p>
          ) : (
            <ul className="divide-y">
              {studios.map((studio) => (
                <li key={studio.id} className="flex items-center gap-3 py-3">
                  <img src={studio.logoUrl} alt="" className="h-10 w-10 rounded object-contain" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{studio.name}</p>
                    <p className="truncate text-sm text-muted-foreground">{studio.domain}</p>
                  </div>
                  <span className="ml-auto text-sm">{studio.active ? "Active" : "Inactive"}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
