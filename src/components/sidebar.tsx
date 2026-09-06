"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  ShoppingBag,
  Shirt,
  Scissors,
  LogOut,
  UserCircle,
  Calendar,
  ClipboardList,
  AlertTriangle,
  Menu,
  X,
  Moon,
  Sun,
  Sparkles,
  MessageSquare,
  Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  role: string;
  userName: string;
}

const roleNavItems: Record<string, { label: string; href: string; icon: React.ReactNode }[]> = {
  ADMIN: [
    { label: "Dashboard",        href: "/dashboard",                icon: <LayoutDashboard className="h-5 w-5" /> },
    { label: "Customers",        href: "/dashboard/customers",      icon: <Users className="h-5 w-5" /> },
    { label: "Consultations",    href: "/dashboard/consultations",  icon: <MessageSquare className="h-5 w-5" /> },
    { label: "Orders",           href: "/dashboard/orders",         icon: <ShoppingBag className="h-5 w-5" /> },
    { label: "Outfits",          href: "/dashboard/outfits",        icon: <Shirt className="h-5 w-5" /> },
    { label: "Appointments",     href: "/dashboard/appointments",   icon: <Calendar className="h-5 w-5" /> },
    { label: "Production",       href: "/dashboard/production",     icon: <Scissors className="h-5 w-5" /> },
    { label: "Stitching & Maggam", href: "/dashboard/stitching-maggam", icon: <Sparkles className="h-5 w-5" /> },
    { label: "Blockers",         href: "/dashboard/blockers",       icon: <AlertTriangle className="h-5 w-5" /> },
    { label: "Employees",        href: "/dashboard/employees",      icon: <Briefcase className="h-5 w-5" /> },
    { label: "Users",            href: "/dashboard/users",          icon: <UserCircle className="h-5 w-5" /> },
  ],
  // Store Manager: same as ADMIN but without the Users page
  STORE_MANAGER: [
    { label: "Dashboard",        href: "/dashboard",                icon: <LayoutDashboard className="h-5 w-5" /> },
    { label: "Customers",        href: "/dashboard/customers",      icon: <Users className="h-5 w-5" /> },
    { label: "Consultations",    href: "/dashboard/consultations",  icon: <MessageSquare className="h-5 w-5" /> },
    { label: "Orders",           href: "/dashboard/orders",         icon: <ShoppingBag className="h-5 w-5" /> },
    { label: "Outfits",          href: "/dashboard/outfits",        icon: <Shirt className="h-5 w-5" /> },
    { label: "Appointments",     href: "/dashboard/appointments",   icon: <Calendar className="h-5 w-5" /> },
    { label: "Production",       href: "/dashboard/production",     icon: <Scissors className="h-5 w-5" /> },
    { label: "Stitching & Maggam", href: "/dashboard/stitching-maggam", icon: <Sparkles className="h-5 w-5" /> },
    { label: "Blockers",         href: "/dashboard/blockers",       icon: <AlertTriangle className="h-5 w-5" /> },
    { label: "Employees",        href: "/dashboard/employees",      icon: <Briefcase className="h-5 w-5" /> },
  ],
  RECEPTION: [
    { label: "Dashboard",        href: "/dashboard",                icon: <LayoutDashboard className="h-5 w-5" /> },
    { label: "Customers",        href: "/dashboard/customers",      icon: <Users className="h-5 w-5" /> },
    { label: "Consultations",    href: "/dashboard/consultations",  icon: <MessageSquare className="h-5 w-5" /> },
    { label: "Orders",           href: "/dashboard/orders",         icon: <ShoppingBag className="h-5 w-5" /> },
    { label: "Outfits",          href: "/dashboard/outfits",        icon: <Shirt className="h-5 w-5" /> },
    { label: "Appointments",     href: "/dashboard/appointments",   icon: <Calendar className="h-5 w-5" /> },
  ],
  DESIGNER: [
    { label: "Dashboard",        href: "/dashboard",                icon: <LayoutDashboard className="h-5 w-5" /> },
    { label: "Consultations",    href: "/dashboard/consultations",  icon: <MessageSquare className="h-5 w-5" /> },
    { label: "Outfits",          href: "/dashboard/outfits",        icon: <Shirt className="h-5 w-5" /> },
    { label: "Production",       href: "/dashboard/production",     icon: <Scissors className="h-5 w-5" /> },
    { label: "Stitching & Maggam", href: "/dashboard/stitching-maggam", icon: <Sparkles className="h-5 w-5" /> },
    { label: "Blockers",         href: "/dashboard/blockers",       icon: <AlertTriangle className="h-5 w-5" /> },
  ],
  MASTER: [
    { label: "Dashboard",          href: "/dashboard",                   icon: <LayoutDashboard className="h-5 w-5" /> },
    { label: "Production",         href: "/dashboard/production",        icon: <Scissors className="h-5 w-5" /> },
    { label: "Stitching & Maggam", href: "/dashboard/stitching-maggam",  icon: <Sparkles className="h-5 w-5" /> },
    { label: "Outfits",         href: "/dashboard/outfits",           icon: <Shirt className="h-5 w-5" /> },
    { label: "Blockers",           href: "/dashboard/blockers",          icon: <AlertTriangle className="h-5 w-5" /> },
  ],
};

export function Sidebar({ role, userName }: SidebarProps) {
  const pathname = usePathname();
  const navItems = roleNavItems[role] || [];
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center border-b bg-card px-3 lg:hidden">
        <Button variant="ghost" size="icon" onClick={() => setOpen(true)} className="shrink-0">
          <Menu className="h-5 w-5" />
        </Button>
        <div className="ml-2 flex items-center gap-2 min-w-0">
          <Scissors className="h-4 w-4 text-primary shrink-0" />
          <span className="font-bold text-sm truncate">urumi by mounika</span>
        </div>
      </div>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/50 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-card transition-transform duration-200 lg:relative lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 items-center justify-between border-b px-4 lg:h-16 lg:px-6">
          <Link href="/dashboard" className="flex items-center gap-2" onClick={() => setOpen(false)}>
            <Scissors className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold">urumi by mounika</span>
          </Link>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                (item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href))
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground"
              )}
            >
              <span className="shrink-0">{item.icon}</span>
              <span className="truncate">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="border-t p-3">
          <div className="flex items-center gap-2 rounded-lg px-3 py-2 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{userName}</p>
              <p className="text-xs text-muted-foreground capitalize">{role.toLowerCase()}</p>
            </div>
          </div>
          <div className="flex gap-1 mt-1">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              className="justify-start gap-2 flex-1 min-w-0"
              onClick={async () => {
                try {
                  await fetch("/api/auth/logout", { method: "POST" });
                } finally {
                  window.location.replace("/login");
                }
              }}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span className="truncate">Logout</span>
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="gap-2"
    >
      <Sun className="h-4 w-4 dark:hidden" />
      <Moon className="hidden h-4 w-4 dark:block" />
    </Button>
  );
}
