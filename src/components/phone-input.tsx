"use client";

import React from "react";
import PhoneInputWithCountry from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { cn } from "@/lib/utils";

interface PhoneInputProps {
  value?: string;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  defaultCountry?: string;
  className?: string;
}

export function PhoneInput({
  value,
  onChange,
  placeholder = "Enter phone number",
  disabled = false,
  defaultCountry = "IN",
  className,
}: PhoneInputProps) {
  return (
    <PhoneInputWithCountry
      international
      countryCallingCodeEditable={false}
      defaultCountry={defaultCountry as any}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      className={cn(
        "flex w-full rounded-md border border-input bg-background text-sm shadow-sm transition-colors",
        "focus-within:outline-none focus-within:ring-1 focus-within:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      numberInputProps={{
        className: cn(
          "flex h-9 w-full rounded-md border-0 bg-transparent px-3 py-1 text-sm shadow-none transition-colors",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50"
        ),
      }}
      countrySelectProps={{
        className: "border-0 bg-transparent focus:ring-0 focus:outline-none px-2",
      }}
    />
  );
}
