export interface OutfitListItem {
  id: string;
  name: string;
  type: string;
  status: string;
  priority: number;
  maggamRequired: boolean;
  deliveryDate: string | Date | null;
  customerName: string | null;
  orderNumber: string | null;
  designerName: string | null;
  masterName: string | null;
  customerMaterialImageUrl: string | null;
  customerMaterialImages: { id: string; url: string }[];
}

export function isDeliveryUrgent(deliveryDate: OutfitListItem["deliveryDate"]): boolean {
  return Boolean(
    deliveryDate &&
      new Date(deliveryDate).getTime() < Date.now() + 3 * 24 * 60 * 60 * 1000
  );
}
