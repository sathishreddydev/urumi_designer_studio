"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, Camera, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { compressImage } from "@/lib/compress-image";

/* ══════════════════════════════════════════════════════════
   CAMERA CAPTURE MODAL
══════════════════════════════════════════════════════════ */
export function CameraCaptureModal({
  open,
  onClose,
  onCapture,
}: {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (!open) {
      if (stream) stream.getTracks().forEach((t) => t.stop());
      setStream(null);
      setError(null);
      return;
    }

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("This browser does not support camera capture.");
        return;
      }
      try {
        const ms = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        setStream(ms);
        if (videoRef.current) {
          videoRef.current.srcObject = ms;
          await videoRef.current.play();
        }
      } catch {
        setError("Camera access was blocked or unavailable. Please use Upload instead.");
      }
    }

    startCamera();
    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [open]);

  function handleCapture() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" });
        onCapture(file);
        onClose();
      },
      "image/jpeg",
      0.9
    );
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg space-y-1 rounded-2xl bg-background p-4 shadow-2xl sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <h4 className="text-sm font-semibold">Take Photo</h4>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-muted"
          >
            Close
          </button>
        </div>
        {error ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            {error}
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="aspect-video w-full rounded-lg bg-black object-cover"
          />
        )}
        <div className="mt-3 flex gap-2">
          <Button className="flex-1" onClick={handleCapture} disabled={!!error}>
            Capture
          </Button>
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   DESKTOP UPLOAD ZONE — drag-and-drop compact zone
══════════════════════════════════════════════════════════ */
export function DesktopUploadZone({
  outfitId,
  token,
  maggamRequired,
}: {
  outfitId: string;
  token: string;
  maggamRequired: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<{ url: string }[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  async function handleFiles(files: FileList | File[]) {
    setUploading(true);
    setUploadError(null);
    const arr = Array.from(files);
    for (const file of arr) {
      if (file.size > 20 * 1024 * 1024) {
        setUploadError(`"${file.name}" is over 20MB.`);
        continue;
      }
      try {
        const compressed = await compressImage(file);
        const fd = new FormData();
        fd.append("file", compressed);
        fd.append("outfitId", outfitId);
        fd.append("type", "PATTERN");
        const res = await fetch(`/api/portal/${token}/upload`, { method: "POST", body: fd });
        if (res.ok) {
          const d = await res.json();
          setUploaded((prev) => [...prev, { url: d.url }]);
        } else {
          const err = await res.json().catch(() => ({}));
          setUploadError(err?.error ?? "Upload failed.");
        }
      } catch {
        setUploadError("Upload failed. Please check your connection.");
      }
    }
    setUploading(false);
  }

  return (
    <label
      className={`block cursor-pointer rounded-lg border-2 border-dashed px-3 py-3 text-center transition-colors ${
        dragging
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/40 hover:bg-muted/30"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
    >
      <input
        type="file"
        className="hidden"
        accept="image/*,video/*"
        multiple
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
        disabled={uploading}
      />
      {uploading ? (
        <p className="text-xs text-muted-foreground">Uploading...</p>
      ) : (
        <>
          <Upload className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
          <p className="text-[10px] text-muted-foreground">Click to upload or drag and drop</p>
          <p className="text-[10px] text-muted-foreground">Images, videos up to 10MB</p>
        </>
      )}
      {uploadError && <p className="mt-1 text-[10px] text-destructive">{uploadError}</p>}
    </label>
  );
}

/* ══════════════════════════════════════════════════════════
   PORTAL UPLOAD — full upload UI (mobile / overview tab)
══════════════════════════════════════════════════════════ */
export function PortalUpload({
  outfitId,
  token,
  maggamRequired,
}: {
  outfitId: string;
  token: string;
  maggamRequired: boolean;
}) {
  const UPLOAD_TYPES = [
    { value: "PATTERN" as const, label: "Pattern", icon: "✨" },
    ...(maggamRequired ? [{ value: "MAGGAM" as const, label: "Maggam", icon: "🪡" }] : []),
    { value: "FABRIC" as const, label: "My Fabric", icon: "🧵" },
  ];

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<{ url: string; type: string }[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<"PATTERN" | "MAGGAM" | "FABRIC">("PATTERN");

  async function handleUpload(files: FileList | File | null) {
    if (!files) return;
    setUploading(true);
    setUploadError(null);
    const arr = files instanceof File ? [files] : Array.from(files);
    for (const file of arr) {
      if (file.size > 20 * 1024 * 1024) {
        setUploadError(`"${file.name}" is over 20MB.`);
        continue;
      }
      try {
        const compressed = await compressImage(file);
        const fd = new FormData();
        fd.append("file", compressed);
        fd.append("outfitId", outfitId);
        fd.append("type", selectedType);
        const res = await fetch(`/api/portal/${token}/upload`, { method: "POST", body: fd });
        if (res.ok) {
          const d = await res.json();
          setUploaded((p) => [...p, { url: d.url, type: selectedType }]);
        } else {
          const e = await res.json().catch(() => ({}));
          setUploadError(e?.error ?? `Could not upload "${file.name}".`);
        }
      } catch {
        setUploadError("Upload failed. Please check your connection.");
      }
    }
    setUploading(false);
  }

  return (
    <div className="space-y-3">
      {/* Type selector */}
      <div className="flex flex-wrap gap-2">
        {UPLOAD_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setSelectedType(t.value)}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
              selectedType === t.value
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {uploadError && (
        <div className="flex items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {uploaded.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {uploaded.map((item, i) => (
            <div key={i} className="relative h-12 w-12 rounded border overflow-hidden shrink-0">
              <img src={item.url} alt="Uploaded" className="object-cover w-full h-full" />
              <div className="absolute top-0.5 right-0.5 bg-green-500 rounded-full p-0.5">
                <Check className="h-2 w-2 text-white" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Drop zone */}
      <label className="block cursor-pointer rounded-xl border-2 border-dashed px-4 py-5 text-center hover:border-primary/40 hover:bg-muted/30 transition-colors">
        <input
          type="file"
          className="hidden"
          accept="image/*"
          multiple
          onChange={(e) => handleUpload(e.target.files)}
          disabled={uploading}
        />
        <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
        <p className="text-xs font-medium text-muted-foreground">Click to upload or drag and drop</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">Images, videos up to 10MB</p>
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <Button size="sm" variant="outline" className="w-full text-xs h-9" disabled={uploading} asChild>
            <span>
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              {uploading ? "Uploading..." : "Upload Photos"}
            </span>
          </Button>
          <input
            type="file"
            className="hidden"
            accept="image/*"
            multiple
            onChange={(e) => handleUpload(e.target.files)}
            disabled={uploading}
          />
        </label>
        <Button
          size="sm"
          variant="outline"
          className="w-full text-xs h-9"
          disabled={uploading}
          onClick={() => setCameraOpen(true)}
        >
          <Camera className="h-3.5 w-3.5 mr-1.5" /> Take Photo
        </Button>
      </div>

      <CameraCaptureModal
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(f) => handleUpload(f)}
      />
    </div>
  );
}
