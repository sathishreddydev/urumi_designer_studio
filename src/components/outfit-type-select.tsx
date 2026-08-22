"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const OUTFIT_TYPE_GROUPS = [
  {
    label: "Women",
    types: [
      "Bridal Blouse", "Reception Blouse", "Saree Blouse", "Lehenga",
      "Gown", "Anarkali", "Sharara", "Salwar Suit", "Churidar",
      "Palazzo Suit", "Half Saree", "Pattu Pavadai", "Pico", "Fall",
      "Tassels", "Saree Border", "Saree Pallu", "Bridal Veil",
      "Bridal Dupatta", "Bridal Cape", "Bridal Waist Belt", "Bridal Trail",
      "Bridal Potli", "Women Other",
    ],
  },
  {
    label: "Men",
    types: [
      "Kurta", "Sherwani", "Nehru Jacket", "Waistcoat", "Shirt",
      "Trousers", "Dhoti", "Indo-Western", "Men Other",
    ],
  },
  { label: "Other", types: ["Other"] },
];

interface OutfitTypeSelectProps {
  value?: string;
  defaultValue?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  onValueChange?: (value: string) => void;
}

export function OutfitTypeSelect({
  value,
  defaultValue,
  name,
  required,
  disabled,
  onValueChange,
}: OutfitTypeSelectProps) {
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLowerCase();

  return (
    <Select
      value={value}
      defaultValue={defaultValue}
      name={name}
      required={required}
      disabled={disabled}
      onValueChange={onValueChange}
    >
      <SelectTrigger className="font-[inherit] text-sm leading-5">
        <SelectValue placeholder="Select outfit type" />
      </SelectTrigger>
      <SelectContent>
        <div className="sticky top-0 z-10 flex justify-end bg-popover px-2 pb-2 pt-1 font-[inherit]">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => event.stopPropagation()}
            placeholder="Search outfit types..."
            className="h-8 w-full pl-8 text-xs leading-4 sm:w-[220px]"
            aria-label="Search outfit types"
          />
        </div>
        {OUTFIT_TYPE_GROUPS.map((group) => {
          const matchingTypes = group.types.filter((type) =>
            type.toLowerCase().includes(normalizedSearch),
          );
          if (matchingTypes.length === 0) return null;

          return (
            <div key={group.label}>
              <p className="px-2 py-1 text-xs font-semibold leading-4 text-muted-foreground">
                {group.label}
              </p>
              {matchingTypes.map((type) => (
                <SelectItem
                  key={type}
                  value={type}
                  className="font-[inherit] text-sm leading-5"
                >
                  {type}
                </SelectItem>
              ))}
            </div>
          );
        })}
      </SelectContent>
    </Select>
  );
}
