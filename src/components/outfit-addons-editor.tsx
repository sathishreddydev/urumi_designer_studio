"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface OutfitAddOn {
  id: string;
  name: string;
  price: string; // string in form state, converted to number on submit
  notes: string;
}

export function emptyAddOn(): OutfitAddOn {
  return { id: crypto.randomUUID(), name: "", price: "", notes: "" };
}

interface OutfitAddOnsEditorProps {
  addOns: OutfitAddOn[];
  onChange: (addOns: OutfitAddOn[]) => void;
  disabled?: boolean;
}

/**
 * Reusable editor for outfit add-ons (sourced items, e.g. dupatta, lining).
 * Manages its own list via the onChange callback — works in any outfit form.
 */
export function OutfitAddOnsEditor({
  addOns,
  onChange,
  disabled = false,
}: OutfitAddOnsEditorProps) {
  function updateAddOn(index: number, field: keyof OutfitAddOn, value: string) {
    const updated = addOns.map((a, i) =>
      i === index ? { ...a, [field]: value } : a,
    );
    onChange(updated);
  }

  function removeAddOn(index: number) {
    onChange(addOns.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5 text-primary" />
          Add-ons (Sourced Items)
        </Label>
        {!disabled && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onChange([...addOns, emptyAddOn()])}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Item
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Items sourced externally (e.g., dupatta) with separate pricing
      </p>

      {addOns.length > 0 && (
        <div className="space-y-2">
          {addOns.map((addOn, idx) => (
            <div
              key={addOn.id}
              className="flex gap-2 items-start p-2 border rounded-md"
            >
              <div className="flex-1 grid grid-cols-2 gap-2">
                <Input
                  placeholder="Item name"
                  value={addOn.name}
                  onChange={(e) => updateAddOn(idx, "name", e.target.value)}
                  className="h-8 text-xs"
                  disabled={disabled}
                />
                <Input
                  placeholder="Price"
                  type="number"
                  value={addOn.price}
                  onChange={(e) => updateAddOn(idx, "price", e.target.value)}
                  className="h-8 text-xs"
                  disabled={disabled}
                />
                <Input
                  placeholder="Notes (optional)"
                  value={addOn.notes}
                  onChange={(e) => updateAddOn(idx, "notes", e.target.value)}
                  className="h-8 text-xs col-span-2"
                  disabled={disabled}
                />
              </div>
              {!disabled && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => removeAddOn(idx)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
