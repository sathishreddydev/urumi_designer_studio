"use client";

import { useEffect, useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { ImageViewer } from "@/components/image-viewer";

/* ══════════════════════════════════════════════════════════
   PORTAL REFERENCE CARD
══════════════════════════════════════════════════════════ */
export function PortalReferenceCard({
  reference,
  token,
  outfitId,
  canApprove,
  onImageClick,
  onDelete,
}: {
  reference: any;
  token: string;
  outfitId: string;
  canApprove: boolean;
  onImageClick: () => void;
  onDelete: (id: string) => void;
}) {
  const [feedback, setFeedback] = useState<"approved" | "rejected" | null>(
    reference.customerFeedback || null
  );
  const [loading, setLoading] = useState(false);

  // Sync when parent re-fetches (live polling updates customerFeedback)
  useEffect(() => {
    setFeedback(reference.customerFeedback || null);
  }, [reference.customerFeedback]);

  async function handleFeedback(action: "approved" | "rejected") {
    setLoading(true);
    try {
      const res = await fetch(`/api/portal/${token}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceId: reference.id, outfitId, feedback: action }),
      });
      if (res.ok) setFeedback(action);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this image?")) return;
    try {
      const res = await fetch(`/api/portal/${token}/upload?referenceId=${reference.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onDelete(reference.id);
      } else {
        const e = await res.json().catch(() => ({}));
        alert(e?.error || "Failed to delete image");
      }
    } catch {
      alert("Failed to delete image. Please try again.");
    }
  }

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md">
      <div
        className="relative aspect-[4/5] cursor-pointer overflow-hidden bg-muted"
        onClick={onImageClick}
      >
        <img
          src={reference.url}
          alt="Outfit Reference"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {reference.type !== "COMPLETION" && (
          <span
            className={`absolute top-1.5 left-1.5 text-[9px] font-semibold px-1.5 py-0.5 rounded shadow-sm ${
              reference.type === "FABRIC"
                ? "bg-indigo-600 text-white"
                : reference.type === "MAGGAM"
                ? "bg-amber-600 text-white"
                : "bg-slate-700 text-white"
            }`}
          >
            {reference.type === "FABRIC"
              ? "Your Fabric"
              : reference.type === "MAGGAM"
              ? "Maggam"
              : "Pattern"}
          </span>
        )}
        {feedback && (
          <div
            className={`absolute top-1.5 right-1.5 rounded-full p-1 shadow-md ${
              feedback === "approved" ? "bg-green-600" : "bg-destructive"
            }`}
          >
            {feedback === "approved" ? (
              <ThumbsUp className="h-3 w-3 text-white" />
            ) : (
              <ThumbsDown className="h-3 w-3 text-white" />
            )}
          </div>
        )}
      </div>

      {reference.type !== "FABRIC" && canApprove && !feedback && (
        <div className="grid grid-cols-2 gap-px bg-border text-[11px]">
          <button
            className="bg-card hover:bg-green-50 text-green-700 py-1.5 font-medium flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
            onClick={() => handleFeedback("approved")}
            disabled={loading}
          >
            Approve
          </button>
          <button
            className="bg-card hover:bg-red-50 text-destructive py-1.5 font-medium flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
            onClick={() => handleFeedback("rejected")}
            disabled={loading}
          >
            Reject
          </button>
        </div>
      )}
      {reference.type === "FABRIC" && (
        <div className="py-1 text-center text-[10px] font-semibold text-indigo-700 bg-indigo-50">
          Read only
        </div>
      )}
      {feedback && reference.type !== "FABRIC" && (
        <div
          className={`py-1 text-center text-[10px] font-semibold text-white ${
            feedback === "approved" ? "bg-green-600" : "bg-destructive"
          }`}
        >
          {feedback === "approved" ? "Approved" : "Rejected"}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   PORTAL REFERENCES — full grid (desktop + mobile references tab)
══════════════════════════════════════════════════════════ */
export function PortalReferences({
  references,
  token,
  outfitId,
  canApprove,
}: {
  references: any[];
  token: string;
  outfitId: string;
  canApprove: boolean;
}) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [localRefs, setLocalRefs] = useState(references);

  useEffect(() => {
    setLocalRefs(references);
  }, [references]);

  const handleDelete = (id: string) =>
    setLocalRefs((prev: any[]) => prev.filter((r) => r.id !== id));

  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {localRefs.map((ref: any, i: number) => (
          <PortalReferenceCard
            key={ref.id}
            reference={ref}
            token={token}
            outfitId={outfitId}
            canApprove={canApprove}
            onImageClick={() => {
              setViewerIndex(i);
              setViewerOpen(true);
            }}
            onDelete={handleDelete}
          />
        ))}
      </div>
      <ImageViewer
        images={localRefs.map((r: any) => ({ id: r.id, url: r.url, filename: r.filename }))}
        initialIndex={viewerIndex}
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />
    </>
  );
}

/* ══════════════════════════════════════════════════════════
   INLINE PHOTO STRIP — horizontal thumbnail row (desktop outfit row)
══════════════════════════════════════════════════════════ */
export function InlinePhotoStrip({
  references,
  token,
  outfitId,
  canApprove,
}: {
  references: any[];
  token: string;
  outfitId: string;
  canApprove: boolean;
}) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [localRefs, setLocalRefs] = useState(references);
  const MAX_VISIBLE = 4;

  useEffect(() => {
    setLocalRefs(references);
  }, [references]);

  const visible = localRefs.slice(0, MAX_VISIBLE);
  const overflow = localRefs.length - MAX_VISIBLE;

  return (
    <>
      <div className="flex items-center gap-1.5 flex-wrap">
        {visible.map((ref: any, i: number) => (
          <DesktopRefThumb
            key={ref.id}
            reference={ref}
            token={token}
            outfitId={outfitId}
            canApprove={canApprove}
            onClick={() => {
              setViewerIndex(i);
              setViewerOpen(true);
            }}
          />
        ))}
        {overflow > 0 && (
          <button
            onClick={() => {
              setViewerIndex(MAX_VISIBLE);
              setViewerOpen(true);
            }}
            className="h-14 w-14 rounded-lg border bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground hover:bg-muted/80 transition-colors shrink-0"
          >
            +{overflow}
          </button>
        )}
      </div>
      <ImageViewer
        images={localRefs.map((r: any) => ({ id: r.id, url: r.url, filename: r.filename }))}
        initialIndex={viewerIndex}
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />
    </>
  );
}

function DesktopRefThumb({
  reference,
  token,
  outfitId,
  canApprove,
  onClick,
}: {
  reference: any;
  token: string;
  outfitId: string;
  canApprove: boolean;
  onClick: () => void;
}) {
  const [feedback, setFeedback] = useState<"approved" | "rejected" | null>(
    reference.customerFeedback || null
  );
  const [loading, setLoading] = useState(false);

  // Sync when parent re-fetches
  useEffect(() => {
    setFeedback(reference.customerFeedback || null);
  }, [reference.customerFeedback]);

  async function handleFeedback(action: "approved" | "rejected") {
    setLoading(true);
    try {
      const res = await fetch(`/api/portal/${token}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceId: reference.id, outfitId, feedback: action }),
      });
      if (res.ok) setFeedback(action);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="group relative shrink-0">
      <div
        className="h-14 w-14 rounded-lg overflow-hidden border cursor-pointer bg-muted relative"
        onClick={onClick}
      >
        <img
          src={reference.url}
          alt=""
          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
        />
        {feedback && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            {feedback === "approved" ? (
              <ThumbsUp className="h-4 w-4 text-white" />
            ) : (
              <ThumbsDown className="h-4 w-4 text-white" />
            )}
          </div>
        )}
      </div>
      {canApprove && reference.type !== "FABRIC" && !feedback && (
        <div className="absolute -bottom-4 left-0 right-0 hidden group-hover:flex gap-px z-10">
          <button
            onClick={() => handleFeedback("approved")}
            disabled={loading}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white text-[9px] py-0.5 rounded-bl-lg font-medium transition-colors disabled:opacity-50"
          >
            ✓
          </button>
          <button
            onClick={() => handleFeedback("rejected")}
            disabled={loading}
            className="flex-1 bg-red-500 hover:bg-red-600 text-white text-[9px] py-0.5 rounded-br-lg font-medium transition-colors disabled:opacity-50"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MOBILE PHOTO STRIP — compact horizontal strip
══════════════════════════════════════════════════════════ */
export function MobilePhotoStrip({
  references,
  token,
  outfitId,
  canApprove,
}: {
  references: any[];
  token: string;
  outfitId: string;
  canApprove: boolean;
}) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const MAX_VISIBLE = 4;
  const visible = references.slice(0, MAX_VISIBLE);
  const overflow = references.length - MAX_VISIBLE;

  return (
    <>
      <div className="flex items-center gap-2">
        {visible.map((ref: any, i: number) => (
          <button
            key={ref.id}
            onClick={() => {
              setViewerIndex(i);
              setViewerOpen(true);
            }}
            className="h-14 w-14 rounded-lg overflow-hidden border bg-muted shrink-0"
          >
            <img src={ref.url} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
        {overflow > 0 && (
          <button
            onClick={() => {
              setViewerIndex(MAX_VISIBLE);
              setViewerOpen(true);
            }}
            className="h-14 w-14 rounded-lg border bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground shrink-0"
          >
            +{overflow}
          </button>
        )}
      </div>
      <ImageViewer
        images={references.map((r: any) => ({ id: r.id, url: r.url, filename: r.filename }))}
        initialIndex={viewerIndex}
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />
    </>
  );
}
