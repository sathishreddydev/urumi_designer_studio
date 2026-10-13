"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingButton } from "@/components/ui/loading-button";
import { ArrowLeft, Search, X, Link2 } from "lucide-react";
import { customerSchema, type CustomerInput } from "@/lib/validations";
import Link from "next/link";
import { ContactPickerButton } from "@/components/contact-picker-button";
import { PhoneInput } from "@/components/phone-input";
import { isValidPhoneNumber } from "libphonenumber-js";

export default function EditCustomerPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [linkedSearch, setLinkedSearch] = useState("");
  const [showLinkedSearch, setShowLinkedSearch] = useState(false);

  const { data: customer } = useQuery({
    queryKey: ["customer", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/customers/${params.id}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

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
  });

  const linkedCustomerId = useWatch({ control, name: "linkedCustomerId" });
  const mobileValue = useWatch({ control, name: "mobile" });
  const mobileRequired = !linkedCustomerId;
  const mobileValid = mobileValue && isValidPhoneNumber(mobileValue);

  useEffect(() => {
    if (customer) {
      // Don't expose the internal no-phone placeholder in the UI
      const displayMobile = customer.mobile?.startsWith("no-phone_")
        ? ""
        : (customer.mobile ?? "");

      reset({
        name: customer.name,
        mobile: displayMobile,
        email: customer.email || "",
        address: customer.address || "",
        occasion: customer.occasion || "",
        notes: customer.notes || "",
        linkedCustomerId: customer.linkedCustomerId || "",
      });

      // Pre-fill linked search display label if a link exists
      if (customer.linkedCustomer) {
        setLinkedSearch(customer.linkedCustomer.name);
      }
    }
  }, [customer, reset]);

  const handleSelectLinked = (c: { id: string; name: string; mobile: string | null }) => {
    // Prevent linking to self
    if (c.id === params.id) return;
    setValue("linkedCustomerId", c.id, { shouldValidate: true });
    setLinkedSearch(c.name);
    setShowLinkedSearch(false);
  };

  const handleClearLinked = () => {
    setValue("linkedCustomerId", "", { shouldValidate: true });
    setLinkedSearch("");
  };

  const updateMutation = useMutation({
    mutationFn: async (data: CustomerInput) => {
      // When mobile is blank (family member flow), send undefined so the API keeps placeholder
      const payload = {
        ...data,
        mobile: data.mobile?.trim() ? data.mobile.trim() : undefined,
      };
      const res = await fetch(`/api/customers/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer", params.id] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      router.push(`/dashboard/customers/${params.id}`);
    },
  });

  if (!customer) {
    return <div className="h-8 w-48 animate-pulse rounded bg-muted" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/customers/${params.id}`}>
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="text-2xl font-bold">Edit Customer</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{customer.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit((d) => updateMutation.mutate(d))} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">

              {/* Name */}
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input {...register("name")} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>

              {/* Mobile */}
              <div className="space-y-2">
                <Label>
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
              </div>

              {/* Linked Customer */}
              <div className="space-y-2 sm:col-span-2">
                <Label className="flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5" />
                  Linked to (family member)
                  <span className="text-xs text-muted-foreground font-normal ml-1">
                    — select if this customer shares a family account
                  </span>
                </Label>

                <input type="hidden" {...register("linkedCustomerId")} />

                {linkedCustomerId ? (
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
                        {linkedSearchResults.customers
                          .filter((c: any) => c.id !== params.id) // exclude self
                          .map((c: any) => (
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
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" {...register("email")} />
              </div>

              {/* Address */}
              <div className="space-y-2 sm:col-span-2">
                <Label>Address</Label>
                <Textarea {...register("address")} rows={2} />
              </div>

              {/* Occasion */}
              <div className="space-y-2">
                <Label>Occasion</Label>
                <Input {...register("occasion")} />
              </div>

              {/* Notes */}
              <div className="space-y-2 sm:col-span-2">
                <Label>Notes</Label>
                <Textarea {...register("notes")} rows={2} />
              </div>
            </div>

            {updateMutation.error && (
              <p className="text-sm text-destructive">{updateMutation.error.message}</p>
            )}

            <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
              <Link href={`/dashboard/customers/${params.id}`}>
                <Button variant="outline" type="button" className="w-full">Cancel</Button>
              </Link>
              <LoadingButton type="submit" loading={updateMutation.isPending} loadingText="Saving...">
                Save Changes
              </LoadingButton>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
