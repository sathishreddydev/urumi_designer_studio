"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/pagination";
import { Plus, Search, Phone, Mail } from "lucide-react";
import Link from "next/link";

const LIMIT = 20;

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["customers", search, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      params.set("page", String(page));
      params.set("limit", String(LIMIT));
      const res = await fetch(`/api/customers?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-xs text-muted-foreground">{data?.total || 0} total</p>
        </div>
        <Link href="/dashboard/customers/new">
          <Button className="w-full sm:w-auto">
            <Plus className="h-4 w-4" /> Add Customer
          </Button>
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, mobile, or email..."
          className="pl-10"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-28 pt-6" />
            </Card>
          ))}
        </div>
      ) : data?.customers?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground">
              {search ? "No customers match your search" : "No customers found"}
            </p>
            {!search && (
              <p className="text-sm text-muted-foreground">Create your first customer to get started</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data?.customers?.map((customer: any) => (
              <Link key={customer.id} href={`/dashboard/customers/${customer.id}`}>
                <Card className="cursor-pointer transition-shadow hover:shadow-md h-full">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{customer.name}</CardTitle>
                      {customer.orders?.length > 0 && (
                        <Badge variant="secondary">{customer.orders.length}</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Phone className="h-3 w-3" /> {customer.mobile}
                    </div>
                    {customer.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-3 w-3" /> {customer.email}
                      </div>
                    )}
                    {customer.occasion && (
                      <Badge variant="outline" className="mt-2">{customer.occasion}</Badge>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          <Pagination page={page} total={data?.total || 0} limit={LIMIT} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
