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
import { ArrowLeft, Search, X, Link2, Phone } from "lucide-react";
import { customerSchema, type CustomerInput } from "@/lib/validations";
import Link from "next/link";
import { ContactPickerButton } from "@/components/contact-picker-button";
import { PhoneInput } from "@/components/phone-input";

export default function EditCustomerPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [useLinked, setUseLinked] = useState(false);
  const [linkedSearch, setLinkedSearch] = useState("");
  const [showLinkedDropdown, setShowLinkedDropdown] = useState(false);

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

  useEffect(() => {
    if (customer) {
      const hasPlaceholder = customer.mobile?.startsWith("no-phone_");
      const displayMobile = hasPlaceholder ? "" : (customer.mobile ?? "");
      const hasLink = !!customer.linkedCustomerId;

      reset({
        name: customer.name,
        mobile: displayMobile,
        email: customer.email || "",
        address: customer.address || "",
        occasion: customer.occasion || "",
        notes: customer.notes || "",
        linkedCustomerId: customer.linkedCustomerId || "",
      });

      // Start in linked mode if the customer already has a link or no real phone
      if (hasLink || hasPlaceholder) {
        setUseLinked(true);
        if (customer.linkedCustomer) {
          setLinkedSearch(customer.linkedCustomer.name);
        }
      }
    }
  }, [customer, reset]);

  const handleSelectLinked = (c: { id: string; name: string; mobile: string | null }) => {
    if (c.id === params.id) return;
    setValue("linkedCustomerId", c.id, { shouldValidate: true });
    setValue("mobile", "", { shouldValidate: true });
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
    setValue("linkedCustomerId", "", { shouldValidate: false });
    setValue("mobile", "", { shouldValidate: false });
  };

  const updateMutation = useMutation({
    mutationFn: async (data: CustomerInput) => {
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

              {/* Mobile OR Linked customer — toggled */}
              <div className="space-y-2">
                <input type="hidden" {...register("linkedCustomerId")} />

                {!useLinked ? (
                  <>
                    <Label>Mobile *</Label>
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
                  <>
                    <Label>Linked to (family member) *</Label>

                    {linkedCustomerId ? (
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
                              .filter((c: any) => c.id !== params.id)
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
