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
import { ArrowLeft, Search, X, Link2, Phone } from "lucide-react";
import { customerSchema, type CustomerInput } from "@/lib/validations";
import Link from "next/link";
import { ContactPickerButton } from "@/components/contact-picker-button";
import { PhoneInput } from "@/components/phone-input";

export default function NewCustomerPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Controls whether we show the mobile input or the linked-customer search
  const [useLinked, setUseLinked] = useState(false);
  const [linkedSearch, setLinkedSearch] = useState("");
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
    defaultValues: { mobile: "", linkedCustomerId: "" },
  });

  const linkedCustomerId = useWatch({ control, name: "linkedCustomerId" });

  const handleSelectLinked = (c: { id: string; name: string; mobile: string | null }) => {
    setValue("linkedCustomerId", c.id, { shouldValidate: true });
    setValue("mobile", "", { shouldValidate: true }); // clear mobile when linking
    setLinkedSearch(c.name);
    setShowLinkedDropdown(false);
  };

  const handleSwitchToLinked = () => {
    setUseLinked(true);
    // Clear mobile when switching to linked mode
    setValue("mobile", "", { shouldValidate: false });
  };

  const handleSwitchToMobile = () => {
    setUseLinked(false);
    setLinkedSearch("");
    setValue("linkedCustomerId", "", { shouldValidate: false });
    setValue("mobile", "", { shouldValidate: false });
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

              {/* Mobile OR Linked customer — toggled */}
              <div className="space-y-2">
                {/* Hidden linked field always registered */}
                <input type="hidden" {...register("linkedCustomerId")} />

                {!useLinked ? (
                  /* ── MOBILE MODE ── */
                  <>
                    <Label htmlFor="mobile">Mobile *</Label>
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
                    {/* Toggle link */}
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
                  /* ── LINKED MEMBER MODE ── */
                  <>
                    <Label>Linked to (family member) *</Label>

                    {linkedCustomerId ? (
                      /* Selected pill */
                      <div className="flex items-center gap-2 rounded-md border px-3 py-2 bg-muted/40">
                        <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm flex-1 truncate">{linkedSearch}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setValue("linkedCustomerId", "", { shouldValidate: true });
                            setLinkedSearch("");
                          }}
                          className="text-muted-foreground hover:text-destructive"
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
                    {errors.mobile && (
                      <p className="text-xs text-destructive">{errors.mobile.message}</p>
                    )}

                    {/* Toggle back */}
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
                <Button variant="outline" type="button" className="w-full">Cancel</Button>
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
