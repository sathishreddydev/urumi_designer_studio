"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { BookUser } from "lucide-react";

interface ContactPickerButtonProps {
  /** Called when user picks a contact. Provides name and phone. */
  onPick: (contact: { name: string; tel: string }) => void;
  className?: string;
}

/**
 * Shows a button that opens the native Contact Picker (Android Chrome / iOS Safari).
 * Silently renders nothing on unsupported browsers (desktop, Firefox).
 */
export function ContactPickerButton({ onPick, className }: ContactPickerButtonProps) {
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    // Contact Picker API check — only available on mobile browsers over HTTPS
    setSupported(
      typeof navigator !== "undefined" &&
      "contacts" in navigator &&
      "ContactsManager" in window
    );
  }, []);

  if (!supported) return null;

  async function handlePick() {
    try {
      const contacts = await (navigator as any).contacts.select(
        ["name", "tel"],
        { multiple: false }
      );

      if (!contacts || contacts.length === 0) return;

      const contact = contacts[0];
      const name = (contact.name?.[0] || "").trim();
      const raw = (contact.tel?.[0] || "").trim();
      // Strip non-digits, keep leading +
      const tel = raw.replace(/[^\d+]/g, "").replace(/^\+91/, "").slice(-10);

      if (tel) onPick({ name, tel });
    } catch {
      // User dismissed or permission denied — silently ignore
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={`h-10 w-10 shrink-0 ${className ?? ""}`}
      onClick={handlePick}
      title="Pick from contacts"
    >
      <BookUser className="h-4 w-4" />
    </Button>
  );
}
