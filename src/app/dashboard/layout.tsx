import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { RealtimeProvider } from "@/components/realtime-provider";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar — sticky, stays in view while page scrolls */}
      <Sidebar role={session.role} userName={session.name} />

      {/* Main content — grows naturally, single document scroll */}
      <main className="flex-1 min-w-0 font-sans text-sm leading-5">
        <RealtimeProvider>
          <div className="p-3 sm:p-4 lg:p-6 xl:p-8 max-w-full space-y-3 pb-10">
            {children}
          </div>
        </RealtimeProvider>
      </main>
    </div>
  );
}
