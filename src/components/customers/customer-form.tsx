"use client";

import { useEffect, useState } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LoadingButton } from "@/components/ui/loading-button";
import { Search, X, Link2, Phone } from "lucide-react";
import { customerSchema, type CustomerInput } from "@/lib/validations";
import Link from "next/link";
import { ContactPickerButton } from "@/components/contact-picker-button";
import { PhoneInput } from "@/components/phone-input";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CustomerFormDefaultValues {
  name: string;
  mobile: string;
  email: string;
  address: string;
  occasion: string;
  notes: string;
  linkedCustomerId: string;
  linkedLabel?: { name: string; phone: string } | null;
  startInLinkedMode?: boolean;
}

export interface CustomerFormProps {
  defaultValues?: Partial<CustomerFormDefaultValues>;
  editingCustomerId?: string;
  onSubmit: (data: CustomerInput) => void;
  isPending?: boolean;
  error?: string | null;
  submitLabel?: string;
  submitLoadingLabel?: string;
  cancelHref: string;
}

// ─── Field wrapper — consistent spacing + label style ────────────────────────

function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
      {hint && !error && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function CustomerForm({
  defaultValues,
  editingCustomerId,
  onSubmit,
  isPending = false,
  error,
  submitLabel = "Save",
  submitLoadingLabel = "Saving...",
  cancelHref,
}: CustomerFormProps) {
  const [useLinked, setUseLinked] = useState(defaultValues?.startInLinkedMode ?? false);
  const [linkedSearch, setLinkedSearch] = useState(defaultValues?.linkedLabel?.name ?? "");
  const [linkedLabel, setLinkedLabel] = useState<{ name: string; phone: string } | null>(
    defaultValues?.linkedLabel ?? null
  );
  const [showLinkedDropdown, setShowLinkedDropdown] = useState(false);

  const { data: linkedSearchResults } = useQuery({
    queryKey: ["customers-search", linkedSearch],
    queryFn: async () => {
      if (!linkedSearch.trim()) return { customers: [] };
      const res = await fetch(
        `/api/customers?search=${encodeURIComponent(linkedSearch)}&limit=8`
      );
      if (!res.ok) return { customers: [] };
      return res.json();
    },
    enabled: linkedSearch.trim().length > 0,
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors },
  } = useForm<CustomerInput>({
    resolver: zodResolver(customerSchema),
    mode: "onSubmit",
    reValidateMode: "onSubmit",
    defaultValues: {
      name: defaultValues?.name ?? "",
      mobile: defaultValues?.mobile ?? "",
      email: defaultValues?.email ?? "",
      address: defaultValues?.address ?? "",
      occasion: defaultValues?.occasion ?? "",
      notes: defaultValues?.notes ?? "",
      linkedCustomerId: defaultValues?.linkedCustomerId ?? "",
    },
  });

  useEffect(() => {
    if (!defaultValues) return;
    reset({
      name: defaultValues.name ?? "",
      mobile: defaultValues.mobile ?? "",
      email: defaultValues.email ?? "",
      address: defaultValues.address ?? "",
      occasion: defaultValues.occasion ?? "",
      notes: defaultValues.notes ?? "",
      linkedCustomerId: defaultValues.linkedCustomerId ?? "",
    });
    if (defaultValues.startInLinkedMode) setUseLinked(true);
    if (defaultValues.linkedLabel) {
      setLinkedLabel(defaultValues.linkedLabel);
      setLinkedSearch(defaultValues.linkedLabel.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultValues?.name, defaultValues?.mobile, defaultValues?.linkedCustomerId]);

  const linkedCustomerId = useWatch({ control, name: "linkedCustomerId" });

  const handleSelectLinked = (c: { id: string; name: string; mobile: string | null }) => {
    if (editingCustomerId && c.id === editingCustomerId) return;
    setValue("linkedCustomerId", c.id, { shouldValidate: true });
    setValue("mobile", "", { shouldValidate: true });
    const phone = c.mobile?.startsWith("no-phone_") ? "No phone" : (c.mobile ?? "No phone");
    setLinkedLabel({ name: c.name, phone });
    setLinkedSearch(c.name);
    setShowLinkedDropdown(false);
  };

  const handleSwitchToLinked = () => {
    setUseLinked(true);
    setValue("mobile", "", { shouldValidate: false });
  };

  const handleSwitchToMobile = () => {
    setUseLinked(false);
    setLinkedSearch("");
    setLinkedLabel(null);
    setValue("linkedCustomerId", "", { shouldValidate: false });
    setValue("mobile", "", { shouldValidate: false });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* ── Fields — stacked, full width, generous spacing ── */}
      <div className="space-y-5 max-w-lg">

        {/* Name */}
        <Field label="Full Name" required error={errors.name?.message}>
          <Input
            {...register("name")}
            placeholder="e.g. Priya Sharma"
            className={errors.name ? "border-destructive focus-visible:ring-destructive" : ""}
          />
        </Field>

        {/* Mobile / Linked toggle */}
        <div>
          <input type="hidden" {...register("linkedCustomerId")} />

          {!useLinked ? (
            /* ── MOBILE MODE ─────────────────────────────── */
            <Field
              label="Mobile"
              required
              error={errors.mobile?.message}
            >
              <div className="flex gap-2">
                <Controller
                  name="mobile"
                  control={control}
                  render={({ field }) => (
                    <PhoneInput
                      value={field.value ?? ""}
                      onChange={(value) => field.onChange(value || "")}
                      placeholder="Enter phone number"
                      defaultCountry="IN"
                    />
                  )}
                />
                <ContactPickerButton
                  onPick={({ name, tel }) => {
                    setValue("mobile", tel, { shouldValidate: true });
                    if (name) setValue("name", name, { shouldValidate: true });
                  }}
                />
              </div>
              <button
                type="button"
                onClick={handleSwitchToLinked}
                className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Link2 className="h-3 w-3" />
                No phone? Link to a family member instead
              </button>
            </Field>
          ) : (
            /* ── LINKED MEMBER MODE ──────────────────────── */
            <Field
              label="Linked to (family member)"
              required
              error={errors.linkedCustomerId?.message ?? errors.mobile?.message}
            >
              {linkedCustomerId ? (
                /* Selected pill */
                <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2.5">
                  <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm flex-1 min-w-0">
                    <span className="font-medium">{linkedLabel?.name}</span>
                    {linkedLabel?.phone && (
                      <span className="text-muted-foreground"> — {linkedLabel.phone}</span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setValue("linkedCustomerId", "", { shouldValidate: true });
                      setLinkedSearch("");
                      setLinkedLabel(null);
                    }}
                    className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                /* Search input */
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    className="pl-9"
                    placeholder="Search by name or phone…"
                    value={linkedSearch}
                    onChange={(e) => {
                      setLinkedSearch(e.target.value);
                      setShowLinkedDropdown(true);
                    }}
                    onFocus={() => setShowLinkedDropdown(true)}
                    onBlur={() => setTimeout(() => setShowLinkedDropdown(false), 150)}
                  />
                  {showLinkedDropdown && linkedSearchResults?.customers?.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md">
                      {linkedSearchResults.customers
                        .filter((c: any) => c.id !== editingCustomerId)
                        .map((c: any) => {
                          const phone = c.mobile?.startsWith("no-phone_") ? "No phone" : c.mobile;
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onMouseDown={() => handleSelectLinked(c)}
                              className="w-full flex flex-col px-3 py-2 text-sm hover:bg-accent text-left"
                            >
                              <span className="font-medium">{c.name}</span>
                              <span className="text-xs text-muted-foreground">{phone}</span>
                            </button>
                          );
                        })}
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={handleSwitchToMobile}
                className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Phone className="h-3 w-3" />
                Has their own phone? Enter mobile instead
              </button>
            </Field>
          )}
        </div>

        {/* Email */}
        <Field label="Email" hint="Optional" error={errors.email?.message}>
          <Input
            type="email"
            {...register("email")}
            placeholder="e.g. priya@example.com"
          />
        </Field>

        {/* Address */}
        <Field label="Address" hint="Optional">
          <Textarea
            {...register("address")}
            rows={3}
            placeholder="Street, city, PIN…"
            className="resize-none"
          />
        </Field>
      </div>

      {/* ── Form-level error ── */}
      {error && (
        <p className="mt-5 text-sm text-destructive">{error}</p>
      )}

      {/* ── Actions ── */}
      <div className="mt-8 flex items-center gap-3 border-t pt-5">
        <Link href={cancelHref}>
          <Button variant="outline" type="button">
            Cancel
          </Button>
        </Link>
        <LoadingButton type="submit" loading={isPending} loadingText={submitLoadingLabel}>
          {submitLabel}
        </LoadingButton>
      </div>
    </form>
  );
}
