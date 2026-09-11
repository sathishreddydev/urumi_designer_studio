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
    <div className={cn("flex gap-2", className)}>
      <Select value={selectedCountry} onValueChange={handleCountryChange} disabled={disabled}>
        <SelectTrigger className="w-[140px]">
          <SelectValue>
            {selectedCountry} {getCountryCode(selectedCountry)}
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

      <Input
        type="tel"
        value={phoneNumber}
        onChange={handlePhoneChange}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1"
      />
    </div>
  );
}
