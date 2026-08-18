import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const customerSchema = z.object({
  name: z.string().min(2, "Name is required"),
  mobile: z.string().min(10, "Valid mobile number required"),
  whatsapp: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  occasion: z.string().optional(),
  notes: z.string().optional(),
});

export const orderSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  deliveryDate: z.string().optional(),
  trialDate: z.string().optional(),
  estimatedAmount: z.number().positive().optional(),
  advanceAmount: z.number().positive().optional(),
  notes: z.string().optional(),
});

export const outfitSchema = z.object({
  name: z.string().min(2, "Outfit name is required"),
  type: z.string().min(1, "Outfit type is required"),
  occasion: z.string().optional(),
  priority: z.number().default(0),
  deliveryDate: z.string().optional(),
  trialDate: z.string().optional(),
  maggamRequired: z.boolean().default(false),
});

export const measurementSchema = z.object({
  template: z.string().optional(),
  values: z.record(z.string(), z.string()),
  notes: z.string().optional(),
});

export const paymentSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  amount: z.number().positive("Amount must be positive"),
  method: z.enum(["CASH", "CARD", "UPI", "BANK_TRANSFER"]),
  status: z.enum(["PENDING", "SETTLED", "FAILED", "REFUNDED"]).optional(),
  transactionRef: z.string().optional(),
  outfitId: z.string().optional(),
  invoiceId: z.string().optional(),
  notes: z.string().optional(),
});

export const userSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["ADMIN", "RECEPTION", "DESIGNER", "MASTER"]),
  phone: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type CustomerInput = z.infer<typeof customerSchema>;
export type OrderInput = z.infer<typeof orderSchema>;
export type OutfitInput = z.infer<typeof outfitSchema>;
export type MeasurementInput = z.infer<typeof measurementSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
export type UserInput = z.infer<typeof userSchema>;
