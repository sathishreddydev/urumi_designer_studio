"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const WHATSAPP_NOTIFICATIONS_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_WHATSAPP_NOTIFICATIONS !== "false";

export interface WhatsAppNotificationPrompt {
  customerName: string;
  url: string;
}

interface WhatsAppNotificationDialogProps {
  prompt: WhatsAppNotificationPrompt | null;
  onClose: () => void;
}

export function WhatsAppNotificationDialog({
  prompt,
  onClose,
}: WhatsAppNotificationDialogProps) {
  if (!WHATSAPP_NOTIFICATIONS_ENABLED) return null;

  return (
    <AlertDialog
      open={!!prompt}
      onOpenChange={(open: boolean) => !open && onClose()}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Notify Customer</AlertDialogTitle>
          <AlertDialogDescription>
            Outfit is ready! Would you like to notify {prompt?.customerName} via
            WhatsApp?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Skip</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (prompt?.url) window.open(prompt.url, "_blank", "noopener,noreferrer");
              onClose();
            }}
          >
            Send WhatsApp
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
