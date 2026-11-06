"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2,
  Copy,
  Loader2,
  Globe,
  Palette,
  CreditCard,
  ArrowRight,
} from "lucide-react";

interface StudioInfo {
  id: string;
  domain: string;
  brandName: string;
  businessEmail: string | null;
  dnsVerified: boolean;
  planType: string;
  status: string;
}

interface DnsInfo {
  proxyHost: string;
  verificationToken: string;
}

export function SetupWizard({
  studio,
  dns,
}: {
  studio: StudioInfo;
  dns: DnsInfo;
}) {
  const router = useRouter();
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<string>("");

  // Branding state
  const [brandName, setBrandName] = useState(studio.brandName);
  const [primaryColor, setPrimaryColor] = useState("#000000");
  const [savingBranding, setSavingBranding] = useState(false);

  async function handleVerifyDns() {
    setVerifying(true);
    setVerifyResult("");

    try {
      const res = await fetch("/api/public/studios/verify-dns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studioId: studio.id }),
      });

      const data = await res.json();

      if (data.verified) {
        setVerifyResult("✅ DNS verified! Your domain is ready.");
        router.refresh();
      } else {
        setVerifyResult(
          data.message ||
            "DNS records not found yet. Please allow 5-10 minutes after adding them."
        );
      }
    } catch {
      setVerifyResult("Verification failed. Please try again.");
    } finally {
      setVerifying(false);
    }
  }

  async function handleSaveBranding() {
    setSavingBranding(true);
    try {
      // Upload branding to admin API (Step 4 will add this)
      await fetch(`/api/public/studios/branding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studioId: studio.id,
          brandName,
          primaryColor,
        }),
      });
      setVerifyResult("✅ Branding saved!");
    } catch {
      setVerifyResult("Failed to save branding");
    } finally {
      setSavingBranding(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center pt-8">
          <h1 className="text-3xl font-bold">Welcome, {studio.brandName}! 🎉</h1>
          <p className="text-muted-foreground mt-2">
            Your studio is being set up. Follow these steps to get started.
          </p>
        </div>

        {/* Step 1: DNS Setup */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Globe className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Step 1: Configure Your Domain</CardTitle>
                <CardDescription>
                  Add these DNS records at your domain registrar
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {studio.dnsVerified ? (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 p-4 border border-green-200">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="text-sm font-medium text-green-800">
                  DNS verified! Your domain is active.
                </span>
              </div>
            ) : (
              <>
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="text-sm font-medium">DNS Records to Add:</div>

                  {/* CNAME record */}
                  <div className="grid grid-cols-[80px_1fr_auto] gap-2 items-center text-sm">
                    <span className="text-muted-foreground">CNAME</span>
                    <code className="rounded bg-muted px-2 py-1 text-xs">
                      designer → {dns.proxyHost}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        copyToClipboard(`designer ${dns.proxyHost}`)
                      }
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* TXT record */}
                  <div className="grid grid-cols-[80px_1fr_auto] gap-2 items-center text-sm">
                    <span className="text-muted-foreground">TXT</span>
                    <code className="rounded bg-muted px-2 py-1 text-xs break-all">
                      _studio-verify → {dns.verificationToken}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        copyToClipboard(dns.verificationToken)
                      }
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg bg-blue-50 p-3 border border-blue-200">
                  <p className="text-xs text-blue-900">
                    💡 Log into your domain provider (GoDaddy, Namecheap, etc.),
                    find DNS settings, and add the records above.
                  </p>
                </div>

                <Button
                  onClick={handleVerifyDns}
                  disabled={verifying}
                  className="w-full"
                >
                  {verifying ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    "I've Added DNS Records — Verify Now"
                  )}
                </Button>

                {verifyResult && (
                  <p className="text-sm text-center text-muted-foreground">
                    {verifyResult}
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Branding */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Palette className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Step 2: Customize Your Branding</CardTitle>
                <CardDescription>
                  Set your studio name and colors
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="brandName">Studio Name</Label>
              <Input
                id="brandName"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="Elite Designer Studio"
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

            <Button
              onClick={handleSaveBranding}
              disabled={savingBranding}
              variant="outline"
              className="w-full"
            >
              {savingBranding ? "Saving..." : "Save Branding"}
            </Button>
          </CardContent>
        </Card>

        {/* Step 3: Payment (if paid plan) */}
        {studio.planType !== "trial" && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <CreditCard className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Step 3: Setup Payment</CardTitle>
                  <CardDescription>
                    Add your payment method to activate your subscription
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">
                Connect Payment Method (Coming Soon)
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Access Studio */}
        <div className="pt-4 pb-8">
          <Button
            size="lg"
            className="w-full"
            onClick={() =>
              router.push(`https://${studio.domain}/login`)
            }
            disabled={!studio.dnsVerified}
          >
            Access Your Studio
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
          {!studio.dnsVerified && (
            <p className="text-xs text-center text-muted-foreground mt-2">
              Complete Step 1 (DNS verification) to access your studio
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
