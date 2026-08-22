"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LogOut, MonitorSmartphone, Plus, UserCircle } from "lucide-react";
import Link from "next/link";
import { usePermissions } from "@/hooks/use-permissions";

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-red-100 text-red-700",
  RECEPTION: "bg-blue-100 text-blue-700",
  DESIGNER: "bg-purple-100 text-purple-700",
  MASTER: "bg-green-100 text-green-700",
};

export default function UsersPage() {
  const queryClient = useQueryClient();
  const { session } = usePermissions();
  const currentUserId = session?.id;

  const { data: users, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-xs text-muted-foreground">Manage team members and roles</p>
        </div>
        <Link href="/dashboard/users/new">
          <Button className="w-full sm:w-auto">
            <Plus className="h-4 w-4" /> Add User
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse"><CardContent className="h-16 pt-6" /></Card>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {users?.map((user: any) => (
            <UserCard key={user.id} user={user} currentUserId={currentUserId} toggleMutation={toggleMutation} />
          ))}
        </div>
      )}
    </div>
  );
}

function UserCard({
  user,
  currentUserId,
  toggleMutation,
}: {
  user: any;
  currentUserId: string | undefined;
  toggleMutation: { mutate: (variables: { id: string; active: boolean }) => void };
}) {
  const queryClient = useQueryClient();
  const [pendingSessionId, setPendingSessionId] = React.useState<string | null | undefined>(undefined);
  const { data: sessions = [] } = useQuery({
    queryKey: ["user-sessions", user.id],
    queryFn: async () => {
      const res = await fetch(`/api/users/${user.id}/sessions`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  async function revoke() {
    const sessionId = pendingSessionId;
    const response = await fetch(`/api/users/${user.id}/sessions`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sessionId ? { sessionId } : {}),
    });
    if (!response.ok && response.status !== 401) {
      throw new Error("Failed to sign out device");
    }
    // SSE will handle redirecting the revoked device(s) to /login automatically.
    // Just refresh the sessions list.
    queryClient.invalidateQueries({ queryKey: ["user-sessions", user.id] });
    setPendingSessionId(undefined);
  }

  return (
    <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <UserCircle className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">{user.name}</p>
                      <Badge className={ROLE_COLORS[user.role]}>{user.role}</Badge>
                    </div>
                    <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                    {user.phone && <p className="text-xs text-muted-foreground">{user.phone}</p>}
                  </div>
                </div>
                {user.role !== "ADMIN" && (
                  <div className="flex items-center justify-between mt-3 pt-3 border-t ml-[52px]">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={user.active}
                        onCheckedChange={(checked: boolean) =>
                          toggleMutation.mutate({ id: user.id, active: checked })
                        }
                      />
                      <span className="text-xs text-muted-foreground">
                        {user.active ? "Active" : "Disabled"}
                      </span>
                    </div>
                    <Link href={`/dashboard/users/${user.id}/edit`}>
                      <Button variant="ghost" size="sm">Edit</Button>
                    </Link>
                  </div>
                )}
                <div className="ml-[52px] mt-3 border-t pt-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                        <MonitorSmartphone className="h-4 w-4 shrink-0" />
                        <span>{sessions.length} active device{sessions.length === 1 ? "" : "s"}</span>
                      </div>
                      {sessions.length > 0 && (
                        <Button variant="outline" size="sm" onClick={() => setPendingSessionId(null)}>
                          <LogOut className="h-4 w-4" /> Sign out all
                        </Button>
                      )}
                    </div>
                    {sessions.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {sessions.map((session: any) => (
                          <div key={session.id} className="flex items-center justify-between gap-2 text-xs">
                            <span className="truncate">{session.deviceName} - {new Date(session.lastActiveAt).toLocaleString()}</span>
                            <Button variant="ghost" size="sm" className="h-7 shrink-0 px-2" onClick={() => setPendingSessionId(session.id)}>
                              Sign out
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                </div>
                  <AlertDialog open={pendingSessionId !== undefined} onOpenChange={(open) => !open && setPendingSessionId(undefined)}>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Sign out device{pendingSessionId === null ? "s" : ""}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {pendingSessionId === null
                            ? `This will sign ${user.name} out of all active devices.`
                            : "This device will need to sign in again."}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={revoke}>Sign out</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
              </CardContent>
    </Card>
  );
}
