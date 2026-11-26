"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, KeyRound, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface StudioAdminTarget {
  id: string;
  name: string;
  domain: string;
}

interface AdminResponse {
  error?: string;
  admin?: { email: string };
}

interface StudioAdminDialogProps {
  studio: StudioAdminTarget | null;
  onClose: () => void;
}

export function StudioAdminDialog({ studio, onClose }: StudioAdminDialogProps) {
  const router = useRouter();
  const [adminEmail, setAdminEmail] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminConfirmPassword, setAdminConfirmPassword] = useState("");
  const [adminSaving, setAdminSaving] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [adminSuccess, setAdminSuccess] = useState("");
  const studioId = studio?.id;

  useEffect(() => {
    if (!studioId) return;
    setAdminEmail("");
    setAdminName("");
    setAdminPassword("");
    setAdminConfirmPassword("");
    setAdminError("");
    setAdminSuccess("");
  }, [studioId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!studio) return;

    setAdminError("");
    setAdminSuccess("");

    if (adminPassword !== adminConfirmPassword) {
      setAdminError("Passwords do not match");
      return;
    }
    if (adminPassword.length < 8) {
      setAdminError("Password must be at least 8 characters");
      return;
    }

    setAdminSaving(true);
    try {
      const response = await fetch(
        `/api/owner/studios/${encodeURIComponent(studio.id)}/admin`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: adminEmail,
            name: adminName || "Admin",
            password: adminPassword,
          }),
        }
      );
      if (response.status === 401) {
        router.replace("/owner/login");
        return;
      }

      const result: AdminResponse = await response.json();
      if (!response.ok) {
        setAdminError(result.error || "Operation failed");
        return;
      }
      if (!result.admin?.email) {
        throw new Error("The studios API returned an invalid admin response.");
      }

      setAdminSuccess(`Admin account set for ${result.admin.email}`);
      setAdminPassword("");
      setAdminConfirmPassword("");
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "Operation failed");
    } finally {
      setAdminSaving(false);
    }
  }

  return (
    <Dialog
      open={studio !== null}
      onOpenChange={(open) => {
        if (!open && !adminSaving) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            Admin credentials — {studio?.name}
          </DialogTitle>
          <DialogDescription>
            Manage the ADMIN account in{" "}
            <span className="font-mono text-xs">{studio?.domain}</span>&apos;s DB.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label
              htmlFor="admin-email"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Email <span className="text-destructive">*</span>
            </Label>
            <Input
              id="admin-email"
              type="email"
              required
              placeholder="admin@studio.com"
              value={adminEmail}
              onChange={(event) => setAdminEmail(event.target.value)}
              disabled={adminSaving}
              className="h-9"
              autoComplete="off"
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="admin-name"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Display name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="admin-name"
              required
              placeholder="e.g. Mounika"
              value={adminName}
              onChange={(event) => setAdminName(event.target.value)}
              disabled={adminSaving}
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="admin-password"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Password <span className="text-destructive">*</span>
            </Label>
            <Input
              id="admin-password"
              type="password"
              required
              minLength={8}
              placeholder="Min. 8 characters"
              value={adminPassword}
              onChange={(event) => setAdminPassword(event.target.value)}
              disabled={adminSaving}
              className="h-9"
              autoComplete="new-password"
            />
          </div>
          {adminPassword && (
            <div className="space-y-1.5">
              <Label
                htmlFor="admin-confirm-password"
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Confirm password <span className="text-destructive">*</span>
              </Label>
              <Input
                id="admin-confirm-password"
                type="password"
                required
                minLength={8}
                placeholder="Repeat password"
                value={adminConfirmPassword}
                onChange={(event) => setAdminConfirmPassword(event.target.value)}
                disabled={adminSaving}
                className="h-9"
                autoComplete="new-password"
              />
            </div>
          )}

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
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={adminSaving}
              onClick={onClose}
            >
              {adminSuccess ? "Close" : "Cancel"}
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={adminSaving}
              className="min-w-[110px]"
            >
              {adminSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Working…
                </>
              ) : (
                "Set credentials"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
