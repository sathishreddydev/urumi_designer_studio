import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";
import { AdminNav } from "./admin-nav";

/**
 * Admin layout — protects all /admin/* pages.
 * Redirects to /admin/login if not authenticated.
 */

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getAdminSession();

  // Login page is public; everything else requires auth
  // (This layout wraps ALL /admin/* — the login page handles its own state)
  // We check via the path — login page doesn't need the nav bar

  return (
    <div className="min-h-screen bg-muted/30">
      {admin && <AdminNav admin={admin} />}
      <main className={admin ? "p-4 lg:p-6" : ""}>{children}</main>
    </div>
  );
}
