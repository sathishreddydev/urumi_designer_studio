"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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

  // Pan offset when zoomed
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);

  // Container ref for non-passive touch listeners
  const containerRef = useRef<HTMLDivElement>(null);

  // Touch gesture tracking refs — avoid re-renders during gesture
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchStartPanX = useRef(0);
  const touchStartPanY = useRef(0);
  const pinchStartDist = useRef(0);
  const pinchStartZoom = useRef(1);
  const isPinching = useRef(false);

  // Keep latest state in refs so touch handlers (registered once) always see fresh values
  const zoomRef = useRef(zoom);
  const panXRef = useRef(panX);
  const panYRef = useRef(panY);
  zoomRef.current = zoom;
  panXRef.current = panX;
  panYRef.current = panY;

  // Navigation callbacks — stable, use functional state updaters
  const resetView = useCallback(() => {
    setZoom(1);
    setRotation(0);
    setPanX(0);
    setPanY(0);
  }, []);

  const goBack = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
    resetView();
  }, [images.length, resetView]);

  const goForward = useCallback(() => {
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
    resetView();
  }, [images.length, resetView]);

  const zoomIn  = useCallback(() => setZoom((prev) => Math.min(prev + 0.5, 5)), []);
  const zoomOut = useCallback(() => setZoom((prev) => Math.max(prev - 0.5, 0.5)), []);
  const rotate  = useCallback(() => setRotation((prev) => (prev + 90) % 360), []);

  // ── Reset on open / index change ─────────────────────────────────────────
  useEffect(() => {
    setCurrentIndex(initialIndex);
    resetView();
  }, [initialIndex, open]);

  // ── Keyboard navigation ───────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      switch (e.key) {
        case "ArrowLeft":       goBack();    break;
        case "ArrowRight":      goForward(); break;
        case "Escape":          onClose();   break;
        case "+": case "=":     zoomIn();    break;
        case "-":               zoomOut();   break;
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, goBack, goForward, onClose, zoomIn, zoomOut]);

  // ── Non-passive touch listeners on the container ──────────────────────────
  // React synthetic events can't call preventDefault() for passive listeners.
  // We register native listeners with { passive: false } to block browser zoom/scroll.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !open) return;

    function pinchDist(touches: TouchList): number {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.hypot(dx, dy);
    }

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length === 2) {
        isPinching.current = true;
        pinchStartDist.current = pinchDist(e.touches);
        pinchStartZoom.current = zoomRef.current;
      } else if (e.touches.length === 1) {
        isPinching.current = false;
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
        touchStartPanX.current = panXRef.current;
        touchStartPanY.current = panYRef.current;
      }
    }

    function onTouchMove(e: TouchEvent) {
      if (e.touches.length === 2 && isPinching.current) {
        e.preventDefault(); // block native pinch-zoom
        const dist = pinchDist(e.touches);
        if (pinchStartDist.current === 0) return;
        const scale = dist / pinchStartDist.current;
        const next = Math.min(Math.max(pinchStartZoom.current * scale, 0.5), 5);
        setZoom(next);
      } else if (e.touches.length === 1 && zoomRef.current > 1) {
        e.preventDefault(); // block page scroll while panning
        const dx = e.touches[0].clientX - touchStartX.current;
        const dy = e.touches[0].clientY - touchStartY.current;
        setPanX(touchStartPanX.current + dx);
        setPanY(touchStartPanY.current + dy);
      }
    }

    function onTouchEnd(e: TouchEvent) {
      if (isPinching.current) {
        // After releasing pinch, reset start values for a fresh pinch gesture
        isPinching.current = false;
        pinchStartDist.current = 0;
        pinchStartZoom.current = zoomRef.current;
        return;
      }

      // Swipe to navigate — only when not zoomed, single touch
      if (e.changedTouches.length === 1 && zoomRef.current <= 1) {
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        const dy = e.changedTouches[0].clientY - touchStartY.current;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        // Require ≥50px horizontal swipe that's more horizontal than vertical
        if (absDx > 50 && absDx > absDy * 1.5) {
          if (dx < 0) goForward();
          else goBack();
        }
      }
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove",  onTouchMove,  { passive: false });
    el.addEventListener("touchend",   onTouchEnd,   { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove",  onTouchMove);
      el.removeEventListener("touchend",   onTouchEnd);
    };
  }, [open, goBack, goForward]);

  // ── Download helpers ──────────────────────────────────────────────────────
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
          <span>{currentIndex + 1} / {images.length}</span>
          {current.status && (
            <span className={`px-2 py-0.5 rounded text-xs ${
              current.status === "LOCKED"   ? "bg-green-600" :
              current.status === "SELECTED" ? "bg-blue-600"  : "bg-gray-600"
            }`}>
              {current.status}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 h-8 w-8" onClick={zoomOut} title="Zoom out (-)">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-white text-xs w-10 text-center">{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 h-8 w-8" onClick={zoomIn} title="Zoom in (+)">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 h-8 w-8" onClick={rotate} title="Rotate">
            <RotateCw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 h-8 w-8" onClick={() => downloadImage(current.url, current.filename)} title="Download">
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 h-8 w-8" onClick={onClose} title="Close (Esc)">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main image area — native touch listeners attached via ref */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden flex items-center justify-center"
        style={{ touchAction: "none" }}
      >
        {/* Navigation arrows — desktop only */}
        {images.length > 1 && (
          <>
            <button
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 hidden sm:flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
              onClick={goBack}
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 hidden sm:flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
              onClick={goForward}
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}

        {/* Image */}
        <div
          className="w-full h-full flex items-center justify-center"
          style={{ overflow: "hidden", cursor: zoom > 1 ? "grab" : "zoom-in" }}
          onDoubleClick={() => {
            if (zoom === 1) { setZoom(2.5); }
            else { setZoom(1); setPanX(0); setPanY(0); }
          }}
        >
          <img
            src={current.url}
            alt={current.filename || "Reference image"}
            className="object-contain select-none"
            style={{
              maxHeight: zoom === 1 ? "calc(100vh - 10rem)" : "none",
              maxWidth:  zoom === 1 ? "calc(100vw - 4rem)"  : "none",
              width:  zoom > 1 ? `${zoom * 100}%` : "auto",
              height: "auto",
              transform: `rotate(${rotation}deg) translate(${panX / zoom}px, ${panY / zoom}px)`,
              transition: isPinching.current ? "none" : "transform 0.1s ease",
            }}
            draggable={false}
          />
        </div>

        {/* Hint */}
        {zoom === 1 && (
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/50 text-xs pointer-events-none select-none text-center">
            Swipe to navigate · Pinch to zoom · Double-tap to zoom
          </p>
        )}
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="bg-black/80 px-4 py-2">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {images.map((img, i) => (
              <div key={img.id} className="relative shrink-0">
                <img
                  src={img.url}
                  alt=""
                  className={`h-12 w-12 rounded object-cover cursor-pointer border-2 transition-all ${
                    i === currentIndex
                      ? "border-white"
                      : "border-transparent opacity-60 hover:opacity-100"
                  }`}
                  onClick={() => {
                    setCurrentIndex(i);
                    resetView();
                  }}
                />
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
