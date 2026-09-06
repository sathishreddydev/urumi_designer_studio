"use client";

import { useQuery } from "@tanstack/react-query";
import { hasPermission, type Role, type Resource, type Action } from "@/lib/permissions";

interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export function usePermissions() {
  const { data: session } = useQuery<SessionUser>({
    queryKey: ["session"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me");
      if (!res.ok) throw new Error("Not authenticated");
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
  });

  const role = session?.role || "CUSTOMER";

  function can(action: Action, resource: Resource): boolean {
    return hasPermission(role, resource, action);
  }

  return {
    can,
    role,
    session,
    isAdmin: role === "ADMIN",
    isStoreManager: role === "STORE_MANAGER",
    isAdminOrStoreManager: role === "ADMIN" || role === "STORE_MANAGER",
    isDesigner: role === "DESIGNER",
    isMaster: role === "MASTER",
    isReception: role === "RECEPTION",
    isLoading: !session,
  };
}
