"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
    Plus,
    Search,
    Briefcase,
    Phone,
    Clock,
    CalendarIcon,
    AlertCircle,
    CheckCircle2,
    DollarSign,
    TrendingDown,
    ShieldAlert,
} from "lucide-react";
import {
    toYMD,
    currentWeekMonday,
    currentYearMonth,
    prevPeriod,
    nextPeriod,
    periodLabel,
} from "./utils";
import { PaymentConfirmDialog } from "./advances-tab";

export function SalaryTab() {
    const queryClient = useQueryClient();

    // Unified period mode — monthly uses YYYY-MM, weekly uses YYYY-MM-DD (monday)
    const [viewMode, setViewMode] = useState<"monthly" | "weekly">("weekly");
    const [monthPeriod, setMonthPeriod] = useState(currentYearMonth());
    const [weekPeriod, setWeekPeriod] = useState(currentWeekMonday());

    const period = viewMode === "monthly" ? monthPeriod : weekPeriod;
    const isWeek = viewMode === "weekly";

    // Per-card payment method state
    const [methods, setMethods] = useState<Record<string, string>>({});
    const [notes, setNotes] = useState<Record<string, string>>({});
    const [showBreakdown, setShowBreakdown] = useState<Record<string, boolean>>({});

    // Payment confirmation dialog state
    const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
    const [selectedPayroll, setSelectedPayroll] = useState<any>(null);

    function getMethod(id: string) { return methods[id] ?? "CASH"; }
    function getNote(id: string) { return notes[id] ?? ""; }

    const { data: payrollData, isLoading } = useQuery({
        queryKey: ["payroll", period],
        queryFn: async () => {
            const res = await fetch(`/api/employees/salary/payroll?period=${period}`);
            if (!res.ok) throw new Error("Failed");
            return res.json();
        },
    });

    // All employees shown in both views — per-day rate handles the difference:
    // Weekly: weeklyAmount ÷ 6 per day | Monthly: monthlyAmount ÷ workingDays per day
    const payroll: any[] = payrollData?.payroll ?? [];

    // Fetch employee advances for those with outstanding
    const { data: allAdvancesData } = useQuery({
        queryKey: ["all-advances-for-salary", period],
        enabled: payroll.length > 0,
        queryFn: async () => {
            const employeesWithAdvances = payroll.filter((p: any) => p.calculation.outstandingAdvances > 0);
            if (employeesWithAdvances.length === 0) return {};

            const results = await Promise.all(
                employeesWithAdvances.map(async (p: any) => {
                    const res = await fetch(`/api/employees/${p.employee.id}/advances`);
                    if (!res.ok) return { employeeId: p.employee.id, advances: [] };
                    const advances = await res.json();
                    return {
                        employeeId: p.employee.id,
                        advances: advances
                            .filter((a: any) => a.status !== "RECOVERED")
                            .sort((a: any, b: any) => new Date(a.issuedAt).getTime() - new Date(b.issuedAt).getTime()), // FIFO
                    };
                })
            );

            const map: Record<string, any[]> = {};
            results.forEach((r) => {
                map[r.employeeId] = r.advances;
            });
            return map;
        },
    });

    const allAdvances = allAdvancesData ?? {};

    const saveMutation = useMutation({
        mutationFn: async ({
            employeeId,
            periodStart,
            periodEnd,
            grossAmount,
            netAmount,
            method,
            note,
            advanceDeduction,
            advancesToRecover,
        }: {
            employeeId: string;
            periodStart: string;
            periodEnd: string;
            grossAmount: number;
            netAmount: number;
            method: string;
            note: string;
            advanceDeduction: number;
            advancesToRecover: { advanceId: string; amount: number }[];
        }) => {
            const res = await fetch(`/api/employees/${employeeId}/salary`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    periodStart,
                    periodEnd,
                    grossAmount,
                    deductions: 0,
                    netAmount,
                    method,
                    notes: note || undefined,
                    advanceDeduction,
                    advancesToRecover: advancesToRecover.length > 0 ? advancesToRecover : undefined,
                }),
            });
            if (!res.ok) throw new Error("Failed");
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["payroll", period] });
            queryClient.invalidateQueries({ queryKey: ["all-advances-for-salary"] });
            queryClient.invalidateQueries({ queryKey: ["all-advances"] });
            setPaymentDialogOpen(false);
            setSelectedPayroll(null);
        },
    });

    const unpaidCount = payroll.filter((p: any) => !p.paidThisPeriod).length;

    return (
        <div className="space-y-4">

            {/* ── Period selector ── */}
            <div className="flex items-center gap-2 flex-wrap">
                {/* Mode toggle */}
                <div className="flex gap-1 rounded-md border p-0.5 bg-muted">
                    {(["weekly", "monthly"] as const).map((m) => (
                        <button key={m} onClick={() => setViewMode(m)}
                            className={`rounded px-3 py-1 text-xs font-medium transition-colors capitalize ${viewMode === m ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
                                }`}
                        >{m}</button>
                    ))}
                </div>

                {/* Period navigator */}
                <div className="flex items-center gap-1 rounded-md border px-1 py-0.5">
                    <button
                        onClick={() => isWeek ? setWeekPeriod(prevPeriod(period, true)) : setMonthPeriod(prevPeriod(period, false))}
                        className="h-6 w-6 rounded flex items-center justify-center hover:bg-muted text-muted-foreground"
                    >‹</button>
                    <span className="text-sm font-medium px-2 min-w-[10rem] text-center">
                        {periodLabel(period, isWeek)}
                    </span>
                    <button
                        onClick={() => isWeek ? setWeekPeriod(nextPeriod(period, true)) : setMonthPeriod(nextPeriod(period, false))}
                        className="h-6 w-6 rounded flex items-center justify-center hover:bg-muted text-muted-foreground"
                    >›</button>
                </div>

                {/* Jump to current */}
                <button
                    onClick={() => { setMonthPeriod(currentYearMonth()); setWeekPeriod(currentWeekMonday()); }}
                    className="text-xs text-primary hover:underline"
                >
                    Today
                </button>
            </div>

            {/* ── Summary banner ── */}
            {!isLoading && unpaidCount > 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span><span className="font-semibold">{unpaidCount} employee{unpaidCount > 1 ? "s" : ""}</span> unpaid for this period</span>
                </div>
            )}

            {/* ── Payroll cards ── */}
            {isLoading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <Card key={i} className="animate-pulse"><CardContent className="h-20 pt-4" /></Card>
                    ))}
                </div>
            ) : payroll.length === 0 ? (
                <Card><CardContent className="py-12 text-center text-muted-foreground">No active employees found.</CardContent></Card>
            ) : (
                <div className="space-y-3">
                    {payroll.map((row: any) => {
                        const { employee: emp, attendance, calculation, paidThisPeriod, period: pd } = row;
                        const isPaid = !!paidThisPeriod;
                        const hasUnmarked = attendance.unmarkedWorkingDays > 0;
                        const isBreakdownOpen = showBreakdown[emp.id];

                        return (
                            <Card key={emp.id} className={isPaid ? "opacity-70" : hasUnmarked ? "border-amber-200" : ""}>
                                <CardContent className="pt-3 pb-3 space-y-2">

                                    {/* ── Top row: name + badges + net pay ── */}
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <Link href={`/dashboard/employees/${emp.id}`}
                                                    className="font-semibold hover:text-primary transition-colors">
                                                    {emp.name}
                                                </Link>
                                                <Badge className={emp.payCycle === "WEEKLY" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}>
                                                    {emp.payCycle}
                                                </Badge>
                                                {isPaid && (
                                                    <Badge className="bg-green-100 text-green-700">
                                                        <CheckCircle2 className="h-3 w-3 mr-1" />Paid
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-0.5">{emp.jobRole}</p>
                                        </div>

                                        {/* Net pay — prominent */}
                                        <div className="text-right shrink-0">
                                            <p className="text-lg font-bold leading-none">
                                                ₹{calculation.netPayable.toLocaleString("en-IN")}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground mt-0.5">net payable</p>
                                        </div>
                                    </div>

                                    {/* ── Attendance summary row ── */}
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                                        <span className="text-green-600 font-medium">{attendance.present}P</span>
                                        {attendance.halfDay > 0 && <span className="text-yellow-600 font-medium">{attendance.halfDay}½</span>}
                                        {attendance.absent > 0 && <span className="text-red-500 font-medium">{attendance.absent}A</span>}
                                        <span className="text-muted-foreground">/ {pd.workingDays} days</span>
                                        {hasUnmarked && !isPaid && (
                                            <span className="text-amber-600 font-medium">⚠ {attendance.unmarkedWorkingDays} unmarked</span>
                                        )}
                                        {calculation.outstandingAdvances > 0 && (
                                            <span className="text-orange-600 font-medium">
                                                advance −₹{calculation.outstandingAdvances.toLocaleString("en-IN")}
                                                {calculation.totalAdvances > calculation.outstandingAdvances && (
                                                    <span className="text-green-600 ml-1">
                                                        (₹{(calculation.totalAdvances - calculation.outstandingAdvances).toLocaleString("en-IN")} recovered)
                                                    </span>
                                                )}
                                            </span>
                                        )}
                                        {/* Breakdown toggle */}
                                        <button
                                            onClick={() => setShowBreakdown((prev: Record<string, boolean>) => ({ ...prev, [emp.id]: !isBreakdownOpen }))}
                                            className="text-primary/70 hover:text-primary text-[10px] underline"
                                        >
                                            {isBreakdownOpen ? "hide" : "how?"}
                                        </button>
                                    </div>

                                    {/* ── Breakdown (collapsible) ── */}
                                    {isBreakdownOpen && (
                                        <div className="rounded-md bg-muted/50 px-3 py-2 text-xs space-y-0.5 text-muted-foreground">
                                            <p>₹{Number(emp.salaryAmount).toLocaleString()} ÷ {pd.workingDays} days = <span className="font-medium text-foreground">₹{calculation.perDay}/day</span></p>
                                            <p>{attendance.effectiveDays} effective days × ₹{calculation.perDay} = <span className="font-medium text-foreground">₹{calculation.grossEarned.toLocaleString()}</span></p>
                                            {calculation.outstandingAdvances > 0 && (
                                                <p>− ₹{calculation.outstandingAdvances.toLocaleString()} advance = <span className="font-semibold text-foreground">₹{calculation.netPayable.toLocaleString()}</span></p>
                                            )}
                                        </div>
                                    )}

                                    {/* ── Payment row (only if not paid) ── */}
                                    {!isPaid && (
                                        <div className="flex items-center gap-2 pt-1 border-t">
                                            <Select
                                                value={getMethod(emp.id)}
                                                onValueChange={(v: string) => setMethods((prev: Record<string, string>) => ({ ...prev, [emp.id]: v }))}
                                            >
                                                <SelectTrigger className="h-7 text-xs w-24 shrink-0">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="CASH">Cash</SelectItem>
                                                    <SelectItem value="UPI">UPI</SelectItem>
                                                    <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                                                    <SelectItem value="CARD">Card</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <Input
                                                placeholder="Note (optional)"
                                                value={getNote(emp.id)}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                                    setNotes((prev: Record<string, string>) => ({ ...prev, [emp.id]: e.target.value }))
                                                }
                                                className="h-7 text-xs flex-1"
                                            />
                                            <Button
                                                size="sm"
                                                className="h-7 shrink-0"
                                                disabled={saveMutation.isPending || calculation.netPayable <= 0}
                                                onClick={() => {
                                                    // If employee has outstanding advances, show confirmation dialog
                                                    if (calculation.outstandingAdvances > 0) {
                                                        setSelectedPayroll(row);
                                                        setPaymentDialogOpen(true);
                                                    } else {
                                                        // Direct payment without advances
                                                        saveMutation.mutate({
                                                            employeeId: emp.id,
                                                            periodStart: pd.start,
                                                            periodEnd: pd.end,
                                                            grossAmount: calculation.grossEarned,
                                                            netAmount: calculation.netPayable,
                                                            method: getMethod(emp.id),
                                                            note: getNote(emp.id),
                                                            advanceDeduction: 0,
                                                            advancesToRecover: [],
                                                        });
                                                    }
                                                }}
                                            >
                                                ✓ Pay ₹{calculation.netPayable.toLocaleString("en-IN")}
                                            </Button>
                                        </div>
                                    )}

                                    {/* ── Already paid stamp ── */}
                                    {isPaid && (
                                        <div className="text-xs space-y-1">
                                            <div className="flex items-center justify-between">
                                                <span className="text-green-600 font-medium">
                                                    ✓ Paid ₹{Number(paidThisPeriod.netAmount).toLocaleString("en-IN")} on{" "}
                                                    {new Date(paidThisPeriod.paidAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                                                    {" "}· {paidThisPeriod.method}
                                                </span>
                                            </div>
                                            {/* Payment breakdown if deductions were made */}
                                            {Number(paidThisPeriod.deductions) > 0 && (
                                                <div className="rounded-md bg-muted/50 px-2 py-1.5 text-[11px] text-muted-foreground space-y-0.5">
                                                    <div className="flex justify-between">
                                                        <span>Gross earned:</span>
                                                        <span className="font-medium text-foreground">
                                                            ₹{Number(paidThisPeriod.grossAmount).toLocaleString("en-IN")}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between text-orange-600">
                                                        <span>Advance recovered:</span>
                                                        <span className="font-medium">
                                                            −₹{Number(paidThisPeriod.deductions).toLocaleString("en-IN")}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between border-t pt-0.5 mt-0.5">
                                                        <span className="font-medium">Net paid:</span>
                                                        <span className="font-semibold text-foreground">
                                                            ₹{Number(paidThisPeriod.netAmount).toLocaleString("en-IN")}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Payment Confirmation Dialog */}
            {selectedPayroll && (
                <PaymentConfirmDialog
                    open={paymentDialogOpen}
                    onOpenChange={setPaymentDialogOpen}
                    employee={selectedPayroll.employee}
                    periodStart={selectedPayroll.period.start}
                    periodEnd={selectedPayroll.period.end}
                    grossAmount={selectedPayroll.calculation.grossEarned}
                    outstandingAdvances={selectedPayroll.calculation.outstandingAdvances}
                    advances={allAdvances[selectedPayroll.employee.id] ?? []}
                    paymentMethod={getMethod(selectedPayroll.employee.id)}
                    paymentNote={getNote(selectedPayroll.employee.id)}
                    onConfirm={(deductionAmount, advancesToRecover) => {
                        saveMutation.mutate({
                            employeeId: selectedPayroll.employee.id,
                            periodStart: selectedPayroll.period.start,
                            periodEnd: selectedPayroll.period.end,
                            grossAmount: selectedPayroll.calculation.grossEarned,
                            netAmount: selectedPayroll.calculation.grossEarned - deductionAmount,
                            method: getMethod(selectedPayroll.employee.id),
                            note: getNote(selectedPayroll.employee.id),
                            advanceDeduction: deductionAmount,
                            advancesToRecover,
                        });
                    }}
                    isPending={saveMutation.isPending}
                />
            )}
        </div>
    );
}