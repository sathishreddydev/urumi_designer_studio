// ─── TYPES ──────────────────────────────────────────────────────────────────

export type Role = "ADMIN" | "STORE_MANAGER" | "RECEPTION" | "DESIGNER" | "MASTER" | "CUSTOMER";

export type Resource =
  | "customer"
  | "order"
  | "outfit"
  | "measurement"
  | "reference"
  | "material"
  | "production"
  | "dependency"
  | "payment"
  | "portal"
  | "user";

export type Action =
  | "create"
  | "read"
  | "update"
  | "delete"
  | "upload"
  | "select"
  | "lock"
  | "release"
  | "transition"
  | "view_progress";

export interface PermissionContext {
  userId: string;
  role: Role;
  resourceOwnerId?: string;
  outfitStatus?: string;
  isAssigned?: boolean;
}

// ─── PERMISSION MATRIX ──────────────────────────────────────────────────────

const PERMISSION_MATRIX: Record<Role, Partial<Record<Resource, Action[]>>> = {
  ADMIN: {
    customer: ["create", "read", "update", "delete"],
    order: ["create", "read", "update", "delete"],
    outfit: ["create", "read", "update", "delete"],
    measurement: ["create", "read", "update"],
    reference: ["create", "read", "update", "upload", "select", "lock"],
    material: ["create", "read", "update"],
    production: ["read", "update", "transition", "view_progress"],
    dependency: ["create", "read", "update"],
    payment: ["create", "read", "delete"],   // ADMIN can void payments
    portal: ["create", "read"],
    user: ["create", "read", "update", "delete"],
  },
  // Store Manager has identical capabilities to ADMIN except user management
  STORE_MANAGER: {
    customer: ["create", "read", "update", "delete"],
    order: ["create", "read", "update", "delete"],
    outfit: ["create", "read", "update", "delete"],
    measurement: ["create", "read", "update"],
    reference: ["create", "read", "update", "upload", "select", "lock"],
    material: ["create", "read", "update"],
    production: ["read", "update", "transition", "view_progress"],
    dependency: ["create", "read", "update"],
    payment: ["create", "read", "delete"],
    portal: ["create", "read"],
    user: [],  // no access to user management
  },
  RECEPTION: {
    customer: ["create", "read", "update"],
    order: ["create", "read", "update"],
    outfit: ["create", "read"],
    measurement: ["read"],
    reference: ["read"],
    material: [],
    production: ["read", "view_progress"],
    dependency: [],
    payment: ["create", "read"],             // RECEPTION can record but not void
    portal: ["create", "read"],
    user: [],
  },
  DESIGNER: {
    customer: ["read"],
    order: ["read"],
    outfit: ["create", "read", "update"],
    measurement: ["create", "read", "update"],
    reference: ["create", "read", "update", "upload", "select", "lock"],
    material: ["create", "read", "update"],
    production: ["read", "release", "view_progress"],
    dependency: ["create", "read", "update"],
    payment: [],
    portal: [],
    user: [],
  },
  MASTER: {
    customer: [],
    order: [],
    outfit: ["read", "update"],
    measurement: ["read"],
    reference: ["read"],
    material: [],
    production: ["read", "update", "transition"],
    dependency: ["create", "read", "update"],
    payment: [],
    portal: [],
    user: [],
  },
  CUSTOMER: {
    customer: [],
    order: ["read"],
    outfit: ["read"],
    measurement: [],
    reference: ["read", "upload"],
    material: [],
    production: ["view_progress"],
    dependency: [],
    payment: ["read"],
    portal: ["read"],
    user: [],
  },
};

// ─── PERMISSION CHECK ───────────────────────────────────────────────────────

export function hasPermission(
  role: Role,
  resource: Resource,
  action: Action,
  context?: PermissionContext
): boolean {
  // ADMIN and STORE_MANAGER have full access (STORE_MANAGER limited to non-user resources)
  if (role === "ADMIN") return true;

  const allowedActions = PERMISSION_MATRIX[role]?.[resource] ?? [];
  if (!allowedActions.includes(action)) return false;

  // Master contextual constraint: only assigned outfits
  if (role === "MASTER" && (resource === "outfit" || resource === "production")) {
    if (context && context.isAssigned === false) return false;
  }

  return true;
}

export function requirePermission(
  role: Role,
  resource: Resource,
  action: Action,
  context?: PermissionContext
): void {
  if (!hasPermission(role, resource, action, context)) {
    throw new Error("Forbidden");
  }
}

export function getPermittedActions(role: Role, resource: Resource): Action[] {
  if (role === "ADMIN") {
    return ["create", "read", "update", "delete", "upload", "select", "lock", "release", "transition", "view_progress"];
  }
  if (role === "STORE_MANAGER") {
    return (PERMISSION_MATRIX.STORE_MANAGER[resource] ?? []) as Action[];
  }
  return (PERMISSION_MATRIX[role]?.[resource] ?? []) as Action[];
}
