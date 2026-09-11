import { formatPhoneNumber } from "@/lib/phone-utils";
import { Phone } from "lucide-react";

interface PhoneDisplayProps {
  phoneNumber: string | null | undefined;
  format?: "international" | "national" | "e164";
  showIcon?: boolean;
  className?: string;
}

/**
 * Component to display formatted phone numbers
 * Usage: <PhoneDisplay phoneNumber="+919876543210" />
 */
export function PhoneDisplay({
  phoneNumber,
  format = "international",
  showIcon = true,
  className = "",
}: PhoneDisplayProps) {
  if (!phoneNumber) return null;

  const formatted = formatPhoneNumber(phoneNumber, format);

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {showIcon && <Phone className="h-3 w-3" />}
      <span>{formatted}</span>
    </span>
  );
}
