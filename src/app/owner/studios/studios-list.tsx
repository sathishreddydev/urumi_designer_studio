"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Studio {
  id: string;
  name: string;
  domain: string;
  logoUrl: string;
  active: boolean;
}

export function StudiosList() {
  const router = useRouter();
  const [studios, setStudios] = useState<Studio[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/owner/studios", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) {
          router.replace("/owner/login");
          return null;
        }
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load studios");
        return result as { studios: Studio[] };
      })
      .then((result) => {
        if (result) setStudios(result.studios);
      })
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : "Could not load studios");
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function handleLogout() {
    await fetch("/api/owner/auth/logout", { method: "POST" });
    router.replace("/owner/login");
    router.refresh();
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl space-y-6 p-4 sm:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Studios</h1>
          <p className="text-sm text-muted-foreground">Manage registered studio domains and settings.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/owner/newStudio">Add studio</Link>
          </Button>
          <Button type="button" variant="outline" onClick={handleLogout}>Sign out</Button>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Registered studios</CardTitle>
          <CardDescription>Database and Cloudinary credentials are never displayed here.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading studios...</p>
          ) : error ? (
            <p role="alert" className="text-sm text-destructive">{error}</p>
          ) : studios.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">No studios have been registered yet.</p>
              <Button asChild size="sm">
                <Link href="/owner/newStudio">Register your first studio</Link>
              </Button>
            </div>
          ) : (
            <ul className="divide-y">
              {studios.map((studio) => (
                <li key={studio.id} className="flex flex-wrap items-center gap-3 py-4">
                  <img src={studio.logoUrl} alt="" className="h-10 w-10 rounded object-contain" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{studio.name}</p>
                    <p className="truncate text-sm text-muted-foreground">{studio.domain}</p>
                  </div>
                  <span className={`text-sm ${studio.active ? "text-green-700" : "text-destructive"}`}>
                    {studio.active ? "Active" : "Inactive"}
                  </span>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/owner/editStudio/${encodeURIComponent(studio.id)}`}>Edit</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
