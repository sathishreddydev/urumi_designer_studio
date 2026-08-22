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
    <div className="flex h-screen overflow-hidden" style={{ height: '100dvh' }}>
      <Sidebar role={session.role} userName={session.name} />
      <main className="flex-1 overflow-y-auto overflow-x-hidden font-sans text-sm leading-5 pt-14 lg:pt-0">
        <RealtimeProvider>
          <div className="p-3 sm:p-4 lg:p-6 xl:p-8 max-w-full">{children}</div>
        </RealtimeProvider>
      </main>
    </div>
  );
}
