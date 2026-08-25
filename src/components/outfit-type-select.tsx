"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
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

const ALL_TYPES = OUTFIT_TYPE_GROUPS.flatMap((g) => g.types);
const CUSTOM_SENTINEL = "__custom__";

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

  // Determine if the current value is a custom (non-list) type
  const isCustomValue = (v?: string) => !!v && !ALL_TYPES.includes(v);

  const [customMode, setCustomMode] = useState(() => isCustomValue(value ?? defaultValue));
  const [customText, setCustomText] = useState(() =>
    isCustomValue(value ?? defaultValue) ? (value ?? defaultValue ?? "") : "",
  );

  const inputRef = useRef<HTMLInputElement>(null);

  // Sync if parent changes value externally (e.g. form reset)
  useEffect(() => {
    if (value !== undefined) {
      if (isCustomValue(value)) {
        setCustomMode(true);
        setCustomText(value);
      } else {
        setCustomMode(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (customMode) inputRef.current?.focus();
  }, [customMode]);

  const normalizedSearch = search.trim().toLowerCase();

  function handleSelectChange(val: string) {
    if (val === CUSTOM_SENTINEL) {
      setCustomMode(true);
      setCustomText("");
      onValueChange?.("");
    } else {
      onValueChange?.(val);
    }
  }

  function handleCustomInput(e: React.ChangeEvent<HTMLInputElement>) {
    setCustomText(e.target.value);
    onValueChange?.(e.target.value);
  }

  function clearCustom() {
    setCustomMode(false);
    setCustomText("");
    onValueChange?.("");
    setSearch("");
  }

  // ── Custom text input mode ────────────────────────────────────────────────

  if (customMode) {
    return (
      <div className="relative">
        <Input
          ref={inputRef}
          value={customText}
          onChange={handleCustomInput}
          placeholder="Type outfit type..."
          disabled={disabled}
          required={required}
          className="pr-8 text-sm"
          // hidden input to carry the name for uncontrolled forms
        />
        {name && (
          <input type="hidden" name={name} value={customText} />
        )}
        {!disabled && (
          <button
            type="button"
            onClick={clearCustom}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            title="Back to list"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  // ── Normal select mode ────────────────────────────────────────────────────

  return (
    <Select
      value={value}
      defaultValue={defaultValue}
      name={name}
      required={required}
      disabled={disabled}
      onValueChange={handleSelectChange}
    >
      <SelectTrigger className="font-[inherit] text-sm leading-5">
        <SelectValue placeholder="Select outfit type" />
      </SelectTrigger>
      <SelectContent>
        {/* Search */}
        <div className="sticky top-0 z-10 flex justify-end bg-popover px-2 pb-2 pt-1 font-[inherit]">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="Search outfit types..."
            className="h-8 w-full pl-8 text-xs leading-4 sm:w-[220px]"
            aria-label="Search outfit types"
          />
        </div>

        {/* Groups */}
        {OUTFIT_TYPE_GROUPS.map((group) => {
          const matching = group.types.filter((t) =>
            t.toLowerCase().includes(normalizedSearch),
          );
          if (!matching.length) return null;
          return (
            <div key={group.label}>
              <p className="px-2 py-1 text-xs font-semibold leading-4 text-muted-foreground">
                {group.label}
              </p>
              {matching.map((type) => (
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

        {/* Custom option — always at the bottom */}
        <div className="border-t mt-1 pt-1">
          <SelectItem
            value={CUSTOM_SENTINEL}
            className="font-[inherit] text-sm leading-5 text-primary"
          >
            + Custom type...
          </SelectItem>
        </div>
      </SelectContent>
    </Select>
  );
}
