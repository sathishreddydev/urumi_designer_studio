import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function generateOrderNumber(): string {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const random = Math.floor(Math.random() * 90000 + 10000);
  const suffix = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `ORD-${year}${month}-${random}${suffix}`;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-700",
    DESIGN_IN_PROGRESS: "bg-blue-100 text-blue-700",
    WAITING_FOR_REFERENCES: "bg-yellow-100 text-yellow-700",
    WAITING_FOR_DEPENDENCIES: "bg-orange-100 text-orange-700",
    PRODUCTION_READY: "bg-indigo-100 text-indigo-700",
    PATTERN_DRAFTING: "bg-purple-100 text-purple-700",
    MAGGAM_WORK: "bg-pink-100 text-pink-700",
    MAGGAM_REVIEW: "bg-fuchsia-100 text-fuchsia-700",
    FABRIC_CUTTING: "bg-cyan-100 text-cyan-700",
    STITCHING: "bg-teal-100 text-teal-700",
    PRODUCTION_COMPLETED: "bg-emerald-100 text-emerald-700",
    TRIAL: "bg-amber-100 text-amber-700",
    ALTERATION: "bg-rose-100 text-rose-700",
    QC: "bg-lime-100 text-lime-700",
    READY_FOR_DELIVERY: "bg-green-100 text-green-700",
    DELIVERED: "bg-green-200 text-green-800",
    // Order-level statuses
    Active: "bg-blue-100 text-blue-700",
    "In Design": "bg-violet-100 text-violet-700",
    "Production Ready": "bg-indigo-100 text-indigo-700",
    "Waiting For Dependencies": "bg-orange-100 text-orange-700",
    "In Production": "bg-purple-100 text-purple-700",
    "Trial/QC": "bg-amber-100 text-amber-700",
    "Ready For Delivery": "bg-green-100 text-green-700",
    Completed: "bg-green-200 text-green-800",
  };
  return colors[status] || "bg-gray-100 text-gray-700";
}

export function formatStatus(status: string): string {
  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
