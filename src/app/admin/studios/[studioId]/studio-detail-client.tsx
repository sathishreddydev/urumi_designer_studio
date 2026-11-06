"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Globe,
  Palette,
  Settings,
  AlertTriangle,
  CheckCircle2,
  Pause,
  Play,
  ArrowLeft,
  Loader2,
  Cloud,
  Database,
} from "lucide-react";
import type { Studio } from "@/lib/db/master";
import type { DnsRecord } from "@/lib/db/master";

export function StudioDetailClient({
  studio,
  dnsRecords,
}: {
  studio: Studio;
  dnsRecords: DnsRecord[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Editable branding fields
  const [brandName, setBrandName] = useState(studio.brandName);
  const [primaryColor, setPrimaryColor] = useState(studio.primaryColor || "#000000");
  const [logoUrl, setLogoUrl] = useState(studio.logoUrl || "");
  const [businessEmail, setBusinessEmail] = useState(studio.businessEmail || "");
  const [businessPhone, setBusinessPhone] = useState(studio.businessPhone || "");

  // Features
  const [features, setFeatures] = useState(studio.features);

  async function updateStudio(updates: Record<string, unknown>) {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(`/api/admin/studios/${studio.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage("✅ Saved successfully");
        router.refresh();
      } else {
        setMessage(data.error || "Failed to save");
      }
    } catch {
      setMessage("Network error");
    } finally {
      setLoading(false);
    }
  }

  function handleSuspend() {
    if (confirm("Suspend this studio? They will see a suspended page.")) {
      updateStudio({ action: "suspend", reason: "Suspended by admin" });
    }
  }

  function handleActivate() {
    if (confirm("Reactivate this studio?")) {
      updateStudio({ action: "activate" });
    }
  }

  function handleSaveBranding() {
    updateStudio({
      brandName,
      primaryColor,
      logoUrl,
      businessEmail,
      businessPhone,
    });
  }

  function toggleFeature(key: string) {
    updateStudio({
      features: { [key]: !features[key as keyof typeof features] },
    });
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Back link */}
      <button
        onClick={() => router.push("/admin/studios")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Studios
      </button>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{studio.brandName}</h1>
          <p className="text-sm text-muted-foreground">{studio.domain}</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs px-3 py-1 rounded-full font-medium ${
              studio.status === "active"
                ? "bg-green-100 text-green-700"
                : studio.status === "trial"
                ? "bg-blue-100 text-blue-700"
                : studio.status === "suspended"
                ? "bg-red-100 text-red-700"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            {studio.status}
          </span>
          <span className="text-xs px-3 py-1 rounded-full font-medium bg-muted capitalize">
            {studio.planType}
          </span>
        </div>
      </div>

      {message && (
        <p className="text-sm text-center text-muted-foreground">{message}</p>
      )}

      {/* Status controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Settings className="h-5 w-5 text-primary" />
            <CardTitle>Studio Status</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            {studio.status !== "suspended" ? (
              <Button
                variant="destructive"
                onClick={handleSuspend}
                disabled={loading}
              >
                <Pause className="h-4 w-4 mr-2" />
                Suspend Studio
              </Button>
            ) : (
              <Button onClick={handleActivate} disabled={loading}>
                <Play className="h-4 w-4 mr-2" />
                Reactivate Studio
              </Button>
            )}

            {studio.status !== "cancelled" && (
              <Button
                variant="outline"
                onClick={() =>
                  confirm("Cancel this studio permanently?") &&
                  updateStudio({ action: "cancel" })
                }
                disabled={loading}
              >
                Cancel Subscription
              </Button>
            )}
          </div>

          {studio.suspendedAt && (
            <p className="text-xs text-muted-foreground">
              Suspended on{" "}
              {new Date(studio.suspendedAt).toLocaleDateString()}
              {studio.suspendReason && ` — ${studio.suspendReason}`}
            </p>
          )}
        </CardContent>
      </Card>

      {/* DNS status */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Globe className="h-5 w-5 text-primary" />
            <CardTitle>Domain & DNS</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">DNS Verification</span>
            {studio.dnsVerified ? (
              <span className="flex items-center gap-1 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                Verified
              </span>
            ) : (
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <AlertTriangle className="h-4 w-4" />
                Not verified
              </span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">SSL Status</span>
            <span className="text-sm capitalize">{studio.sslStatus}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Database</span>
            <span className="text-sm font-mono">{studio.databaseName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Cloudinary</span>
            <span className="text-sm capitalize">
              {studio.cloudinaryAccountType}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Branding */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Palette className="h-5 w-5 text-primary" />
            <CardTitle>Branding</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="brandName">Studio Name</Label>
            <Input
              id="brandName"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="logoUrl">Logo URL</Label>
              <Input
                id="logoUrl"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://res.cloudinary.com/..."
              />
            </div>
            <div>
              <Label htmlFor="primaryColor">Primary Color</Label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-10 w-16 rounded border cursor-pointer"
                />
                <Input
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-32"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="email">Business Email</Label>
              <Input
                id="email"
                value={businessEmail}
                onChange={(e) => setBusinessEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="phone">Business Phone</Label>
              <Input
                id="phone"
                value={businessPhone}
                onChange={(e) => setBusinessPhone(e.target.value)}
              />
            </div>
          </div>

          <Button onClick={handleSaveBranding} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : null}
            Save Branding
          </Button>
        </CardContent>
      </Card>

      {/* Feature flags */}
      <Card>
        <CardHeader>
          <CardTitle>Feature Flags</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.entries({
            whatsappIntegration: "WhatsApp Integration",
            instagramFeed: "Instagram Feed",
            customerPortal: "Customer Portal",
            aiMeasurements: "AI Measurements",
            customReports: "Custom Reports",
          }).map(([key, label]) => (
            <div
              key={key}
              className="flex items-center justify-between p-3 rounded-lg border"
            >
              <span className="text-sm font-medium">{label}</span>
              <button
                onClick={() => toggleFeature(key)}
                disabled={loading}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  features[key as keyof typeof features]
                    ? "bg-primary"
                    : "bg-muted"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    features[key as keyof typeof features]
                      ? "translate-x-6"
                      : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Cloudinary settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Cloud className="h-5 w-5 text-primary" />
            <CardTitle>Cloudinary (Image Storage)</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-lg border">
            <span className="text-sm font-medium">Account Type</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              studio.cloudinaryAccountType === "own"
                ? "bg-green-100 text-green-700"
                : "bg-blue-100 text-blue-700"
            }`}>
              {studio.cloudinaryAccountType === "own" ? "Own Account" : "Shared (Platform)"}
            </span>
          </div>

          {studio.cloudinaryAccountType === "own" && studio.cloudinaryCloudName && (
            <div className="space-y-1">
              <Label>Cloud Name</Label>
              <Input value={studio.cloudinaryCloudName} readOnly className="font-mono bg-muted" />
            </div>
          )}

          <CloudinaryForm studioId={studio.id} currentAccountType={studio.cloudinaryAccountType} />

          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            <p className="font-medium mb-1">How it works:</p>
            <ul className="space-y-0.5">
              <li>• <strong>Shared</strong>: Files stored on our Cloudinary account (included in plan)</li>
              <li>• <strong>Own Account</strong>: Files stored on your Cloudinary account (free at cloudinary.com)</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Database settings (BYODB) */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Database className="h-5 w-5 text-primary" />
            <CardTitle>Database (BYODB)</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <DatabaseForm studioId={studio.id} />

          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            <p className="font-medium mb-1">How it works:</p>
            <ul className="space-y-0.5">
              <li>• <strong>Shared</strong>: Data stored on our database (included in plan, limited storage)</li>
              <li>• <strong>Own Database</strong>: Customer provides their own PostgreSQL URL (any provider — Neon, Supabase, AWS RDS, local)</li>
              <li>• Connection is encrypted and validated before saving</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * CloudinaryForm — sub-component for the admin to switch between
 * shared and own Cloudinary accounts, and to save/validate credentials.
 */
function CloudinaryForm({
  studioId,
  currentAccountType,
}: {
  studioId: string;
  currentAccountType: string;
}) {
  const [accountType, setAccountType] = useState<"shared" | "own">(
    currentAccountType as "shared" | "own"
  );
  const [cloudName, setCloudName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState("");

  async function handleSave() {
    setSaving(true);
    setResult("");

    try {
      const res = await fetch(`/api/admin/studios/${studioId}/cloudinary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountType,
          cloudinaryCloudName: accountType === "own" ? cloudName : undefined,
          cloudinaryApiKey: accountType === "own" ? apiKey : undefined,
          cloudinaryApiSecret: accountType === "own" ? apiSecret : undefined,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setResult("✅ " + (data.message || "Saved successfully"));
      } else {
        setResult("❌ " + (data.error || "Failed to save"));
      }
    } catch {
      setResult("❌ Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Account type selector */}
      <div className="flex gap-2">
        <button
          onClick={() => setAccountType("shared")}
          className={`flex-1 rounded-lg border-2 p-3 text-sm transition-all ${
            accountType === "shared"
              ? "border-primary bg-primary/5"
              : "border-muted hover:border-muted-foreground/30"
          }`}
        >
          <span className="font-medium">Shared</span>
          <p className="text-xs text-muted-foreground mt-0.5">
            Platform account, limited storage
          </p>
        </button>
        <button
          onClick={() => setAccountType("own")}
          className={`flex-1 rounded-lg border-2 p-3 text-sm transition-all ${
            accountType === "own"
              ? "border-primary bg-primary/5"
              : "border-muted hover:border-muted-foreground/30"
          }`}
        >
          <span className="font-medium">Own Account</span>
          <p className="text-xs text-muted-foreground mt-0.5">
            Customer's Cloudinary, unlimited
          </p>
        </button>
      </div>

      {/* Credentials form (only for own account) */}
      {accountType === "own" && (
        <div className="space-y-3 p-4 rounded-lg border bg-muted/20">
          <div>
            <Label htmlFor="cloudName">Cloud Name</Label>
            <Input
              id="cloudName"
              value={cloudName}
              onChange={(e) => setCloudName(e.target.value)}
              placeholder="elite-designer-studio"
            />
          </div>
          <div>
            <Label htmlFor="apiKey">API Key</Label>
            <Input
              id="apiKey"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="123456789..."
            />
          </div>
          <div>
            <Label htmlFor="apiSecret">API Secret</Label>
            <Input
              id="apiSecret"
              type="password"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              placeholder="••••••••••••••••"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Get these from{" "}
            <a
              href="https://cloudinary.com/console"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              cloudinary.com/console
            </a>{" "}
            → Settings → API keys
          </p>
        </div>
      )}

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Validating & Saving...
          </>
        ) : (
          "Save Cloudinary Settings"
        )}
      </Button>

      {result && (
        <p className="text-sm text-center text-muted-foreground">{result}</p>
      )}
    </div>
  );
}

/**
 * DatabaseForm — sub-component for the admin to switch between
 * shared and own database (BYODB), same pattern as CloudinaryForm.
 */
function DatabaseForm({ studioId }: { studioId: string }) {
  const [accountType, setAccountType] = useState<"shared" | "own">("shared");
  const [dbUrl, setDbUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState("");

  async function handleSave() {
    setSaving(true);
    setResult("");

    try {
      const res = await fetch(`/api/admin/studios/${studioId}/database`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountType,
          databaseUrl: accountType === "own" ? dbUrl : undefined,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setResult("✅ " + (data.message || "Saved successfully"));
      } else {
        setResult("❌ " + (data.error || "Failed to save"));
      }
    } catch {
      setResult("❌ Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Account type selector */}
      <div className="flex gap-2">
        <button
          onClick={() => setAccountType("shared")}
          className={`flex-1 rounded-lg border-2 p-3 text-sm transition-all ${
            accountType === "shared"
              ? "border-primary bg-primary/5"
              : "border-muted hover:border-muted-foreground/30"
          }`}
        >
          <span className="font-medium">Shared</span>
          <p className="text-xs text-muted-foreground mt-0.5">
            Platform database, limited storage
          </p>
        </button>
        <button
          onClick={() => setAccountType("own")}
          className={`flex-1 rounded-lg border-2 p-3 text-sm transition-all ${
            accountType === "own"
              ? "border-primary bg-primary/5"
              : "border-muted hover:border-muted-foreground/30"
          }`}
        >
          <span className="font-medium">Own Database</span>
          <p className="text-xs text-muted-foreground mt-0.5">
            Any PostgreSQL provider
          </p>
        </button>
      </div>

      {/* Connection form (only for own database) */}
      {accountType === "own" && (
        <div className="space-y-3 p-4 rounded-lg border bg-muted/20">
          <div>
            <Label htmlFor="dbUrl">Database URL</Label>
            <Input
              id="dbUrl"
              type="password"
              value={dbUrl}
              onChange={(e) => setDbUrl(e.target.value)}
              placeholder="postgresql://user:pass@host:5432/dbname"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Works with any PostgreSQL provider: Neon, Supabase, AWS RDS,
              Google Cloud SQL, or your own server.
            </p>
          </div>
        </div>
      )}

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Testing & Saving...
          </>
        ) : (
          "Save Database Settings"
        )}
      </Button>

      {result && (
        <p className="text-sm text-center text-muted-foreground">{result}</p>
      )}
    </div>
  );
}
