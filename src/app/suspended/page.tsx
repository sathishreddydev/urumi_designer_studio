/**
 * Suspended Page
 *
 * Shown when middleware detects studio.status === 'suspended' or 'cancelled'.
 * This is a public page — no auth required.
 */

import { getStudio } from "@/lib/multi-tenant/studio";
import { StudioProvider } from "@/contexts/studio-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock } from "lucide-react";

export default async function SuspendedPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const studio = await getStudio();
  const params = await searchParams;
  const reason = params.reason;

  const title =
    reason === "cancelled"
      ? "Account Closed"
      : "Account Suspended";

  const message =
    reason === "cancelled"
      ? `Your subscription has ended. To reactivate, please contact support.`
      : `Your account is temporarily suspended. This usually happens when a payment is overdue. Please contact support to restore access.`;

  return (
    <StudioProvider studio={studio}>
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <Lock className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-2xl">{title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">{message}</p>

            {studio.businessEmail && (
              <a
                href={`mailto:${studio.businessEmail}`}
                className="text-sm font-medium text-primary hover:underline"
              >
                {studio.businessEmail}
              </a>
            )}

            {studio.businessPhone && (
              <p className="text-sm text-muted-foreground">
                {studio.businessPhone}
              </p>
            )}

            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground">{studio.brandName}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </StudioProvider>
  );
}
