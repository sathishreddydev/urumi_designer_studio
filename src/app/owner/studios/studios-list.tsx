"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2, Loader2, PencilLine, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Studio {
  id: string;
  name: string;
  domain: string;
  logoUrl: string;
  active: boolean;
  deactivateAt: string | null;
}

interface ApiResponse {
  error?: string;
  studios?: Studio[];
  studio?: Studio;
}

async function readApiResponse(response: Response): Promise<ApiResponse> {
  const body = await response.text();
  let result: unknown;
  try {
    result = JSON.parse(body);
  } catch {
    throw new Error(
      `The studios API returned a non-JSON response (HTTP ${response.status}). Check the server logs.`
    );
  }
  if (!result || typeof result !== "object") {
    throw new Error("The studios API returned an invalid response.");
  }
  return result as ApiResponse;
}

export function StudiosList() {
  const router = useRouter();
  const [studios, setStudios] = useState<Studio[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [statusError, setStatusError] = useState("");

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Studio | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    fetch("/api/owner/studios", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) {
          router.replace("/owner/login");
          return null;
        }
        const result = await readApiResponse(response);
        if (!response.ok) throw new Error(result.error || "Could not load studios");
        if (!Array.isArray(result.studios)) {
          throw new Error("The studios API response did not contain a studio list.");
        }
        return { studios: result.studios };
      })
      .then((result) => {
        if (result) setStudios(result.studios);
      })
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : "Could not load studios");
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function handleActiveChange(studio: Studio, active: boolean) {
    setStatusError("");
    setUpdatingIds((current) => new Set(current).add(studio.id));

    try {
      const formData = new FormData();
      formData.set("name", studio.name);
      formData.set("domain", studio.domain);
      formData.set("active", String(active));
      formData.set("clearFavicon", "false");

      const response = await fetch(`/api/owner/studios/${encodeURIComponent(studio.id)}`, {
        method: "PATCH",
        body: formData,
      });
      const result = await readApiResponse(response);
      if (response.status === 401) { router.replace("/owner/login"); return; }
      if (!response.ok) throw new Error(result.error || "Could not update studio status");

      setStudios((current) =>
        current.map((item) =>
          item.id === studio.id
            ? { ...item, active, deactivateAt: result.studio?.deactivateAt ?? item.deactivateAt }
            : item
        )
      );
    } catch (updateError) {
      setStatusError(
        updateError instanceof Error ? updateError.message : "Could not update studio status"
      );
    } finally {
      setUpdatingIds((current) => {
        const next = new Set(current);
        next.delete(studio.id);
        return next;
      });
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");

    try {
      const response = await fetch(
        `/api/owner/studios/${encodeURIComponent(deleteTarget.id)}`,
        { method: "DELETE" }
      );
      if (response.status === 401) { router.replace("/owner/login"); return; }
      if (!response.ok) {
        const result = await readApiResponse(response);
        throw new Error(result.error || "Could not delete studio");
      }

      setStudios((current) => current.filter((s) => s.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Could not delete studio");
    } finally {
      setDeleting(false);
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

      {/* Global status errors */}
      {statusError && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm text-destructive">
          {statusError}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Registered studios</CardTitle>
          <CardDescription>Database and Cloudinary credentials are never displayed here.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading studios…
            </div>
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
              {studios.map((studio) => {
                const busy = updatingIds.has(studio.id);
                return (
                  <li key={studio.id} className="flex flex-wrap items-center gap-3 py-4">
                    {studio.logoUrl ? (
                      <img
                        src={studio.logoUrl}
                        alt=""
                        className="h-10 w-10 rounded object-contain"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded border bg-muted" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{studio.name}</p>
                      <p className="truncate text-sm text-muted-foreground">{studio.domain}</p>
                      {studio.deactivateAt && (
                        <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                          <CalendarClock className="h-3 w-3 shrink-0" />
                          Auto-deactivates {new Date(studio.deactivateAt).toLocaleString()}
                        </p>
                      )}
                    </div>

                    {/* Active toggle */}
                    <label className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">{studio.active ? "Active" : "Inactive"}</span>
                      <Switch
                        checked={studio.active}
                        disabled={busy}
                        onCheckedChange={(active) => handleActiveChange(studio, active)}
                        aria-label={`${studio.active ? "Deactivate" : "Activate"} ${studio.name}`}
                      />
                    </label>

                    {/* Edit */}
                    <Button asChild variant="outline" size="sm" disabled={busy}>
                      <Link href={`/owner/editStudio/${encodeURIComponent(studio.id)}`}>
                        <PencilLine className="mr-1.5 h-3.5 w-3.5" />
                        Edit
                      </Link>
                    </Button>

                    {/* Delete */}
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => { setDeleteError(""); setDeleteTarget(studio); }}
                      aria-label={`Delete ${studio.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ── Delete confirmation dialog ── */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open && !deleting) setDeleteTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete studio?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  This will permanently delete{" "}
                  <span className="font-semibold text-foreground">{deleteTarget?.name}</span>{" "}
                  (<span className="font-mono text-xs">{deleteTarget?.domain}</span>).
                </p>
                <p>
                  The studio's database and Cloudinary credentials stored in this registry will be
                  removed. The actual database and its data are not affected.
                </p>
                <p className="font-medium text-destructive">This cannot be undone.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deleteError && (
            <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {deleteError}
            </p>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDeleteConfirm(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Deleting…</>
              ) : (
                "Delete studio"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
