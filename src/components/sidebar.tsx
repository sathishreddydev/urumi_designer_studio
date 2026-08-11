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
  Settings,
  LogOut,
  UserCircle,
  Calendar,
  ClipboardList,
  AlertTriangle,
  BarChart3,
  Menu,
  X,
  Moon,
  Sun,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  role: string;
  userName: string;
}

const roleNavItems: Record<string, { label: string; href: string; icon: React.ReactNode }[]> = {
  ADMIN: [
    { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard className="h-5 w-5" /> },
    { label: "Customers", href: "/dashboard/customers", icon: <Users className="h-5 w-5" /> },
    { label: "Orders", href: "/dashboard/orders", icon: <ShoppingBag className="h-5 w-5" /> },
    { label: "Outfits", href: "/dashboard/outfits", icon: <Shirt className="h-5 w-5" /> },
    { label: "Production", href: "/dashboard/production", icon: <Scissors className="h-5 w-5" /> },
    { label: "Blockers", href: "/dashboard/blockers", icon: <AlertTriangle className="h-5 w-5" /> },
    { label: "Reports", href: "/dashboard/reports", icon: <BarChart3 className="h-5 w-5" /> },
    { label: "Users", href: "/dashboard/users", icon: <UserCircle className="h-5 w-5" /> },
    { label: "Settings", href: "/dashboard/settings", icon: <Settings className="h-5 w-5" /> },
  ],
  RECEPTION: [
    { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard className="h-5 w-5" /> },
    { label: "Customers", href: "/dashboard/customers", icon: <Users className="h-5 w-5" /> },
    { label: "Orders", href: "/dashboard/orders", icon: <ShoppingBag className="h-5 w-5" /> },
    { label: "Outfits", href: "/dashboard/outfits", icon: <Shirt className="h-5 w-5" /> },
    { label: "Appointments", href: "/dashboard/appointments", icon: <Calendar className="h-5 w-5" /> },
  ],
  DESIGNER: [
    { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard className="h-5 w-5" /> },
    { label: "Outfits", href: "/dashboard/outfits", icon: <Shirt className="h-5 w-5" /> },
    { label: "Production", href: "/dashboard/production", icon: <Scissors className="h-5 w-5" /> },
    { label: "Blockers", href: "/dashboard/blockers", icon: <AlertTriangle className="h-5 w-5" /> },
  ],
  MASTER: [
    { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard className="h-5 w-5" /> },
    { label: "Production", href: "/dashboard/production", icon: <Scissors className="h-5 w-5" /> },
    { label: "Blockers", href: "/dashboard/blockers", icon: <AlertTriangle className="h-5 w-5" /> },
  ],
};

export function Sidebar({ role, userName }: SidebarProps) {
  const pathname = usePathname();
  const navItems = roleNavItems[role] || [];
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center border-b bg-card px-4 lg:hidden">
        <Button variant="ghost" size="icon" onClick={() => setOpen(true)}>
          <Menu className="h-5 w-5" />
        </Button>
        <div className="ml-3 flex items-center gap-2">
          <Scissors className="h-5 w-5 text-primary" />
          <span className="font-bold">Designer Studio</span>
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
            <span className="text-lg font-bold">Designer Studio</span>
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
                pathname === item.href
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground"
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="border-t p-3">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2">
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
            <form action="/api/auth/logout" method="POST" className="flex-1">
              <Button variant="ghost" size="sm" className="w-full justify-start gap-2" type="submit">
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </form>
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
