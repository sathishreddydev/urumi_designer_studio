import { z } from "zod";
import { isValidPhoneNumber } from "libphonenumber-js";
import { normalizePhoneNumber } from "@/lib/phone-utils";

const PHONE_VALIDATION_MESSAGE = "Please enter a valid phone number for the selected country";

/** Shared optional phone validation; API handlers normalize valid values to E.164 before storage. */
export const optionalPhoneSchema = z
  .string()
  .trim()
  .optional()
  .refine((value) => !value || normalizePhoneNumber(value) !== null, {
    message: PHONE_VALIDATION_MESSAGE,
  });

/** Shared required phone validation; API handlers normalize valid values to E.164 before storage. */
export const requiredPhoneSchema = z
  .string()
  .trim()
  .min(1, "Phone number is required")
  .refine((value) => normalizePhoneNumber(value) !== null, {
    message: PHONE_VALIDATION_MESSAGE,
  });

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const customerBaseSchema = z.object({
  name: z.string().min(2, "Name is required"),
  // mobile is optional at the object level — family members without their own phone can be
  // added without one. When provided it must be a valid E.164 number (libphonenumber-js).
  // The superRefine below enforces it as required when no linkedCustomerId is provided.
  mobile: z
    .string()
    .optional()
    .refine((value) => !value || isValidPhoneNumber(value), {
      message: PHONE_VALIDATION_MESSAGE,
    }),
  whatsapp: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  occasion: z.string().optional(),
  notes: z.string().optional(),
  // ID of the primary customer this record is linked to (e.g. mother's profile)
  // Coerce empty string to undefined so a blank selection doesn't violate the FK constraint
  linkedCustomerId: z.string().optional().transform((val) => val?.trim() || undefined),
});

// Full schema used for creation — mobile required unless a linkedCustomerId is provided
export const customerSchema = customerBaseSchema.superRefine((data, ctx) => {
  if (!data.linkedCustomerId && !data.mobile?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["mobile"],
      message: "Mobile is required unless this customer is linked to a family member",
    });
  }
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
  // price and designerId are part of the outfit payload and must be validated
  price: z.number().nonnegative("Price must be 0 or positive").optional(),
  designerId: z.string().optional(),
  masterId: z.string().optional(),
  addOns: z.array(z.object({
    id: z.string(),
    name: z.string(),
    price: z.number(),
    notes: z.string().optional(),
  })).optional(),
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
  role: z.enum(["ADMIN", "STORE_MANAGER", "RECEPTION", "DESIGNER", "MASTER"]),
  phone: optionalPhoneSchema,
});

export const userUpdateSchema = z.object({
  name: z.string().min(2, "Name is required").optional(),
  phone: optionalPhoneSchema,
  role: userSchema.shape.role.optional(),
  password: z.string().optional().refine((value) => !value || value.length >= 6, {
    message: "Password must be at least 6 characters",
  }),
  active: z.boolean().optional(),
});

export const employeeSchema = z.object({
  name: z.string().min(2, "Name is required"),
  phone: requiredPhoneSchema,
  jobRole: z.string().min(1, "Job role is required"),
  payCycle: z.enum(["WEEKLY", "MONTHLY"]),
  payAmount: z.number().positive("Pay amount must be positive"),
  shiftStart: z.string().optional(),
  shiftEnd: z.string().optional(),
  notes: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type CustomerInput = z.infer<typeof customerSchema>;
export type OrderInput = z.infer<typeof orderSchema>;
export type OutfitInput = z.infer<typeof outfitSchema>;
export type MeasurementInput = z.infer<typeof measurementSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
export type UserInput = z.infer<typeof userSchema>;
export type EmployeeInput = z.infer<typeof employeeSchema>;
