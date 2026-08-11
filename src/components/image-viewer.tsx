"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Download,
  RotateCw,
} from "lucide-react";

interface ImageViewerProps {
  images: { id: string; url: string; filename?: string; status?: string }[];
  initialIndex?: number;
  open: boolean;
  onClose: () => void;
  onDownloadSelected?: (ids: string[]) => void;
}

export function ImageViewer({
  images,
  initialIndex = 0,
  open,
  onClose,
  onDownloadSelected,
}: ImageViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [selectedForDownload, setSelectedForDownload] = useState<Set<string>>(new Set());

  useEffect(() => {
    setCurrentIndex(initialIndex);
    setZoom(1);
    setRotation(0);
  }, [initialIndex, open]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    function handleKey(e: KeyboardEvent) {
      switch (e.key) {
        case "ArrowLeft":
          goBack();
          break;
        case "ArrowRight":
          goForward();
          break;
        case "Escape":
          onClose();
          break;
        case "+":
        case "=":
          zoomIn();
          break;
        case "-":
          zoomOut();
          break;
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, currentIndex, images.length]);

  const goBack = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
    setZoom(1);
    setRotation(0);
  }, [images.length]);

  const goForward = useCallback(() => {
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
    setZoom(1);
    setRotation(0);
  }, [images.length]);

  const zoomIn = () => setZoom((prev) => Math.min(prev + 0.5, 4));
  const zoomOut = () => setZoom((prev) => Math.max(prev - 0.5, 0.5));
  const rotate = () => setRotation((prev) => (prev + 90) % 360);

  async function downloadImage(url: string, filename?: string) {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename || `reference-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch {
      // Fallback: open in new tab
      window.open(url, "_blank");
    }
  }

  function toggleSelectForDownload(id: string) {
    setSelectedForDownload((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function downloadSelected() {
    const selectedImages = images.filter((img) => selectedForDownload.has(img.id));
    for (const img of selectedImages) {
      await downloadImage(img.url, img.filename);
      // Small delay between downloads
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  if (!open || images.length === 0) return null;

  const current = images[currentIndex];

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/95">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80">
        <div className="flex items-center gap-2 text-white text-sm">
          <span>
            {currentIndex + 1} / {images.length}
          </span>
          {current.status && (
            <span className={`px-2 py-0.5 rounded text-xs ${
              current.status === "LOCKED" ? "bg-green-600" :
              current.status === "SELECTED" ? "bg-blue-600" : "bg-gray-600"
            }`}>
              {current.status}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20 h-8 w-8"
            onClick={zoomOut}
            title="Zoom out (-)"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-white text-xs w-10 text-center">{Math.round(zoom * 100)}%</span>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20 h-8 w-8"
            onClick={zoomIn}
            title="Zoom in (+)"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20 h-8 w-8"
            onClick={rotate}
            title="Rotate"
          >
            <RotateCw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20 h-8 w-8"
            onClick={() => downloadImage(current.url, current.filename)}
            title="Download"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20 h-8 w-8"
            onClick={onClose}
            title="Close (Esc)"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main image area */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center">
        {/* Navigation arrows */}
        {images.length > 1 && (
          <>
            <button
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
              onClick={goBack}
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
              onClick={goForward}
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}

        {/* Image */}
        <div
          className="transition-transform duration-200 ease-out touch-none"
          style={{
            transform: `scale(${zoom}) rotate(${rotation}deg)`,
          }}
        >
          <img
            src={current.url}
            alt={current.filename || "Reference image"}
            className="max-h-[calc(100vh-12rem)] max-w-[calc(100vw-4rem)] object-contain select-none"
            draggable={false}
          />
        </div>

        {/* Swipe hint for mobile */}
        {images.length > 1 && (
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/50 text-xs sm:hidden">
            Swipe or tap arrows to navigate
          </p>
        )}
      </div>

      {/* Thumbnail strip + download selected */}
      {images.length > 1 && (
        <div className="bg-black/80 px-4 py-2">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {images.map((img, i) => (
              <div key={img.id} className="relative shrink-0">
                <img
                  src={img.url}
                  alt=""
                  className={`h-12 w-12 rounded object-cover cursor-pointer border-2 transition-all ${
                    i === currentIndex ? "border-white" : "border-transparent opacity-60 hover:opacity-100"
                  }`}
                  onClick={() => { setCurrentIndex(i); setZoom(1); setRotation(0); }}
                />
                {/* Download selection checkbox */}
                <input
                  type="checkbox"
                  className="absolute top-0.5 right-0.5 h-3 w-3"
                  checked={selectedForDownload.has(img.id)}
                  onChange={() => toggleSelectForDownload(img.id)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            ))}

            {selectedForDownload.size > 0 && (
              <Button
                size="sm"
                variant="secondary"
                className="shrink-0 ml-2 h-8"
                onClick={downloadSelected}
              >
                <Download className="h-3 w-3" /> Download {selectedForDownload.size}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
