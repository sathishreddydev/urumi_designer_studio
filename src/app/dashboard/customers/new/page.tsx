"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Search, X, Link2 } from "lucide-react";
import { customerSchema, type CustomerInput } from "@/lib/validations";
import Link from "next/link";
import { ContactPickerButton } from "@/components/contact-picker-button";
import { PhoneInput } from "@/components/phone-input";
import { isValidPhoneNumber } from "libphonenumber-js";

export default function NewCustomerPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Linked customer search state
  const [linkedSearch, setLinkedSearch] = useState("");
  const [showLinkedSearch, setShowLinkedSearch] = useState(false);

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

  const createMutation = useMutation({
    mutationFn: async (data: CustomerInput) => {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      router.push(`/dashboard/customers/${data.id}`);
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<CustomerInput>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      mobile: "",
      linkedCustomerId: "",
    },
  });

  // Watch linkedCustomerId to drive conditional mobile requirement
  const linkedCustomerId = useWatch({ control, name: "linkedCustomerId" });
  const mobileValue = useWatch({ control, name: "mobile" });
  const mobileRequired = !linkedCustomerId;

  // Validate mobile on the fly for the required indicator
  const mobileValid = mobileValue && isValidPhoneNumber(mobileValue);

  const handleSelectLinked = (c: { id: string; name: string; mobile: string | null }) => {
    setValue("linkedCustomerId", c.id, { shouldValidate: true });
    setLinkedSearch(c.name);
    setShowLinkedSearch(false);
  };

  const handleClearLinked = () => {
    setValue("linkedCustomerId", "", { shouldValidate: true });
    setLinkedSearch("");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/customers">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">New Customer</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Customer Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">

              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input id="name" {...register("name")} placeholder="Customer name" />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>

              {/* Mobile — required unless linked to another customer */}
              <div className="space-y-2">
                <Label htmlFor="mobile">
                  Mobile{mobileRequired ? " *" : " (optional — linked customer)"}
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
                {/* Client-side required hint when no link is set */}
                {mobileRequired && !mobileValid && !errors.mobile && (
                  <p className="text-xs text-muted-foreground">
                    Required unless linked to a family member above
                  </p>
                )}
              </div>

              {/* Linked Customer — family member search */}
              <div className="space-y-2 sm:col-span-2">
                <Label className="flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5" />
                  Linked to (family member)
                  <span className="text-xs text-muted-foreground font-normal ml-1">
                    — select if this customer shares a family account (e.g. daughter of a primary customer)
                  </span>
                </Label>

                {/* Hidden field */}
                <input type="hidden" {...register("linkedCustomerId")} />

                {linkedCustomerId ? (
                  // Show selected pill
                  <div className="flex items-center gap-2 rounded-md border px-3 py-2 bg-muted/40">
                    <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm flex-1 truncate">{linkedSearch}</span>
                    <button
                      type="button"
                      onClick={handleClearLinked}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  // Show search input
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      className="pl-9"
                      placeholder="Search by name or phone..."
                      value={linkedSearch}
                      onChange={(e) => {
                        setLinkedSearch(e.target.value);
                        setShowLinkedSearch(true);
                      }}
                      onFocus={() => setShowLinkedSearch(true)}
                      onBlur={() => setTimeout(() => setShowLinkedSearch(false), 150)}
                    />
                    {showLinkedSearch && linkedSearchResults?.customers?.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md">
                        {linkedSearchResults.customers.map((c: any) => (
                          <button
                            key={c.id}
                            type="button"
                            onMouseDown={() => handleSelectLinked(c)}
                            className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent text-left"
                          >
                            <span className="font-medium truncate">{c.name}</span>
                            <span className="text-xs text-muted-foreground ml-2 shrink-0">
                              {c.mobile?.startsWith("no-phone_") ? "No phone" : c.mobile}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {errors.linkedCustomerId && (
                  <p className="text-xs text-destructive">{errors.linkedCustomerId.message}</p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...register("email")} placeholder="Email address" />
              </div>

              {/* Address */}
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="address">Address</Label>
                <Textarea id="address" {...register("address")} rows={2} placeholder="Full address" />
              </div>

              {/* Occasion */}
              <div className="space-y-2">
                <Label htmlFor="occasion">Occasion</Label>
                <Input id="occasion" {...register("occasion")} placeholder="e.g., Wedding, Reception" />
              </div>

              {/* Notes */}
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" {...register("notes")} rows={2} placeholder="Any additional notes" />
              </div>
            </div>

            {createMutation.error && (
              <p className="text-sm text-destructive">{createMutation.error.message}</p>
            )}

            <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
              <Link href="/dashboard/customers" className="sm:order-1">
                <Button variant="outline" type="button" className="w-full">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={createMutation.isPending} className="sm:order-2">
                {createMutation.isPending ? "Creating..." : "Create Customer"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
