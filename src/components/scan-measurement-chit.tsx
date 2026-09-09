"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Camera, Loader2, ScanLine, Upload, X, CheckCircle2, Pencil } from "lucide-react";
import { CameraCaptureModal } from "@/components/camera-capture-modal";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScanMeasurementChitProps {
  /** Called with the confirmed measurement values to apply to the form */
  onApply: (values: Record<string, string>) => void;
  disabled?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ScanMeasurementChit({ onApply, disabled }: ScanMeasurementChitProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [cameraOpen, setCameraOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [scannedFile, setScannedFile] = useState<File | null>(null);
  const [results, setResults] = useState<Record<string, string> | null>(null);
  const [editedResults, setEditedResults] = useState<Record<string, string>>({});
  const [dialogOpen, setDialogOpen] = useState(false);

  // ── Scan image via AI API ──────────────────────────────────────────────────

  async function scanImage(file: File) {
    // Show preview immediately
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setScannedFile(file);
    setScanning(true);
    setResults(null);
    setDialogOpen(true);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch("/api/ai/scan-measurements", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "AI scan failed");
      }

      setResults(data.measurements);
      setEditedResults({ ...data.measurements });

      toast({
        title: `${data.count} measurement${data.count === 1 ? "" : "s"} found`,
        description: "Review and confirm before applying.",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Scan failed",
        description: err instanceof Error ? err.message : "Could not read measurements from image.",
      });
      setDialogOpen(false);
    } finally {
      setScanning(false);
    }
  }

  // ── Handle file upload ─────────────────────────────────────────────────────

  function handleFileChange(e: { target: HTMLInputElement }) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    scanImage(file);
  }

  // ── Handle camera capture ──────────────────────────────────────────────────

  function handleCameraCapture(file: File) {
    setCameraOpen(false);
    scanImage(file);
  }

  // ── Confirm & apply ────────────────────────────────────────────────────────

  function handleApply() {
    // Filter out empty values
    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(editedResults)) {
      const val = String(v);
      if (val.trim() !== "") cleaned[k] = val.trim();
    }
    if (Object.keys(cleaned).length === 0) {
      toast({ variant: "destructive", title: "No values to apply" });
      return;
    }
    onApply(cleaned);
    handleClose();
    toast({
      title: `${Object.keys(cleaned).length} field${Object.keys(cleaned).length === 1 ? "" : "s"} applied`,
      description: "Measurements filled from scanned chit.",
    });
  }

  // ── Rescan same image ──────────────────────────────────────────────────────

  function handleRescan() {
    if (scannedFile) scanImage(scannedFile);
  }

  // ── Close dialog ───────────────────────────────────────────────────────────

  function handleClose() {
    setDialogOpen(false);
    setResults(null);
    setEditedResults({});
    setScanning(false);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setScannedFile(null);
  }

  // ── Remove a field from results ────────────────────────────────────────────

  function removeField(key: string) {
    const copy = { ...editedResults };
    delete copy[key];
    setEditedResults(copy);
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Trigger buttons ── */}
      <div className="flex flex-wrap gap-2">
        {/* Upload button */}
        <label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || scanning}
            asChild
            className="gap-1.5 cursor-pointer"
          >
            <span>
              <ScanLine className="h-3.5 w-3.5 text-primary" />
              AI Scan
            </span>
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*"
            onChange={handleFileChange}
          />
        </label>

        {/* Camera button */}
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || scanning}
          onClick={() => setCameraOpen(true)}
          className="gap-1.5"
        >
          <Camera className="h-3.5 w-3.5 text-primary" />
          AI Camera
        </Button>
      </div>

      {/* ── Camera modal ── */}
      <CameraCaptureModal
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={handleCameraCapture}
      />

      {/* ── Results dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={(open: boolean) => { if (!open) handleClose(); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ScanLine className="h-4 w-4 text-primary" />
              AI Measurement Scan
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {/* Image preview */}
            {previewUrl && (
              <div className="relative rounded-lg overflow-hidden border bg-muted/30">
                <img
                  src={previewUrl}
                  alt="Scanned chit"
                  className="w-full max-h-48 object-contain"
                />
                {scanning && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 gap-2">
                    <Loader2 className="h-8 w-8 text-white animate-spin" />
                    <p className="text-white text-sm font-medium">Reading measurements...</p>
                  </div>
                )}
              </div>
            )}

            {/* Scanning state */}
            {scanning && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                AI is reading your measurement chit...
              </div>
            )}

            {/* Results */}
            {!scanning && results && (
              <div className="space-y-3">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  <p className="text-sm font-medium">
                    {Object.keys(editedResults).length} measurement{Object.keys(editedResults).length === 1 ? "" : "s"} found
                  </p>
                  <span className="text-xs text-muted-foreground ml-1">— edit values before applying</span>
                </div>

                <div className="rounded-md border divide-y">
                  {Object.entries(editedResults).map(([field, value]) => (
                    <div key={field} className="flex items-center gap-2 px-3 py-2">
                      {/* Field name */}
                      <span className="text-xs text-muted-foreground flex-1 min-w-0 truncate" title={field}>
                        {field}
                      </span>
                      {/* Editable value */}
                      <div className="relative flex items-center w-24 shrink-0">
                        <Pencil className="absolute left-2 h-3 w-3 text-muted-foreground pointer-events-none" />
                        <Input
                          value={value}
                          onChange={(e: { target: HTMLInputElement }) =>
                            setEditedResults((prev: Record<string, string>) => ({ ...prev, [field]: e.target.value }))
                          }
                          inputMode="decimal"
                          className="h-7 text-xs pl-6 pr-5 text-right"
                        />
                        <span className="absolute right-2 text-[10px] text-muted-foreground pointer-events-none">"</span>
                      </div>
                      {/* Remove */}
                      <button
                        type="button"
                        onClick={() => removeField(field)}
                        className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                        title="Remove this field"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {Object.keys(editedResults).length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    All fields removed. Upload a different image.
                  </p>
                )}

                <p className="text-[11px] text-muted-foreground">
                  These values will be merged into your form. Existing values will be overwritten only where AI found a match.
                </p>
              </div>
            )}

            {/* No results state */}
            {!scanning && !results && (
              <div className="text-center py-4 text-muted-foreground text-sm">
                <Upload className="h-8 w-8 mx-auto mb-2 opacity-40" />
                Upload or take a photo of a measurement chit to scan.
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" onClick={handleClose}>
              Cancel
            </Button>
            {!scanning && scannedFile && (
              <Button variant="outline" size="sm" onClick={handleRescan}>
                Rescan
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleApply}
              disabled={scanning || Object.keys(editedResults).length === 0}
              className="gap-1.5"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Apply to Form
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
