
"use client";

import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Link2, Phone, Search, UserRoundPlus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LoadingButton } from "@/components/ui/loading-button";
import { ContactPickerButton } from "@/components/contact-picker-button";
import { PhoneInput } from "@/components/phone-input";
import {
  customerSchema,
  type CustomerInput,
} from "@/lib/validations";

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
    <div className="space-y-2">
      <Label className="text-sm font-medium text-foreground">
        {label}
        {required && (
          <span className="ml-1 text-destructive">*</span>
        )}
      </Label>

      {children}

      {hint && !error && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}

      {error && (
        <p className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function CustomerForm({
  defaultValues,
  editingCustomerId,
  onSubmit,
  isPending = false,
  error,
  submitLabel = "Save Customer",
  submitLoadingLabel = "Saving...",
  cancelHref,
}: CustomerFormProps) {
  const [useLinked, setUseLinked] = useState(
    defaultValues?.startInLinkedMode ?? false
  );

  const [linkedSearch, setLinkedSearch] = useState(
    defaultValues?.linkedLabel?.name ?? ""
  );

  const [linkedLabel, setLinkedLabel] = useState<{
    name: string;
    phone: string;
  } | null>(defaultValues?.linkedLabel ?? null);

  const [showLinkedDropdown, setShowLinkedDropdown] =
    useState(false);

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

  const linkedCustomerId = useWatch({
    control,
    name: "linkedCustomerId",
  });

  const { data: linkedSearchResults, isFetching } = useQuery({
    queryKey: ["customers-search", linkedSearch],
    queryFn: async () => {
      if (!linkedSearch.trim()) return { customers: [] };

      const res = await fetch(
        `/api/customers?search=${encodeURIComponent(linkedSearch)}&limit=8`
      );

      if (!res.ok) return { customers: [] };

      return res.json();
    },
    enabled: linkedSearch.trim().length > 0 && useLinked,
  });

  const handleSelectLinked = (customer: {
    id: string;
    name: string;
    mobile: string | null;
  }) => {
    if (editingCustomerId && customer.id === editingCustomerId) {
      return;
    }

    setValue("linkedCustomerId", customer.id, {
      shouldValidate: true,
    });

    setValue("mobile", "", { shouldValidate: true });

    const phone = customer.mobile?.startsWith("no-phone_")
      ? "No phone"
      : customer.mobile ?? "No phone";

    setLinkedLabel({
      name: customer.name,
      phone,
    });

    setLinkedSearch(customer.name);
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

    setValue("linkedCustomerId", "", {
      shouldValidate: false,
    });

    setValue("mobile", "", { shouldValidate: false });
  };

  return (
    <div className="mx-auto w-full max-w-md">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="overflow-visible rounded-2xl border border-border bg-card shadow-sm"
      >


        {/* Form fields */}
        <div className="space-y-5 px-5 py-6 sm:px-6">
          <Field
            label="Full Name"
            required
            error={errors.name?.message}
          >
            <Input
              {...register("name")}
              placeholder="Enter customer name"
              autoComplete="name"
              className={`h-11 rounded-lg ${errors.name
                ? "border-destructive focus-visible:ring-destructive"
                : ""
                }`}
            />
          </Field>

          {/* Mobile / Linked customer */}
          <div>
            <input
              type="hidden"
              {...register("linkedCustomerId")}
            />

            {!useLinked ? (
              <Field
                label="Mobile Number"
                required
                error={errors.mobile?.message}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <Controller
                      name="mobile"
                      control={control}
                      render={({ field }) => (
                        <PhoneInput
                          value={field.value ?? ""}
                          onChange={(value) =>
                            field.onChange(value || "")
                          }
                          placeholder="Enter phone number"
                          defaultCountry="IN"
                        />
                      )}
                    />
                  </div>

                  <ContactPickerButton
                    onPick={({ name, tel }) => {
                      setValue("mobile", tel, {
                        shouldValidate: true,
                      });

                      if (name) {
                        setValue("name", name, {
                          shouldValidate: true,
                        });
                      }
                    }}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSwitchToLinked}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  No phone? Link a family member
                </button>
              </Field>
            ) : (
              <Field
                label="Family Member"
                required
                error={
                  errors.linkedCustomerId?.message ??
                  errors.mobile?.message
                }
              >
                {linkedCustomerId ? (
                  <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Link2 className="h-4 w-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {linkedLabel?.name}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {linkedLabel?.phone}
                      </p>
                    </div>

                    <button
                      type="button"
                      aria-label="Remove linked family member"
                      onClick={() => {
                        setValue("linkedCustomerId", "", {
                          shouldValidate: true,
                        });
                        setLinkedSearch("");
                        setLinkedLabel(null);
                      }}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                    <Input
                      value={linkedSearch}
                      onChange={(event) => {
                        setLinkedSearch(event.target.value);
                        setShowLinkedDropdown(true);
                      }}
                      onFocus={() => setShowLinkedDropdown(true)}
                      onBlur={() =>
                        setTimeout(
                          () => setShowLinkedDropdown(false),
                          150
                        )
                      }
                      placeholder="Search name or phone"
                      className="h-11 rounded-lg pl-9"
                    />

                    {showLinkedDropdown &&
                      linkedSearch.trim() &&
                      linkedSearchResults?.customers && (
                        <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-xl border border-border bg-popover shadow-lg">
                          {linkedSearchResults.customers.filter(
                            (customer: { id: string }) =>
                              customer.id !== editingCustomerId
                          ).length > 0 ? (
                            linkedSearchResults.customers
                              .filter(
                                (customer: { id: string }) =>
                                  customer.id !== editingCustomerId
                              )
                              .map(
                                (customer: {
                                  id: string;
                                  name: string;
                                  mobile: string | null;
                                }) => {
                                  const phone =
                                    customer.mobile?.startsWith(
                                      "no-phone_"
                                    )
                                      ? "No phone"
                                      : customer.mobile ?? "No phone";

                                  return (
                                    <button
                                      key={customer.id}
                                      type="button"
                                      onMouseDown={(event) =>
                                        event.preventDefault()
                                      }
                                      onClick={() =>
                                        handleSelectLinked(customer)
                                      }
                                      className="flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-accent"
                                    >
                                      <span className="text-sm font-medium">
                                        {customer.name}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        {phone}
                                      </span>
                                    </button>
                                  );
                                }
                              )
                          ) : (
                            <p className="px-4 py-3 text-sm text-muted-foreground">
                              {isFetching
                                ? "Searching customers..."
                                : "No matching customers found"}
                            </p>
                          )}
                        </div>
                      )}

                    {isFetching && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Searching...
                      </p>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSwitchToMobile}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Phone className="h-3.5 w-3.5" />
                  Enter a mobile number instead
                </button>
              </Field>
            )}
          </div>

          <Field
            label="Email Address"
            error={errors.email?.message}
          >
            <Input
              type="email"
              {...register("email")}
              placeholder="e.g. priya@example.com"
              autoComplete="email"
              className={`h-11 rounded-lg ${errors.email
                ? "border-destructive focus-visible:ring-destructive"
                : ""
                }`}
            />
          </Field>

          <Field label="Address">
            <Textarea
              {...register("address")}
              rows={3}
              placeholder="Street, city and PIN code"
              autoComplete="street-address"
              className="min-h-24 resize-y rounded-lg"
            />
          </Field>
        </div>

        {/* Form error */}
        {error && (
          <div className="mx-5 mb-4 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 sm:mx-6">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Actions: aligned to the bottom-right */}
        <div className="flex items-center justify-end gap-3 border-t border-border bg-muted/20 px-5 py-4 sm:px-6">
          <Button
            variant="outline"
            type="button"
            asChild
            className="min-w-20 rounded-lg"
          >
            <Link href={cancelHref}>Cancel</Link>
          </Button>

          <LoadingButton
            type="submit"
            loading={isPending}
            loadingText={submitLoadingLabel}
            className="min-w-32 rounded-lg"
          >
            {submitLabel}
          </LoadingButton>
        </div>
      </form>
    </div>
  );
}
