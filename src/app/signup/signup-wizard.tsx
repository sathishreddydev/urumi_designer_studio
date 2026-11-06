"use client";

/**
 * Multi-step studio registration wizard.
 *
 * Step 1: Business info (name, owner, email, phone)
 * Step 2: Domain (just a plain text input — any domain)
 * Step 3: Admin account (name, email, password)
 * Step 4: Plan selection (trial / basic / premium)
 */

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
  Scissors,
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  Sparkles,
} from "lucide-react";

interface FormData {
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  domain: string;        // full domain: e.g. designer.elitestudio.com
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  planType: "trial" | "basic" | "premium";
}

const PLANS = [
  {
    id: "trial" as const,
    name: "Trial",
    price: "Free",
    period: "14 days",
    features: ["10 customers", "20 orders", "1GB storage", "No credit card"],
    highlight: false,
  },
  {
    id: "basic" as const,
    name: "Basic",
    price: "$99",
    period: "/month",
    features: ["200 customers", "500 orders", "5GB storage", "Email support"],
    highlight: false,
  },
  {
    id: "premium" as const,
    name: "Premium",
    price: "$199",
    period: "/month",
    features: [
      "Unlimited customers",
      "Unlimited orders",
      "50GB storage",
      "Custom branding",
      "Priority support",
    ],
    highlight: true,
  },
];

export function SignupWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState<FormData>({
    businessName: "",
    ownerName: "",
    email: "",
    phone: "",
    domain: "",
    adminName: "",
    adminEmail: "",
    adminPassword: "",
    planType: "trial",
  });

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/public/studios/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          // Pass as desiredDomain so the register API can use it directly as full domain
          desiredDomain: formData.domain,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registration failed");
        return;
      }

      router.push(data.setupUrl);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Validation ──────────────────────────────────────────────────────────────
  function canProceed(): boolean {
    switch (step) {
      case 1:
        return (
          formData.businessName.length >= 2 &&
          formData.ownerName.length >= 2 &&
          formData.email.includes("@")
        );
      case 2:
        return formData.domain.length >= 3;
      case 3:
        return (
          formData.adminName.length >= 2 &&
          formData.adminEmail.includes("@") &&
          formData.adminPassword.length >= 8
        );
      case 4:
        return !!formData.planType;
      default:
        return false;
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <Card className="w-full max-w-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Scissors className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Start Your Designer Studio</CardTitle>
          <CardDescription>
            Step {step} of 4 — {stepTitle(step)}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* Progress bar */}
          <div className="flex gap-2 mb-8">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`h-2 flex-1 rounded-full transition-colors ${
                  s <= step ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>

          {/* ── Step 1: Business Info ── */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="businessName">Business Name *</Label>
                <Input
                  id="businessName"
                  placeholder="Elite Designer Studio"
                  value={formData.businessName}
                  onChange={(e) =>
                    setFormData({ ...formData, businessName: e.target.value })
                  }
                />
              </div>

              <div>
                <Label htmlFor="ownerName">Owner Name *</Label>
                <Input
                  id="ownerName"
                  placeholder="John Smith"
                  value={formData.ownerName}
                  onChange={(e) =>
                    setFormData({ ...formData, ownerName: e.target.value })
                  }
                />
              </div>

              <div>
                <Label htmlFor="email">Business Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="contact@elitestudio.com"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                />
              </div>

              <div>
                <Label htmlFor="phone">Phone (optional)</Label>
                <Input
                  id="phone"
                  placeholder="+91 98765 43210"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                />
              </div>

              <Button
                onClick={() => setStep(2)}
                disabled={!canProceed()}
                className="w-full"
              >
                Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}

          {/* ── Step 2: Domain ── */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="domain">Your Domain *</Label>
                <Input
                  id="domain"
                  placeholder="designer.elitestudio.com"
                  value={formData.domain}
                  onChange={(e) =>
                    setFormData({ ...formData, domain: e.target.value.toLowerCase().trim() })
                  }
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  Enter the domain where your studio will be accessed.
                  Point it to our server after registration.
                </p>
              </div>

              <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Examples:</p>
                <p>• <span className="font-mono">designer.elitestudio.com</span></p>
                <p>• <span className="font-mono">studio.mounika.in</span></p>
                <p>• <span className="font-mono">app.royalboutique.com</span></p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)} className="px-4">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  disabled={!canProceed()}
                  className="flex-1"
                >
                  Continue
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* ── Step 3: Admin Account ── */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Create your admin account to manage the studio.
              </p>

              <div>
                <Label htmlFor="adminName">Admin Name *</Label>
                <Input
                  id="adminName"
                  placeholder="John Smith"
                  value={formData.adminName}
                  onChange={(e) =>
                    setFormData({ ...formData, adminName: e.target.value })
                  }
                />
              </div>

              <div>
                <Label htmlFor="adminEmail">Admin Email *</Label>
                <Input
                  id="adminEmail"
                  type="email"
                  placeholder="admin@elitestudio.com"
                  value={formData.adminEmail}
                  onChange={(e) =>
                    setFormData({ ...formData, adminEmail: e.target.value })
                  }
                />
              </div>

              <div>
                <Label htmlFor="adminPassword">Password *</Label>
                <Input
                  id="adminPassword"
                  type="password"
                  placeholder="••••••••"
                  value={formData.adminPassword}
                  onChange={(e) =>
                    setFormData({ ...formData, adminPassword: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Minimum 8 characters
                </p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)} className="px-4">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Button
                  onClick={() => setStep(4)}
                  disabled={!canProceed()}
                  className="flex-1"
                >
                  Continue
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* ── Step 4: Plan ── */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="grid md:grid-cols-3 gap-3">
                {PLANS.map((plan) => (
                  <div
                    key={plan.id}
                    onClick={() => setFormData({ ...formData, planType: plan.id })}
                    className={`cursor-pointer rounded-xl border-2 p-4 transition-all ${
                      formData.planType === plan.id
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-muted-foreground/30"
                    } ${plan.highlight ? "ring-1 ring-primary/30" : ""}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold">{plan.name}</span>
                      {plan.highlight && (
                        <Sparkles className="h-3 w-3 text-primary" />
                      )}
                    </div>
                    <div className="mb-3">
                      <span className="text-2xl font-bold">{plan.price}</span>
                      <span className="text-sm text-muted-foreground"> {plan.period}</span>
                    </div>
                    <ul className="space-y-1.5">
                      {plan.features.map((f) => (
                        <li key={f} className="text-xs text-muted-foreground flex items-start gap-1.5">
                          <Check className="h-3 w-3 mt-0.5 shrink-0 text-green-600" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {error && (
                <p className="text-sm text-destructive text-center">{error}</p>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(3)} className="px-4">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!canProceed() || loading}
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating your studio...
                    </>
                  ) : (
                    "Complete Registration"
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function stepTitle(step: number): string {
  switch (step) {
    case 1: return "Business Information";
    case 2: return "Domain Setup";
    case 3: return "Admin Account";
    case 4: return "Choose Your Plan";
    default: return "";
  }
}
