"use client";

import React, { useState, useEffect } from "react";
import {
  parsePhoneNumber,
  getCountries,
  getCountryCallingCode,
  getExampleNumber,
} from "libphonenumber-js";
import examples from "libphonenumber-js/mobile/examples";
import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Register the locale for country names
countries.registerLocale(enLocale);

interface PhoneInputProps {
  value?: string;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  defaultCountry?: string;
  className?: string;
}

// Popular countries to show first
const POPULAR_COUNTRIES = ["IN", "US", "GB", "AU", "AE", "CA", "SG"];

export function PhoneInput({
  value = "",
  onChange,
  placeholder = "Enter phone number",
  disabled = false,
  defaultCountry = "IN",
  className,
}: PhoneInputProps) {
  // Parse initial value once
  const parseInitialValue = (val: string) => {
    if (!val) return { country: defaultCountry, number: "" };
    
    try {
      const parsed = parsePhoneNumber(val, defaultCountry as any);
      if (parsed && parsed.country) {
        return { country: parsed.country, number: parsed.nationalNumber };
      }
      // If not parseable as E.164, treat as raw digits
      return { country: defaultCountry, number: val.replace(/[^\d]/g, "") };
    } catch {
      return { country: defaultCountry, number: val.replace(/[^\d]/g, "") };
    }
  };

  const initial = parseInitialValue(value);
  const [selectedCountry, setSelectedCountry] = useState(initial.country);
  const [phoneNumber, setPhoneNumber] = useState(initial.number);

  // Only sync when value is cleared externally or changed to a completely different number
  useEffect(() => {
    // If external value is empty, clear our state
    if (!value) {
      setPhoneNumber("");
      return;
    }

    // If the current value we're holding would produce the external value, don't re-parse
    // (this prevents the loop when we call onChange ourselves)
    const currentE164 = phoneNumber 
      ? `+${getCountryCallingCode(selectedCountry as any)}${phoneNumber}`
      : "";
    
    if (currentE164 === value) {
      // This is our own value, don't re-parse
      return;
    }

    // External change detected (e.g., form reset or programmatic update)
    const parsed = parseInitialValue(value);
    setSelectedCountry(parsed.country);
    setPhoneNumber(parsed.number);
  }, [value]);

  const handleCountryChange = (country: string) => {
    setSelectedCountry(country);
    if (phoneNumber) {
      const callingCode = getCountryCallingCode(country as any);
      onChange(`+${callingCode}${phoneNumber}`);
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value.replace(/[^\d]/g, ""); // Only allow digits

    // Get the maximum length for the selected country
    const maxLength = getMaxLengthForCountry(selectedCountry);
    const restrictedInput = maxLength ? input.slice(0, maxLength) : input;

    setPhoneNumber(restrictedInput);

    // Send E.164 format to parent
    if (restrictedInput) {
      const callingCode = getCountryCallingCode(selectedCountry as any);
      onChange(`+${callingCode}${restrictedInput}`);
    } else {
      onChange("");
    }
  };

  const getMaxLengthForCountry = (country: string): number | null => {
    try {
      const exampleNumber = getExampleNumber(country as any, examples);
      return exampleNumber ? exampleNumber.nationalNumber.length : null;
    } catch {
      return null;
    }
  };

  const getPlaceholderForCountry = (country: string): string => {
    try {
      const exampleNumber = getExampleNumber(country as any, examples);
      return exampleNumber ? exampleNumber.nationalNumber : placeholder;
    } catch {
      return placeholder;
    }
  };

  const getCountryCode = (country: string) => {
    try {
      return `+${getCountryCallingCode(country as any)}`;
    } catch {
      return "";
    }
  };

  const getCountryName = (countryCode: string): string => {
    const name = countries.getName(countryCode, "en");
    return name || countryCode;
  };

  // Get all countries and sort them
  const allCountries = getCountries();
  const popularCountries = POPULAR_COUNTRIES.filter((c) =>
    allCountries.includes(c as any)
  );
  const otherCountries = allCountries
    .filter((c) => !POPULAR_COUNTRIES.includes(c))
    .sort((a, b) => getCountryName(a).localeCompare(getCountryName(b)));

  return (
    <div className={cn("relative flex items-center", className)}>
      {/* Country Selector - Positioned as prefix inside input */}
      <div className="absolute left-0 inset-y-0 flex items-center">
        <Select
          value={selectedCountry}
          onValueChange={handleCountryChange}
          disabled={disabled}
        >
          <SelectTrigger className="h-full border-0 bg-transparent hover:bg-accent focus:ring-0 focus:ring-offset-0 pl-3 pr-1 gap-1">
            <SelectValue>
              <span className="flex items-center gap-1 text-sm">
                {selectedCountry} {getCountryCode(selectedCountry)}
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {/* Popular Countries */}
            {popularCountries.map((country) => (
              <SelectItem key={country} value={country}>
                {country} {getCountryCode(country)} - {getCountryName(country)}
              </SelectItem>
            ))}
            {popularCountries.length > 0 && otherCountries.length > 0 && (
              <div className="border-t my-1" />
            )}
            {/* Other Countries */}
            {otherCountries.map((country) => (
              <SelectItem key={country} value={country}>
                {country} {getCountryCode(country)} - {getCountryName(country)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Phone Number Input - With left padding for the country selector */}
      <Input
        type="tel"
        value={phoneNumber}
        onChange={handlePhoneChange}
        placeholder={getPlaceholderForCountry(selectedCountry)}
        disabled={disabled}
        className="pl-[110px]"
      />
    </div>
  );
}