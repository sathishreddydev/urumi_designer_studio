import { NextResponse } from "next/server";
import { getSession, type SessionUser } from "./auth";
import { hasPermission, type Resource, type Action, type Role } from "./permissions";

// ─── TYPES ──────────────────────────────────────────────────────────────────

interface RouteConfig {
  resource: Resource;
  action: Action;
}

type AuthenticatedHandler = (
  request: Request,
  context: {
    params: Promise<Record<string, string>>;
    session: SessionUser;
  }
) => Promise<Response>;

// ─── API GUARD ──────────────────────────────────────────────────────────────

/**
 * Wraps an API route handler with authentication and permission checks.
 * 
 * Usage:
 *   export const POST = withPermission(
 *     { resource: "customer", action: "create" },
 *     async (request, { session }) => { ... }
 *   );
 */
export function withPermission(
  config: RouteConfig,
  handler: AuthenticatedHandler
) {
  return async (
    request: Request,
    routeContext: { params: Promise<Record<string, string>> }
  ): Promise<Response> => {
    try {
      // 1. Authenticate
      const session = await getSession();
      if (!session) {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 }
        );
      }

      // 2. Check permission
      const permitted = hasPermission(
        session.role as Role,
        config.resource,
        config.action
      );

      if (!permitted) {
        return NextResponse.json(
          { error: "You do not have permission to perform this action" },
          { status: 403 }
        );
      }

      // 3. Execute handler
      return await handler(request, {
        params: routeContext.params,
        session,
      });
    } catch (error: any) {
      if (error.message === "Forbidden") {
        return NextResponse.json(
          { error: "You do not have permission to perform this action" },
          { status: 403 }
        );
      }
      console.error(`API Error [${config.resource}/${config.action}]:`, error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  };
}

/**
 * Simple auth check without resource-level permissions.
 * Use for endpoints where all authenticated users have access.
 */
export function withAuth(handler: AuthenticatedHandler) {
  return async (
    request: Request,
    routeContext: { params: Promise<Record<string, string>> }
  ): Promise<Response> => {
    try {
      const session = await getSession();
      if (!session) {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 }
        );
      }

      return await handler(request, {
        params: routeContext.params,
        session,
      });
    } catch (error: any) {
      console.error("API Error:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  };
}
