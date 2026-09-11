"use client";

import React, { useState, useEffect } from "react";
import { parsePhoneNumber, getCountries, getCountryCallingCode } from "libphonenumber-js";
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
import { ChevronDown } from "lucide-react";

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
  const [selectedCountry, setSelectedCountry] = useState(defaultCountry);
  const [phoneNumber, setPhoneNumber] = useState("");

  // Parse existing value when component mounts or value changes externally
  useEffect(() => {
    if (value && value.startsWith("+")) {
      try {
        const parsed = parsePhoneNumber(value);
        if (parsed && parsed.country) {
          setSelectedCountry(parsed.country);
          setPhoneNumber(parsed.nationalNumber);
        }
      } catch {
        // If parsing fails, keep current state
      }
    } else if (!value) {
      setPhoneNumber("");
    }
  }, [value]);

  const handleCountryChange = (country: string) => {
    setSelectedCountry(country);
    updatePhoneValue(country, phoneNumber);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value.replace(/[^\d]/g, ""); // Only allow digits
    setPhoneNumber(input);
    updatePhoneValue(selectedCountry, input);
  };

  const updatePhoneValue = (country: string, number: string) => {
    if (!number) {
      onChange("");
      return;
    }

    try {
      const callingCode = getCountryCallingCode(country as any);
      const fullNumber = `+${callingCode}${number}`;
      onChange(fullNumber);
    } catch {
      onChange("");
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
    // Get country name from i18n-iso-countries library
    const name = countries.getName(countryCode, "en");
    return name || countryCode;
  };

  // Get all countries and sort them
  const allCountries = getCountries();
  const popularCountries = POPULAR_COUNTRIES.filter((c) => allCountries.includes(c as any));
  const otherCountries = allCountries
    .filter((c) => !POPULAR_COUNTRIES.includes(c))
    .sort((a, b) => getCountryName(a).localeCompare(getCountryName(b)));

  return (
    <div className={cn("relative flex items-center", className)}>
      {/* Country Selector - Positioned as prefix inside input */}
      <div className="absolute left-0 inset-y-0 flex items-center">
        <Select value={selectedCountry} onValueChange={handleCountryChange} disabled={disabled}>
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
        placeholder={placeholder}
        disabled={disabled}
        className="pl-[110px]"
      />
    </div>
  );
}
