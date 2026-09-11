"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DEPENDENCY_TYPES = [
  "FABRIC",
  "LINING",
  "DYEING",
  "ACCESSORIES",
  "STONES",
  "CANVAS",
  "CUPS",
];

const CUSTOM_SENTINEL = "__custom__";

interface DependencyTypeSelectProps {
  value?: string;
  defaultValue?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  onValueChange?: (value: string) => void;
}

export function DependencyTypeSelect({
  value,
  defaultValue,
  name,
  required,
  disabled,
  onValueChange,
}: DependencyTypeSelectProps) {
  // Determine if the current value is a custom (non-list) type
  const isCustomValue = (v?: string) => !!v && !DEPENDENCY_TYPES.includes(v);

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
  }

  // ── Custom text input mode ────────────────────────────────────────────────

  if (customMode) {
    return (
      <div className="relative">
        <Input
          ref={inputRef}
          value={customText}
          onChange={handleCustomInput}
          placeholder="Type dependency type..."
          disabled={disabled}
          required={required}
          className="pr-8 text-xs h-8"
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
      <SelectTrigger className="h-8 rounded px-2 text-xs">
        <SelectValue placeholder="Select type" />
      </SelectTrigger>
      <SelectContent>
        {DEPENDENCY_TYPES.map((t) => (
          <SelectItem
            className="text-xs"
            key={t}
            value={t}
          >
            {t}
          </SelectItem>
        ))}

        {/* Custom option — always at the bottom */}
        <div className="border-t mt-1 pt-1">
          <SelectItem
            value={CUSTOM_SENTINEL}
            className="text-xs text-primary"
          >
            + Custom type...
          </SelectItem>
        </div>
      </SelectContent>
    </Select>
  );
}
