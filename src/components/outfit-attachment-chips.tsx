"use client";

interface ReferenceImage {
  id: string;
  url: string;
  filename?: string | null;
  type?: string | null;
}

interface OutfitAttachmentChipsProps {
  references: ReferenceImage[];
  /** Called when the user clicks a chip — open your image viewer with these images */
  onOpen: (images: { id: string; url: string; filename?: string | null }[]) => void;
  /** Compact mode: smaller chips, no card wrapper, returns null when empty (used in list views) */
  compact?: boolean;
}

const GROUPS = [
  {
    label: "Pattern",
    filter: (r: ReferenceImage) => r.type === "PATTERN",
    color:
      "bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100 dark:bg-violet-950/30 dark:text-violet-300 dark:border-violet-800",
  },
  {
    label: "Customer Material",
    filter: (r: ReferenceImage) => r.type === "FABRIC",
    color:
      "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800",
  },
  {
    label: "Maggam",
    filter: (r: ReferenceImage) => r.type === "MAGGAM",
    color:
      "bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100 dark:bg-pink-950/30 dark:text-pink-300 dark:border-pink-800",
  },
  {
    label: "Completion",
    filter: (r: ReferenceImage) => r.type === "COMPLETION",
    color:
      "bg-green-50 text-green-700 border-green-200 hover:bg-green-100 dark:bg-green-950/30 dark:text-green-300 dark:border-green-800",
  },
] as const;

export function OutfitAttachmentChips({
  references,
  onOpen,
  compact = false,
}: OutfitAttachmentChipsProps) {
  const groups = GROUPS.map((g) => ({
    label: g.label,
    color: g.color,
    refs: references.filter(g.filter),
  })).filter((g) => g.refs.length > 0);

  if (groups.length === 0) {
    if (compact) return null;
    return (
      <div className="bg-muted/40 p-2.5 rounded-md text-xs text-muted-foreground">
        No attachments uploaded yet.
      </div>
    );
  }

  // Thumbnail size varies by mode
  const thumbSize = compact ? "h-5 w-5" : "h-6 w-6";

  const chips = (
    <div className="flex flex-wrap gap-1.5">
      {groups.map(({ label, refs, color }) => {
        const preview = refs[0]; // first image as thumbnail
        return (
          <button
            key={label}
            type="button"
            className={`inline-flex items-center gap-0 border font-medium transition-colors overflow-hidden rounded-full ${color} ${
              compact ? "text-[10px]" : "text-[11px]"
            }`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onOpen(refs.map((r) => ({ id: r.id, url: r.url, filename: r.filename })));
            }}
          >
            {/* Thumbnail — flush left, no padding */}
            <span className={`shrink-0 ${thumbSize} overflow-hidden rounded-l-full`}>
              <img
                src={preview.url}
                alt={preview.filename || label}
                className="h-full w-full object-cover"
              />
            </span>
            {/* Label + count */}
            <span className={`flex items-center gap-1 ${compact ? "px-1.5 py-0.5" : "px-2 py-0.5"}`}>
              {label}
              <span className="font-semibold">{refs.length}</span>
            </span>
          </button>
        );
      })}
    </div>
  );

  if (compact) return <div className="mt-1">{chips}</div>;

  return (
    <div className="bg-muted/40 p-2.5 rounded-md text-xs space-y-1.5">
      <p className="font-medium text-muted-foreground">Attachments</p>
      {chips}
    </div>
  );
}
