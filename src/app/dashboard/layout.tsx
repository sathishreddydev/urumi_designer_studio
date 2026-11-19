import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { RealtimeProvider } from "@/components/realtime-provider";
import { runWithTenantHost, TenantResolutionError } from "@/lib/tenant-registry/runtime";
import { getTenantContext } from "@/lib/tenant-registry/context";
// import { BlockersBanner } from "@/components/blockers-banner";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const host = (await headers()).get("host");
  try {
    return await runWithTenantHost(host, async () => {
      const session = await getSession();
      if (!session) {
        redirect("/login");
      }
      const tenant = getTenantContext();

      return (
        <div className="flex h-screen overflow-hidden" style={{ height: '100dvh' }}>
          <Sidebar
            role={session.role}
            userName={session.name}
            studioName={tenant.name}
            logoUrl={tenant.logoUrl}
          />
          <main className="flex-1 overflow-y-auto overflow-x-hidden font-sans text-sm leading-5 pt-14 lg:pt-0">
            <RealtimeProvider>
              <div className="p-3 sm:p-4 lg:p-6 xl:p-8 max-w-full space-y-3">
                {/* <BlockersBanner /> */}
                {children}
              </div>
            </RealtimeProvider>
          </main>
        </div>
      );
    });
  } catch (error) {
    if (error instanceof TenantResolutionError && error.status === 404) {
      notFound();
    }
    throw error;
  }
}
