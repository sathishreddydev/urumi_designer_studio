
"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { fetchAllEmployees } from "./utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  DollarSign,
  Plus,
  Trash2,
  TrendingDown
} from "lucide-react";
import Link from "next/link";
import React, { useMemo, useState } from "react";

// ─── Advances Tab ─────────────────────────────────────────────────────────────

export function AdvancesTab() {
  const queryClient = useQueryClient();
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);

  // Fetch all employees
  const { data: empData, isLoading: employeesLoading, isError: employeesError, refetch: refetchEmployees } = useQuery({
    queryKey: ["employees", ""],
    queryFn: fetchAllEmployees,
  });
  const allEmployees: any[] = empData?.employees ?? [];
  const employees = allEmployees.filter((employee: any) => employee.active);

  // Fetch all advances for all employees
  const { data: allAdvances = [], isLoading: advancesLoading, isError: advancesError, refetch: refetchAdvances } = useQuery({
    queryKey: ["all-advances"],
    queryFn: async () => {
      const response = await fetch("/api/employees/advances");
      if (!response.ok) throw new Error("Could not load advances");
      return response.json();
    },
  });

  // Group by employee
  const advancesByEmployee = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const adv of allAdvances) {
      if (!map.has(adv.employeeId)) map.set(adv.employeeId, []);
      map.get(adv.employeeId)!.push(adv);
    }
    return map;
  }, [allAdvances]);

  // Calculate stats per employee
  const employeeStats = useMemo(() => {
    return allEmployees.map((emp: any) => {
      const advances = advancesByEmployee.get(emp.id) ?? [];
      const outstanding = advances
        .filter((a) => a.status !== "RECOVERED")
        .reduce((sum, a) => sum + Math.max(Number(a.amount) - Number(a.recoveredAmount), 0), 0);
      const totalIssued = advances.reduce((sum, a) => sum + Number(a.amount), 0);
      const totalRecovered = advances.reduce(
        (sum, advance) => sum + Math.min(Number(advance.amount), Number(advance.recoveredAmount)),
        0
      );

      return {
        employee: emp,
        advances,
        outstanding,
        totalIssued,
        totalRecovered,
      };
    });
  }, [allEmployees, advancesByEmployee]);

  // Filter: show employees with advances or selected employee
  const filteredStats = employeeStats.filter(
    (stat) => stat.advances.length > 0 || (selectedEmployee && stat.employee.id === selectedEmployee)
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {filteredStats.filter((s) => s.outstanding > 0).length} employees with outstanding advances
          </p>
        </div>
        <Button size="sm" onClick={() => setIssueDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Issue Advance
        </Button>
      </div>

      {/* Summary Cards */}
      {employeesLoading || advancesLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-24 pt-4" />
            </Card>
          ))}
        </div>
      ) : employeesError || advancesError ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center text-sm text-destructive" role="alert">
            Could not load employee or advance data. Please try again.
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (employeesError) refetchEmployees();
                if (advancesError) refetchAdvances();
              }}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : filteredStats.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No advances issued yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredStats.map((stat) => {
            const { employee: emp, advances, outstanding, totalIssued, totalRecovered } = stat;
            return (
              <EmployeeAdvanceAccordion
                key={emp.id}
                emp={emp}
                advances={advances}
                outstanding={outstanding}
                totalIssued={totalIssued}
                totalRecovered={totalRecovered}
              />
            );
          })}
        </div>
      )}

      {/* Issue Advance Dialog */}
      <IssueAdvanceDialog
        open={issueDialogOpen}
        onOpenChange={setIssueDialogOpen}
        employees={employees}
        selectedEmployeeId={selectedEmployee}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["all-advances"] });
          setIssueDialogOpen(false);
        }}
      />
    </div>
  );
}

// ─── Employee Advance Accordion ──────────────────────────────────────────────

function EmployeeAdvanceAccordion({
  emp,
  advances,
  outstanding,
  totalIssued,
  totalRecovered,
}: {
  emp: any;
  advances: any[];
  outstanding: number;
  totalIssued: number;
  totalRecovered: number;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [advanceToDelete, setAdvanceToDelete] = useState<{
    id: string;
    amount: number;
  } | null>(null);
  const deleteMutation = useMutation({
    mutationFn: async ({ advanceId, employeeId }: { advanceId: string; employeeId: string }) => {
      const response = await fetch(`/api/employees/${employeeId}/advances`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ advanceId }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(typeof result.error === "string" ? result.error : "Failed to delete advance");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-advances"] });
      queryClient.invalidateQueries({ queryKey: ["advances", emp.id] });
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
    },
  });

  return (
    <Card className={outstanding > 0 ? "border-orange-200" : "opacity-70"}>
      {/* Accordion header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-100">
            <DollarSign className="h-4 w-4 text-orange-600" />
          </div>
          <div>
            <p className="font-semibold text-sm leading-tight">{emp.name}</p>
            <p className="text-xs text-muted-foreground">{emp.jobRole}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {outstanding > 0 ? (
            <div className="text-right">
              <p className="text-sm font-bold text-orange-600">
                ₹{outstanding.toLocaleString("en-IN")}
              </p>
              <p className="text-[10px] text-muted-foreground">outstanding</p>
            </div>
          ) : (
            <Badge className="bg-green-100 text-green-700 text-xs">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Recovered
            </Badge>
          )}
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {/* Accordion body */}
      {open && (
        <CardContent className="pt-0 pb-4 space-y-3 border-t">
          {/* Stats row */}
          <div className="flex gap-4 text-xs text-muted-foreground pt-3">
            <span>Issued: ₹{totalIssued.toLocaleString("en-IN")}</span>
            <span>Recovered: ₹{totalRecovered.toLocaleString("en-IN")}</span>
            <span>{advances.length} advance{advances.length !== 1 ? "s" : ""}</span>
            <Link
              href={`/dashboard/employees/${emp.id}`}
              className="ml-auto text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              View profile →
            </Link>
          </div>

          {/* Advances list */}
          <div className="space-y-2">
            {advances.map((adv) => {
              const remaining = Number(adv.amount) - Number(adv.recoveredAmount);
              const recoveredAmount = Number(adv.recoveredAmount ?? 0);
              const isRecovered = adv.status === "RECOVERED";
              const canDelete = Number.isFinite(recoveredAmount) && recoveredAmount <= 0;

              return (
                <div
                  key={adv.id}
                  className={`flex items-center justify-between rounded-md border px-3 py-2 text-xs ${
                    isRecovered ? "bg-muted/30 opacity-60" : "bg-background"
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        ₹{Number(adv.amount).toLocaleString("en-IN")}
                      </span>
                      {adv.status === "OUTSTANDING" && (
                        <Badge variant="outline" className="text-orange-600 border-orange-300">
                          Outstanding
                        </Badge>
                      )}
                      {adv.status === "PARTIALLY_RECOVERED" && (
                        <Badge variant="outline" className="text-yellow-600 border-yellow-300">
                          Partial
                        </Badge>
                      )}
                      {adv.status === "RECOVERED" && (
                        <Badge className="bg-green-100 text-green-700">Recovered</Badge>
                      )}
                    </div>
                    {adv.reason && (
                      <p className="text-muted-foreground mt-0.5">{adv.reason}</p>
                    )}
                    <p className="text-muted-foreground mt-0.5">
                      Issued {new Date(adv.issuedAt).toLocaleDateString("en-IN", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                    {!isRecovered && (
                      <>
                        <p className="font-medium text-orange-600">
                          ₹{remaining.toLocaleString("en-IN")}
                        </p>
                        <p className="text-muted-foreground">remaining</p>
                      </>
                    )}
                    {Number(adv.recoveredAmount) > 0 && (
                      <p className="text-green-600 text-[10px]">
                        <TrendingDown className="h-3 w-3 inline mr-0.5" />
                        ₹{Math.min(Number(adv.amount), Number(adv.recoveredAmount)).toLocaleString("en-IN")} recovered
                      </p>
                    )}
                    </div>
                    {canDelete && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 shrink-0 gap-1 border-destructive/40 px-2 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        aria-label={`Delete advance of ₹${Number(adv.amount).toLocaleString("en-IN")}`}
                        title="Delete unrecovered advance"
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          deleteMutation.reset();
                          setAdvanceToDelete({ id: adv.id, amount: Number(adv.amount) });
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>Delete</span>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {deleteMutation.isError && (
            <p className="text-xs text-destructive" role="alert">{deleteMutation.error.message}</p>
          )}
        </CardContent>
      )}
      <AlertDialog
        open={advanceToDelete !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen && !deleteMutation.isPending) setAdvanceToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete advance?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete the ₹{advanceToDelete?.amount.toLocaleString("en-IN")} advance for {emp.name}? This action cannot be undone.
            </AlertDialogDescription>
            {deleteMutation.isError && (
              <p className="text-sm text-destructive" role="alert">{deleteMutation.error.message}</p>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (!advanceToDelete || deleteMutation.isPending) return;
                deleteMutation.mutate(
                  { advanceId: advanceToDelete.id, employeeId: emp.id },
                  { onSuccess: () => setAdvanceToDelete(null) }
                );
              }}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete advance"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ─── Issue Advance Dialog ─────────────────────────────────────────────────────

interface IssueAdvanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: any[];
  selectedEmployeeId?: string;
  onSuccess: () => void;
}

function IssueAdvanceDialog({
  open,
  onOpenChange,
  employees,
  selectedEmployeeId,
  onSuccess,
}: IssueAdvanceDialogProps) {
  const [employeeId, setEmployeeId] = useState(selectedEmployeeId ?? "");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  // Reset when dialog opens/closes
  React.useEffect(() => {
    if (open) {
      setEmployeeId(selectedEmployeeId ?? "");
      setAmount("");
      setReason("");
      setNotes("");
    }
  }, [open, selectedEmployeeId]);

  // Get selected employee's details
  const selectedEmployee = employees.find((e) => e.id === employeeId);

  // Fetch employee's current outstanding advances
  const {
    data: existingAdvances = [],
    isLoading: advancesLoading,
    isError: advancesError,
  } = useQuery({
    queryKey: ["advances", employeeId],
    enabled: !!employeeId,
    queryFn: async () => {
      const res = await fetch(`/api/employees/${employeeId}/advances`);
      if (!res.ok) throw new Error("Failed to load employee advances");
      return res.json();
    },
  });

  const outstandingTotal = existingAdvances
    .filter((a: any) => a.status !== "RECOVERED")
    .reduce((sum: number, a: any) => sum + Math.max(Number(a.amount) - Number(a.recoveredAmount), 0), 0);

  // Validations
  const amountNum = parseFloat(amount);
  const isAmountValid = !isNaN(amountNum) && amountNum > 0;
  const isReasonValid = reason.trim().length >= 3;
  const canSubmit = employeeId && isAmountValid && isReasonValid && !advancesLoading && !advancesError;

  // Warnings
  const showOutstandingWarning = outstandingTotal > 0;
  const showLargeAmountWarning =
    selectedEmployee && isAmountValid && amountNum > Number(selectedEmployee.salaryAmount) * 2;

  const issueMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/employees/${employeeId}/advances`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountNum,
          reason: reason.trim(),
          notes: notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const result = await res.json();
        throw new Error(typeof result.error === "string" ? result.error : "Failed to issue advance");
      }
      return res.json();
    },
    onSuccess,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Issue Advance</DialogTitle>
          <DialogDescription>
            Provide an advance payment to an employee. It will be deducted from future salary payments.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Employee Selection */}
          <div className="space-y-2">
            <Label htmlFor="employee">Employee *</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger id="employee">
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.name} — {emp.jobRole}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Show current outstanding if any */}
          {showOutstandingWarning && (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Existing outstanding: ₹{outstandingTotal.toLocaleString("en-IN")}</p>
                <p className="text-xs">This employee already has pending advances.</p>
              </div>
            </div>
          )}
          {advancesError && (
            <p className="text-xs text-destructive" role="alert">
              Could not check existing advance balances. Try again before issuing another advance.
            </p>
          )}

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Amount *</Label>
            <Input
              id="amount"
              type="number"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="0"
              step="100"
            />
            {!isAmountValid && amount && (
              <p className="text-xs text-red-600">Amount must be greater than 0</p>
            )}
            {showLargeAmountWarning && (
              <p className="text-xs text-amber-600">
                ⚠️ This exceeds 2x the employee's salary (₹
                {Number(selectedEmployee.salaryAmount).toLocaleString("en-IN")})
              </p>
            )}
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason *</Label>
            <Input
              id="reason"
              placeholder="e.g., Medical emergency, Family event"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={200}
            />
            {reason && reason.length < 3 && (
              <p className="text-xs text-red-600">Reason must be at least 3 characters</p>
            )}
          </div>

          {/* Notes (optional) */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Additional notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {/* Summary */}
          {selectedEmployee && isAmountValid && (
            <div className="rounded-md bg-muted px-3 py-2 text-sm">
              <p className="font-medium">{selectedEmployee.name}</p>
              <p className="text-muted-foreground">
                New advance: ₹{amountNum.toLocaleString("en-IN")}
              </p>
              {showOutstandingWarning && (
                <p className="text-muted-foreground">
                  Total outstanding: ₹{(outstandingTotal + amountNum).toLocaleString("en-IN")}
                </p>
              )}
            </div>
          )}
          {issueMutation.isError && (
            <p className="text-xs text-destructive" role="alert">{issueMutation.error.message}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={issueMutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => issueMutation.mutate()}
            disabled={!canSubmit || issueMutation.isPending}
          >
            {issueMutation.isPending ? "Issuing..." : "Issue Advance"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Payment Confirmation Dialog (for Salary with Advances) ──────────────────

interface PaymentConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: any;
  periodStart: string;
  periodEnd: string;
  grossAmount: number;
  outstandingAdvances: number;
  advances: any[];
  paymentMethod: string;
  paymentNote: string;
  onConfirm: (deductionAmount: number, advancesToRecover: { advanceId: string; amount: number }[]) => void;
  isPending: boolean;
}

export function PaymentConfirmDialog({
  open,
  onOpenChange,
  employee,
  periodStart,
  periodEnd,
  grossAmount,
  outstandingAdvances,
  advances,
  paymentMethod,
  paymentNote,
  onConfirm,
  isPending,
}: PaymentConfirmDialogProps) {
  const [deductionMode, setDeductionMode] = useState<"FULL" | "PARTIAL" | "NONE">("FULL");
  const [partialAmount, setPartialAmount] = useState("");

  // Reset when dialog opens
  React.useEffect(() => {
    if (open) {
      setDeductionMode(outstandingAdvances > 0 ? "FULL" : "NONE");
      setPartialAmount("");
    }
  }, [open, outstandingAdvances]);

  const partialAmountNum = parseFloat(partialAmount);
  const isPartialValid =
    deductionMode !== "PARTIAL" ||
    (!isNaN(partialAmountNum) &&
      partialAmountNum > 0 &&
      partialAmountNum <= outstandingAdvances &&
      partialAmountNum <= grossAmount);

  const actualDeduction =
    deductionMode === "FULL"
      ? Math.min(outstandingAdvances, grossAmount)
      : deductionMode === "PARTIAL"
      ? partialAmountNum
      : 0;

  const netPayable = grossAmount - actualDeduction;

  // Show warning if net pay is very low
  const showLowPayWarning = netPayable === 0 || netPayable < 500;

  const canConfirm = isPartialValid && !isPending;

  const handleConfirm = () => {
    // FIFO: distribute deduction across advances from oldest first
    const advancesToRecover: { advanceId: string; amount: number }[] = [];
    let remaining = actualDeduction;

    for (const adv of advances) {
      if (remaining <= 0) break;
      const advOutstanding = Math.max(Number(adv.amount) - Number(adv.recoveredAmount), 0);
      const toRecover = Math.min(remaining, advOutstanding);
      advancesToRecover.push({ advanceId: adv.id, amount: toRecover });
      remaining -= toRecover;
    }

    onConfirm(actualDeduction, advancesToRecover);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Confirm Salary Payment</DialogTitle>
          <DialogDescription>{employee.name} — {employee.jobRole}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Summary */}
          <div className="rounded-md border px-3 py-2 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Gross Salary:</span>
              <span className="font-medium">₹{grossAmount.toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Outstanding Advance:</span>
              <span className="font-medium text-orange-600">
                ₹{outstandingAdvances.toLocaleString("en-IN")}
              </span>
            </div>
          </div>

          {/* Deduction Options */}
          {outstandingAdvances > 0 && (
            <div className="space-y-3">
              <Label>Deduct advance from this payment?</Label>
              <RadioGroup value={deductionMode} onValueChange={(v) => setDeductionMode(v as any)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="FULL" id="full" />
                  <Label htmlFor="full" className="font-normal cursor-pointer">
                    Yes, deduct full amount (₹
                    {Math.min(outstandingAdvances, grossAmount).toLocaleString("en-IN")})
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="PARTIAL" id="partial" />
                  <Label htmlFor="partial" className="font-normal cursor-pointer">
                    Deduct partial amount
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="NONE" id="none" />
                  <Label htmlFor="none" className="font-normal cursor-pointer">
                    No, don't deduct this time
                  </Label>
                </div>
              </RadioGroup>

              {/* Partial amount input */}
              {deductionMode === "PARTIAL" && (
                <div className="ml-6 space-y-2">
                  <Label htmlFor="partialAmount">Deduct Amount</Label>
                  <Input
                    id="partialAmount"
                    type="number"
                    placeholder="0"
                    value={partialAmount}
                    onChange={(e) => setPartialAmount(e.target.value)}
                    min="0"
                    max={Math.min(outstandingAdvances, grossAmount)}
                    step="100"
                  />
                  {partialAmount && !isPartialValid && (
                    <p className="text-xs text-red-600">
                      {partialAmountNum > outstandingAdvances
                        ? "Cannot exceed outstanding amount"
                        : partialAmountNum > grossAmount
                        ? "Cannot exceed gross salary"
                        : "Must be greater than 0"}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Max: ₹{Math.min(outstandingAdvances, grossAmount).toLocaleString("en-IN")}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Net Payable */}
          <div className="rounded-md bg-primary/5 border border-primary/20 px-4 py-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Net Payable:</span>
              <span className="text-2xl font-bold text-primary">
                ₹{netPayable.toLocaleString("en-IN")}
              </span>
            </div>
            {actualDeduction > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                After deducting ₹{actualDeduction.toLocaleString("en-IN")} from advances
              </p>
            )}
          </div>

          {/* Low pay warning */}
          {showLowPayWarning && (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Warning: Net payment is {netPayable === 0 ? "₹0" : "very low"}</p>
                <p className="text-xs">Employee will receive {netPayable === 0 ? "nothing" : `only ₹${netPayable}`} this period.</p>
              </div>
            </div>
          )}

          {/* Payment details */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Method: {paymentMethod}</p>
            {paymentNote && <p>Note: {paymentNote}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>
            {isPending ? "Processing..." : `Confirm Payment — ₹${netPayable.toLocaleString("en-IN")}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
