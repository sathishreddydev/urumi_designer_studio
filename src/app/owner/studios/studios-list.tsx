"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2, Loader2, PencilLine, CalendarClock, KeyRound, CheckCircle2, XCircle, AlertTriangle, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { OwnerSessionExpiryWarning } from "../session-expiry-warning";

interface Studio {
  id: string;
  name: string;
  domain: string;
  logoUrl: string;
  active: boolean;
  deactivateAt: string | null;
  notes: string;
}

interface ApiResponse {
  error?: string;
  studios?: Studio[];
  studio?: Studio;
  healthy?: boolean;
  latencyMs?: number;
}

type HealthStatus = "checking" | "healthy" | "unhealthy";

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
  const [healthStatuses, setHealthStatuses] = useState<Record<string, HealthStatus>>({});
  const [now, setNow] = useState(Date.now());

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Studio | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Admin credential state
  const [adminTarget, setAdminTarget] = useState<Studio | null>(null);
  const [adminTab, setAdminTab] = useState<"set" | "update" | "delete">("set");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminConfirmPassword, setAdminConfirmPassword] = useState("");
  const [adminSaving, setAdminSaving] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [adminSuccess, setAdminSuccess] = useState("");

  // Owner password state
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

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
        if (result) {
          setStudios(result.studios);
          setHealthStatuses(Object.fromEntries(result.studios.map((studio) => [studio.id, "checking"])));
          void checkStudioHealth(result.studios);
        }
      })
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : "Could not load studios");
      })
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, []);

  async function checkStudioHealth(studioList: Studio[]) {
    let nextIndex = 0;
    const worker = async () => {
      while (nextIndex < studioList.length) {
        const studio = studioList[nextIndex++];
        try {
          const response = await fetch(
            `/api/owner/studios/${encodeURIComponent(studio.id)}/health`,
            { cache: "no-store" }
          );
          if (response.status === 401) {
            router.replace("/owner/login");
            return;
          }
          const result = await readApiResponse(response);
          setHealthStatuses((current) => ({
            ...current,
            [studio.id]: response.ok && result.healthy ? "healthy" : "unhealthy",
          }));
        } catch {
          setHealthStatuses((current) => ({ ...current, [studio.id]: "unhealthy" }));
        }
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(3, studioList.length) }, () => worker())
    );
  }

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

  function openAdminDialog(studio: Studio) {
    setAdminTarget(studio);
    setAdminTab("set");
    setAdminEmail("");
    setAdminName("");
    setAdminPassword("");
    setAdminConfirmPassword("");
    setAdminError("");
    setAdminSuccess("");
  }

  async function handleAdminSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAdminError("");
    setAdminSuccess("");

    if (adminTab !== "delete") {
      if (adminPassword !== adminConfirmPassword) {
        setAdminError("Passwords do not match");
        return;
      }
      if (adminTab === "set" && adminPassword.length < 8) {
        setAdminError("Password must be at least 8 characters");
        return;
      }
      if (adminTab === "update" && adminPassword && adminPassword.length < 8) {
        setAdminError("Password must be at least 8 characters");
        return;
      }
    }

    setAdminSaving(true);
    try {
      const url = `/api/owner/studios/${encodeURIComponent(adminTarget!.id)}/admin`;
      let method = "POST";
      let bodyObj: Record<string, string> = { email: adminEmail, name: adminName || "Admin", password: adminPassword };

      if (adminTab === "update") {
        method = "PATCH";
        bodyObj = { email: adminEmail, name: adminName, password: adminPassword };
      } else if (adminTab === "delete") {
        method = "DELETE";
        bodyObj = { email: adminEmail };
      }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyObj),
      });
      if (response.status === 401) { router.replace("/owner/login"); return; }
      const result = await response.json();
      if (!response.ok) {
        setAdminError(result.error || "Operation failed");
        return;
      }

      if (adminTab === "delete") {
        setAdminSuccess(`Admin account removed.`);
      } else {
        setAdminSuccess(`Admin account ${adminTab === "set" ? "set" : "updated"} for ${result.admin.email}`);
      }
      setAdminPassword("");
      setAdminConfirmPassword("");
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : "Operation failed");
    } finally {
      setAdminSaving(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/owner/auth/logout", { method: "POST" });
    router.replace("/owner/login");
    router.refresh();
  }

  async function handlePasswordChange(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");
    if (newPassword !== confirmNewPassword) {
      setPasswordError("New passwords do not match");
      return;
    }
    if (newPassword.length < 8 || newPassword.length > 128) {
      setPasswordError("New password must be between 8 and 128 characters");
      return;
    }

    setPasswordSaving(true);
    try {
      const response = await fetch("/api/owner/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const result = await readApiResponse(response);
      if (response.status === 401) {
        router.replace("/owner/login");
        return;
      }
      if (!response.ok) throw new Error(result.error || "Could not change password");

      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setPasswordSuccess("Owner password changed successfully.");
      window.dispatchEvent(new Event("owner-session-renewed"));
    } catch (changeError) {
      setPasswordError(changeError instanceof Error ? changeError.message : "Could not change password");
    } finally {
      setPasswordSaving(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl space-y-6 p-4 sm:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Studios</h1>
          <p className="text-sm text-muted-foreground">Manage registered studio domains and settings.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/owner/newStudio">Add studio</Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setPasswordDialogOpen(true);
              setPasswordError("");
              setPasswordSuccess("");
            }}
          >
            Change password
          </Button>
          <Button type="button" variant="outline" onClick={handleLogout}>Sign out</Button>
        </div>
      </header>

      <OwnerSessionExpiryWarning />

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
                const expired = studio.deactivateAt !== null && new Date(studio.deactivateAt).getTime() <= now;
                const effectivelyActive = studio.active && !expired;
                const health = healthStatuses[studio.id] ?? "checking";
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
                      <p
                        role="status"
                        className={`mt-1 flex items-center gap-1 text-xs ${
                          health === "healthy"
                            ? "text-green-700 dark:text-green-400"
                            : health === "unhealthy"
                              ? "text-destructive"
                              : "text-muted-foreground"
                        }`}
                      >
                        {health === "checking" ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : health === "healthy" ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <XCircle className="h-3 w-3" />
                        )}
                        <Database className="h-3 w-3" />
                        {health === "checking"
                          ? "Checking database…"
                          : health === "healthy"
                            ? "Database connected"
                            : "Database unreachable"}
                      </p>
                      {studio.notes && (
                        <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs text-muted-foreground">
                          {studio.notes}
                        </p>
                      )}
                      {studio.deactivateAt && (
                        <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                          <CalendarClock className="h-3 w-3 shrink-0" />
                          {expired
                            ? `Auto-deactivated ${new Date(studio.deactivateAt).toLocaleString()}`
                            : `Auto-deactivates ${new Date(studio.deactivateAt).toLocaleString()}`}
                        </p>
                      )}
                    </div>

                    {/* Active toggle */}
                    <label className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">
                        {expired ? "Expired" : effectivelyActive ? "Active" : "Inactive"}
                      </span>
                      <Switch
                        checked={effectivelyActive}
                        disabled={busy || expired}
                        onCheckedChange={(active) => handleActiveChange(studio, active)}
                        aria-label={`${effectivelyActive ? "Deactivate" : "Activate"} ${studio.name}`}
                      />
                    </label>

                    {/* Edit */}
                    <Button asChild variant="outline" size="sm" disabled={busy}>
                      <Link href={`/owner/editStudio/${encodeURIComponent(studio.id)}`}>
                        <PencilLine className="mr-1.5 h-3.5 w-3.5" />
                        Edit
                      </Link>
                    </Button>

                    {/* Set admin */}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => openAdminDialog(studio)}
                      title="Set admin credentials for this studio"
                    >
                      <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                      Set admin
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
      <Dialog
        open={passwordDialogOpen}
        onOpenChange={(open) => {
          if (!passwordSaving) {
            setPasswordDialogOpen(open);
            if (!open) {
              setCurrentPassword("");
              setNewPassword("");
              setConfirmNewPassword("");
              setPasswordError("");
              setPasswordSuccess("");
            }
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change owner password</DialogTitle>
            <DialogDescription>
              Enter your current password and choose a new password of 8 to 128 characters.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="owner-current-password">Current password</Label>
              <Input
                id="owner-current-password"
                type="password"
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                disabled={passwordSaving}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="owner-new-password">New password</Label>
              <Input
                id="owner-new-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                required
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                disabled={passwordSaving}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="owner-confirm-password">Confirm new password</Label>
              <Input
                id="owner-confirm-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                required
                value={confirmNewPassword}
                onChange={(event) => setConfirmNewPassword(event.target.value)}
                disabled={passwordSaving}
              />
            </div>
            {passwordError && <p role="alert" className="text-sm text-destructive">{passwordError}</p>}
            {passwordSuccess && <p role="status" className="text-sm text-green-700 dark:text-green-400">{passwordSuccess}</p>}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={passwordSaving}
                onClick={() => {
                  setPasswordDialogOpen(false);
                  setCurrentPassword("");
                  setNewPassword("");
                  setConfirmNewPassword("");
                  setPasswordError("");
                  setPasswordSuccess("");
                }}
              >
                {passwordSuccess ? "Close" : "Cancel"}
              </Button>
              {!passwordSuccess && (
                <Button type="submit" disabled={passwordSaving}>
                  {passwordSaving ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</>
                  ) : "Change password"}
                </Button>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>
      {/* ── Admin credentials dialog ── */}
      <Dialog
        open={adminTarget !== null}
        onOpenChange={(open) => { if (!open && !adminSaving) setAdminTarget(null); }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              Admin credentials — {adminTarget?.name}
            </DialogTitle>
            <DialogDescription>
              Manage the ADMIN account in{" "}
              <span className="font-mono text-xs">{adminTarget?.domain}</span>'s database.
            </DialogDescription>
          </DialogHeader>

          {/* Tab switcher */}
          {/* <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
            {(["set", "update", "delete"] as const).filter((tab) => tab === "set").map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => { setAdminTab(tab); setAdminError(""); setAdminSuccess(""); setAdminPassword(""); setAdminConfirmPassword(""); }}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  adminTab === tab
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === "set" ? "Set / Create" : tab === "update" ? "Update" : "Remove"}
              </button>
            ))}
          </div> */}

          <form onSubmit={handleAdminSubmit} className="space-y-4">

            {/* Email — always shown */}
            <div className="space-y-1.5">
              <Label htmlFor="admin-email" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="admin-email"
                type="email"
                required
                placeholder="admin@studio.com"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                disabled={adminSaving}
                className="h-9"
                autoComplete="off"
              />
            </div>

            {/* Name — Set and Update only */}
            {adminTab !== "delete" && (
              <div className="space-y-1.5">
                <Label htmlFor="admin-name" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Display name{adminTab === "set"
                    ? <span className="text-destructive"> *</span>
                    : <span className="ml-1 text-muted-foreground/60">(leave blank to keep current)</span>
                  }
                </Label>
                <Input
                  id="admin-name"
                  required={adminTab === "set"}
                  placeholder={adminTab === "set" ? "e.g. Mounika" : "Leave blank to keep current"}
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  disabled={adminSaving}
                  className="h-9"
                />
              </div>
            )}

            {/* Password — Set and Update only */}
            {adminTab !== "delete" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="admin-password" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Password{" "}
                    {adminTab === "set"
                      ? <span className="text-destructive">*</span>
                      : <span className="ml-1 text-muted-foreground/60">(leave blank to keep current)</span>
                    }
                  </Label>
                  <Input
                    id="admin-password"
                    type="password"
                    required={adminTab === "set"}
                    minLength={adminTab === "set" ? 8 : undefined}
                    placeholder={adminTab === "set" ? "Min. 8 characters" : "Leave blank to keep current"}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    disabled={adminSaving}
                    className="h-9"
                    autoComplete="new-password"
                  />
                </div>
                {adminPassword && (
                  <div className="space-y-1.5">
                    <Label htmlFor="admin-confirm-password" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Confirm password <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="admin-confirm-password"
                      type="password"
                      required
                      placeholder="Repeat password"
                      value={adminConfirmPassword}
                      onChange={(e) => setAdminConfirmPassword(e.target.value)}
                      disabled={adminSaving}
                      className="h-9"
                      autoComplete="new-password"
                    />
                  </div>
                )}
              </>
            )}

            {/* Delete warning */}
            {adminTab === "delete" && (
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  This permanently deletes the ADMIN user with the given email from{" "}
                  <span className="font-semibold">{adminTarget?.name}</span>'s database.
                  This cannot be undone.
                </span>
              </div>
            )}

            {/* Feedback */}
            {adminError && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{adminError}</span>
              </div>
            )}
            {adminSuccess && (
              <div className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-3 py-2.5 text-sm text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{adminSuccess}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" disabled={adminSaving} onClick={() => setAdminTarget(null)}>
                {adminSuccess ? "Close" : "Cancel"}
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={adminSaving}
                className={`min-w-[110px] ${adminTab === "delete" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}`}
              >
                {adminSaving ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Working…</>
                ) : adminTab === "set" ? (
                  "Set credentials"
                ) : adminTab === "update" ? (
                  "Save changes"
                ) : (
                  "Remove admin"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
