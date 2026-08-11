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
    <div className="flex h-screen overflow-hidden">
      <Sidebar role={session.role} userName={session.name} />
      <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">
        <RealtimeProvider>
          <div className="p-4 lg:p-8">{children}</div>
        </RealtimeProvider>
      </main>
    </div>
  );
}
