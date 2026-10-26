"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { type CustomerInput } from "@/lib/validations";
import Link from "next/link";
import { CustomerForm, type CustomerFormDefaultValues } from "@/components/customers/customer-form";

export default function EditCustomerPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: customer } = useQuery({
    queryKey: ["customer", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/customers/${params.id}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

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

  // Build defaultValues from the fetched customer
  const hasPlaceholder = customer.mobile?.startsWith("no-phone_");
  const hasLink = !!customer.linkedCustomerId;

  let linkedLabel: CustomerFormDefaultValues["linkedLabel"] = null;
  if (customer.linkedCustomer) {
    const phone = customer.linkedCustomer.mobile?.startsWith("no-phone_")
      ? "No phone"
      : (customer.linkedCustomer.mobile ?? "No phone");
    linkedLabel = { name: customer.linkedCustomer.name, phone };
  }

  const defaultValues: CustomerFormDefaultValues = {
    name: customer.name,
    mobile: hasPlaceholder ? "" : (customer.mobile ?? ""),
    email: customer.email || "",
    address: customer.address || "",
    occasion: customer.occasion || "",
    notes: customer.notes || "",
    linkedCustomerId: customer.linkedCustomerId || "",
    linkedLabel,
    startInLinkedMode: hasLink || hasPlaceholder,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/customers/${params.id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Edit Customer</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{customer.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <CustomerForm
            defaultValues={defaultValues}
            editingCustomerId={params.id as string}
            onSubmit={(data) => updateMutation.mutate(data)}
            isPending={updateMutation.isPending}
            error={updateMutation.error?.message}
            submitLabel="Save Changes"
            submitLoadingLabel="Saving..."
            cancelHref={`/dashboard/customers/${params.id}`}
          />
        </CardContent>
      </Card>
    </div>
  );
}
