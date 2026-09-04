import { Suspense } from "react";
import OrderForm from "@/components/order-form";

export default function NewOrderPage() {
  return (
    <Suspense>
      <OrderForm />
    </Suspense>
  );
}
