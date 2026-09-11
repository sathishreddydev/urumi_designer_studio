import { parsePhoneNumber, isValidPhoneNumber } from "libphonenumber-js";

/**
 * Format a phone number for display
 * @param phoneNumber - The phone number string (can be in E.164 format or local format)
 * @param format - The format to use: 'international', 'national', or 'e164'
 * @returns Formatted phone number or original if invalid
 */
export function formatPhoneNumber(
  phoneNumber: string | null | undefined,
  format: "international" | "national" | "e164" = "international"
): string {
  if (!phoneNumber) return "";
  
  try {
    // Check if the phone number is valid
    if (!isValidPhoneNumber(phoneNumber)) {
      return phoneNumber;
    }

    const parsed = parsePhoneNumber(phoneNumber);
    
    switch (format) {
      case "international":
        return parsed.formatInternational();
      case "national":
        return parsed.formatNational();
      case "e164":
        return parsed.format("E.164");
      default:
        return parsed.formatInternational();
    }
  } catch (error) {
    // If parsing fails, return the original number
    return phoneNumber;
  }
}

/**
 * Get the country code from a phone number
 * @param phoneNumber - The phone number string
 * @returns The country code (e.g., 'IN', 'US') or null if invalid
 */
export function getPhoneCountry(phoneNumber: string | null | undefined): string | null {
  if (!phoneNumber) return null;
  
  try {
    if (!isValidPhoneNumber(phoneNumber)) {
      return null;
    }
    
    const parsed = parsePhoneNumber(phoneNumber);
    return parsed.country || null;
  } catch (error) {
    return null;
  }
}

/**
 * Validate a phone number
 * @param phoneNumber - The phone number string
 * @returns True if valid, false otherwise
 */
export function validatePhoneNumber(phoneNumber: string | null | undefined): boolean {
  if (!phoneNumber) return false;
  
  try {
    return isValidPhoneNumber(phoneNumber);
  } catch (error) {
    return false;
  }
}
