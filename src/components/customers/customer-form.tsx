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
import { ArrowLeft, Search, X, Link2, Phone, User, Mail, MapPin } from "lucide-react";
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
  /** Display label for a pre-selected linked customer (edit mode only) */
  linkedLabel?: { name: string; phone: string } | null;
  /** Whether to start in linked-customer mode (edit mode only) */
  startInLinkedMode?: boolean;
}

export interface CustomerFormProps {
  /** Pre-populated values for edit mode. Leave undefined for new customer. */
  defaultValues?: Partial<CustomerFormDefaultValues>;
  /** The id of the customer being edited — used to prevent self-linking */
  editingCustomerId?: string;
  /** Called with validated form data when the form is submitted */
  onSubmit: (data: CustomerInput) => void;
  /** Whether the submit mutation is in-flight */
  isPending?: boolean;
  /** Error message to display below the form */
  error?: string | null;
  /** Label for the submit button */
  submitLabel?: string;
  /** Label shown on the button while pending */
  submitLoadingLabel?: string;
  /** Where the Cancel button links to */
  cancelHref: string;
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
  // ── Local UI state ───────────────────────────────────────────────────────
  const [useLinked, setUseLinked] = useState(
    defaultValues?.startInLinkedMode ?? false
  );
  const [linkedSearch, setLinkedSearch] = useState(
    defaultValues?.linkedLabel?.name ?? ""
  );
  const [linkedLabel, setLinkedLabel] = useState<{ name: string; phone: string } | null>(
    defaultValues?.linkedLabel ?? null
  );
  const [showLinkedDropdown, setShowLinkedDropdown] = useState(false);

  // ── Live search for linked customer ─────────────────────────────────────
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

  // ── Form ─────────────────────────────────────────────────────────────────
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
      mobile: defaultValues?.mobile ?? "",
      linkedCustomerId: defaultValues?.linkedCustomerId ?? "",
      name: defaultValues?.name ?? "",
      email: defaultValues?.email ?? "",
      address: defaultValues?.address ?? "",
      occasion: defaultValues?.occasion ?? "",
      notes: defaultValues?.notes ?? "",
    },
  });

  // ── Sync defaultValues when they arrive (edit mode) ──────────────────────
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
    if (defaultValues.startInLinkedMode) {
      setUseLinked(true);
    }
    if (defaultValues.linkedLabel) {
      setLinkedLabel(defaultValues.linkedLabel);
      setLinkedSearch(defaultValues.linkedLabel.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    defaultValues?.name,
    defaultValues?.mobile,
    defaultValues?.linkedCustomerId,
  ]);

  const linkedCustomerId = useWatch({ control, name: "linkedCustomerId" });

  // ── Handlers ─────────────────────────────────────────────────────────────
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* ── Section: Basic Info ────────────────────────────────────────── */}
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 pb-1">
          Basic Info
        </p>
        <div className="grid gap-4 sm:grid-cols-2">

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="cf-name" className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="cf-name"
              {...register("name")}
              placeholder="Customer name"
              className={errors.name ? "border-destructive" : ""}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Mobile / Linked toggle */}
          <div className="space-y-2">
            <input type="hidden" {...register("linkedCustomerId")} />

            {!useLinked ? (
              /* ── MOBILE MODE ───────────────────────────────────────── */
              <>
                <Label htmlFor="cf-mobile" className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  Mobile <span className="text-destructive">*</span>
                </Label>
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
                {errors.mobile && (
                  <p className="text-xs text-destructive">{errors.mobile.message}</p>
                )}
                <button
                  type="button"
                  onClick={handleSwitchToLinked}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Link2 className="h-3 w-3" />
                  No phone? Link to a family member instead
                </button>
              </>
            ) : (
              /* ── LINKED MEMBER MODE ────────────────────────────────── */
              <>
                <Label className="flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                  Linked to (family member) <span className="text-destructive">*</span>
                </Label>

                {linkedCustomerId ? (
                  /* Selected pill */
                  <div className="flex items-center gap-2 rounded-md border px-3 py-2 bg-muted/40">
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
                      className="text-muted-foreground hover:text-destructive shrink-0"
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
                      placeholder="Search customer by name or phone..."
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
                            const phone = c.mobile?.startsWith("no-phone_")
                              ? "No phone"
                              : c.mobile;
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

                {errors.linkedCustomerId && (
                  <p className="text-xs text-destructive">{errors.linkedCustomerId.message}</p>
                )}
                {errors.mobile && (
                  <p className="text-xs text-destructive">{errors.mobile.message}</p>
                )}

                <button
                  type="button"
                  onClick={handleSwitchToMobile}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Phone className="h-3 w-3" />
                  Has their own phone? Enter mobile instead
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Section: Contact Details ───────────────────────────────────── */}
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 pb-1">
          Contact Details
        </p>
        <div className="grid gap-4 sm:grid-cols-2">

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="cf-email" className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              Email
            </Label>
            <Input
              id="cf-email"
              type="email"
              {...register("email")}
              placeholder="Email address"
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          {/* Address */}
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="cf-address" className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              Address
            </Label>
            <Textarea
              id="cf-address"
              {...register("address")}
              rows={2}
              placeholder="Full address"
            />
          </div>
        </div>
      </div>

      {/* ── Form-level error ───────────────────────────────────────────── */}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* ── Actions ───────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end border-t">
        <Link href={cancelHref} className="sm:order-1">
          <Button variant="outline" type="button" className="w-full">
            Cancel
          </Button>
        </Link>
        <LoadingButton
          type="submit"
          loading={isPending}
          loadingText={submitLoadingLabel}
          className="sm:order-2"
        >
          {submitLabel}
        </LoadingButton>
      </div>
    </form>
  );
}
