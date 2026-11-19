import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function InactiveStudioPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <Card className="w-full max-w-lg text-center">
        <CardHeader>
          <CardTitle className="text-2xl">This domain is inactive</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Please contact the team for assistance.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
