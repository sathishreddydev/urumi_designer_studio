"use client";

import { useParams } from "next/navigation";
import OrderForm from "@/components/order-form";

export default function EditOrderPage() {
  const params = useParams();
  return <OrderForm orderId={params.id as string} />;
}
