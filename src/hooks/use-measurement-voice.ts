import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/hooks/use-toast";

// ─── ALIASES ──────────────────────────────────────────────────────────────
// Maps spoken / OCR aliases → canonical field names.
export const VOICE_ALIASES: Record<string, string> = {
  // Upper body
  "shoulder":           "Shoulder",
  "shoulder length":    "Shoulder",
  "upper bust":         "Upper Bust",
  "upperbust":          "Upper Bust",
  "bust":               "Bust",
  "chest":              "Bust",
  "lower bust":         "Lower Bust",
  "lowerbust":          "Lower Bust",
  "waist":              "Waist",
  "lower waist":        "Lower Waist",
  "lowerwaist":         "Lower Waist",
  "hip":                "Hip",
  "hips":               "Hip",
  // Length – Front / Back (printed chart labels)
  "length front":       "Neck Front",   // map to Neck Front as closest standard field
  "length - front":     "Neck Front",
  "length – front":     "Neck Front",
  "length back":        "Neck Back",
  "length - back":      "Neck Back",
  "length – back":      "Neck Back",
  // Apex & sleeves
  "apex":               "Apex Point",
  "apex point":         "Apex Point",
  "apex down":          "Apex Down",
  "apex gap":           "Apex Gap",
  "sleeve":             "Sleeve Length",
  "sleeve length":      "Sleeve Length",
  "sleeve loose":       "Sleeve Loose",
  "armhole":            "Armhole",
  "arm hole":           "Armhole",
  "neck front":         "Neck Front",
  "neckfront":          "Neck Front",
  "neck back":          "Neck Back",
  "neckback":           "Neck Back",
  "neck":               "Neck Front",
  // Bottom
  "pant length":        "Pant Length",
  "pantlength":         "Pant Length",
  "pant waist":         "Pant Waist",
  "pantwaist":          "Pant Waist",
  "hip / seat":         "Hip / Seat",
  "hip/seat":           "Hip / Seat",
  "hip seat":           "Hip / Seat",
  "seat":               "Hip / Seat",
  "crotch (rise)":      "Crotch (Rise)",
  "crotch":             "Crotch (Rise)",
  "rise":               "Crotch (Rise)",
  "thigh":              "Thigh",
  "knee":               "Knee",
  "ankle":              "Ankle",
  "bottom":             "Bottom Loose",
  "bottom loose":       "Bottom Loose",
};

// ─── NUMBER PARSER ────────────────────────────────────────────────────────
// "thirty six point five" → 36.5 | "36 and a half" → 36.5 | "36" → 36
export function wordsToNumber(text: string): number | null {
  const direct = text
    .replace(/\band\s+a\s+half\b/g, ".5")
    .replace(/\band\s+half\b/g, ".5")
    .match(/(\d+(?:\.\d+)?)/);
  if (direct) return parseFloat(direct[1]);

  const ones: Record<string, number> = {
    zero:0, one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8,
    nine:9, ten:10, eleven:11, twelve:12, thirteen:13, fourteen:14, fifteen:15,
    sixteen:16, seventeen:17, eighteen:18, nineteen:19, twenty:20, thirty:30,
    forty:40, fifty:50,
  };
  const parts = text.toLowerCase().split(/\s+/);
  let total = 0, decimal = false, decPart = "";
  for (const p of parts) {
    if (p === "point" || p === "dot") { decimal = true; continue; }
    if (decimal) { decPart += ones[p] ?? ""; continue; }
    if (ones[p] !== undefined) total += ones[p];
  }
  if (total === 0 && !decPart) return null;
  return decPart ? parseFloat(`${total}.${decPart}`) : total || null;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────

/** Normalise Unicode dashes and strip quote/inch marks */
function normCell(s: string): string {
  return s
    .replace(/[\u2013\u2014\u2012]/g, "-") // en-dash, em-dash → hyphen
    .replace(/["'\u201C\u201D\u2018\u2019]/g, "")
    .trim();
}

/** Split a line into cells by tab, comma, semicolon, or pipe */
function splitCells(line: string): string[] {
  // If the line contains any hard delimiter, use it
  if (/[\t,;|]/.test(line)) {
    return line.split(/[\t,;|]+/).map(normCell).filter(Boolean);
  }
  // Otherwise split on 2+ spaces (OCR whitespace-aligned columns)
  return line.split(/\s{2,}/).map(normCell).filter(Boolean);
}

/**
 * Extract the first numeric value from a cell.
 * Handles: "15", "36.2", "12.2 / 9.5", "5/12.5", "—", "-"
 * Returns null for empty / dash-only cells.
 */
function extractNumber(token: string): number | null {
  const clean = normCell(token);
  // Pure dash / em-dash means "not applicable"
  if (/^[-–—]+$/.test(clean)) return null;
  // Take the first decimal number found (handles "12.2 / 9.5" → 12.2)
  const m = clean.match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

/** Return true if a cell looks like a measurement number (or a dash placeholder) */
function isNumericToken(token: string): boolean {
  const clean = normCell(token);
  return /^[-–—]+$/.test(clean) || /^\d+(\.\d+)?([\s/]\d+(\.\d+)?)?$/.test(clean);
}

/** Try to resolve a cell text to a canonical field name via VOICE_ALIASES */
function resolveAlias(cell: string): string | null {
  // Normalise: lowercase, collapse dashes/spaces, strip punctuation except /
  const key = normCell(cell)
    .toLowerCase()
    .replace(/\s*[–-]\s*/g, " - ") // normalise "Length–Front" → "Length - Front"
    .trim();

  if (VOICE_ALIASES[key]) return VOICE_ALIASES[key];

  // Progressively shorter alias matching (longest first)
  for (const alias of Object.keys(VOICE_ALIASES).sort((a, b) => b.length - a.length)) {
    if (key.includes(alias)) return VOICE_ALIASES[alias];
  }
  return null;
}

// ─── TABLE PARSER ────────────────────────────────────────────────────────
// Handles split-header tables where headers are on one row and values on the
// next row (or vice-versa). Also handles simple two-column tables.
//
// Examples handled:
//   Bust  Waist  Hip          ← header row
//   36    28     40           ← value row
//
//   Bust | Waist | Hip        ← header row (pipe-delimited)
//   36   | 28    | 40         ← value row
//
//   Bust,36                   ← inline two-column (already works, but handled here too)
function parseTableLayout(
  lines: string[],
  matched: Record<string, string>,
  custom: Record<string, string>
): void {
  const SKIP = new Set(["and", "the", "for", "with", "from", "then", "also", "next", "plus", "sl", "no", "sr", "measurement", "measurements", "value", "values", "size", "inches", "inch", "cms", "cm"]);

  let i = 0;
  while (i < lines.length) {
    const cells = splitCells(lines[i]);
    if (cells.length < 2) { i++; continue; }

    // ── Case 1: Two-column row — "Label  Value" ──
    // Single header + single value on same row
    if (cells.length === 2) {
      const [labelCell, valueCell] = cells;
      const numVal = parseFloat(valueCell.replace(/"$/, ""));
      if (!isNaN(numVal)) {
        const canonical = resolveAlias(labelCell);
        if (canonical) {
          if (!matched[canonical]) matched[canonical] = String(numVal);
          i++; continue;
        }
        // Unknown label — custom field
        const label = labelCell.trim();
        if (label.length >= 2 && label.length <= 30 && !SKIP.has(label.toLowerCase())) {
          const titleLabel = label.charAt(0).toUpperCase() + label.slice(1);
          if (!custom[titleLabel]) custom[titleLabel] = String(numVal);
        }
        i++; continue;
      }
    }

    // ── Case 2: Header row followed by value row ──
    // Detect header row: cells are mostly text (not numbers), and at least 2 are known aliases
    const headerCells = cells;
    const isHeaderRow =
      headerCells.filter((c) => !isNumericToken(c)).length >= 2 &&
      headerCells.filter((c) => resolveAlias(c) !== null).length >= 2;

    if (isHeaderRow && i + 1 < lines.length) {
      const valueCells = splitCells(lines[i + 1]);
      // Value row: mostly numbers
      const numericCount = valueCells.filter((c) => isNumericToken(c)).length;
      if (numericCount >= Math.floor(valueCells.length * 0.5)) {
        // Zip headers with values
        const len = Math.min(headerCells.length, valueCells.length);
        for (let j = 0; j < len; j++) {
          const label = headerCells[j];
          const rawVal = valueCells[j].replace(/"$/, "");
          const numVal = parseFloat(rawVal);
          if (isNaN(numVal)) continue;

          const canonical = resolveAlias(label);
          if (canonical) {
            if (!matched[canonical]) matched[canonical] = String(numVal);
          } else if (label.length >= 2 && label.length <= 30 && !SKIP.has(label.toLowerCase()) && !isNumericToken(label)) {
            const titleLabel = label.charAt(0).toUpperCase() + label.slice(1);
            if (!custom[titleLabel]) custom[titleLabel] = String(numVal);
          }
        }
        i += 2; // consumed both rows
        continue;
      }
    }

    // ── Case 3: Value row followed by header row ──
    // Some charts print values first, headers below
    const isValueRow =
      cells.filter((c) => isNumericToken(c)).length >= 2;

    if (isValueRow && i + 1 < lines.length) {
      const nextCells = splitCells(lines[i + 1]);
      const nextIsHeaders =
        nextCells.filter((c) => !isNumericToken(c)).length >= 2 &&
        nextCells.filter((c) => resolveAlias(c) !== null).length >= 2;

      if (nextIsHeaders) {
        const len = Math.min(cells.length, nextCells.length);
        for (let j = 0; j < len; j++) {
          const label = nextCells[j];
          const rawVal = cells[j].replace(/"$/, "");
          const numVal = parseFloat(rawVal);
          if (isNaN(numVal)) continue;

          const canonical = resolveAlias(label);
          if (canonical) {
            if (!matched[canonical]) matched[canonical] = String(numVal);
          } else if (label.length >= 2 && label.length <= 30 && !SKIP.has(label.toLowerCase()) && !isNumericToken(label)) {
            const titleLabel = label.charAt(0).toUpperCase() + label.slice(1);
            if (!custom[titleLabel]) custom[titleLabel] = String(numVal);
          }
        }
        i += 2;
        continue;
      }
    }

    i++;
  }
}

// ─── TRANSCRIPT PARSER ───────────────────────────────────────────────────
// Returns matched (known fields) + custom (unrecognised single-word fields).
// Handles:
//   1. Inline "Label Value" pairs (voice / single-line text)
//   2. Two-column tables: "Label,Value" or "Label  Value"
//   3. Split-header tables: headers row + values row (or values row + headers row)
export function parseVoiceTranscript(transcript: string): {
  matched: Record<string, string>;
  custom: Record<string, string>;
} {
  const matched: Record<string, string> = {};
  const custom: Record<string, string> = {};

  const sortedAliases = Object.keys(VOICE_ALIASES).sort((a, b) => b.length - a.length);
  const aliasPattern = sortedAliases.map((a) => a.replace(/[()\/]/g, "\\$&")).join("|");

  // ── Pass A: Table layout (multi-column / split-header) ──
  const lines = transcript.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  parseTableLayout(lines, matched, custom);

  // ── Pass B: Inline "Label Value" pairs (voice / single-line) ──
  const lower = transcript.toLowerCase().trim();

  for (const alias of sortedAliases) {
    const escaped = alias.replace(/[()\/]/g, "\\$&");
    const pattern = new RegExp(
      `\\b${escaped}\\b\\s+([\\w\\s\\.]+?)(?=\\b(?:${aliasPattern})\\b|$)`,
      "i"
    );
    const match = lower.match(pattern);
    if (match) {
      const num = wordsToNumber(match[1].trim());
      if (num !== null) {
        const canonical = VOICE_ALIASES[alias];
        if (!matched[canonical]) matched[canonical] = String(num);
      }
    }
  }

  // ── Pass C: Custom single-word fields not already caught (e.g. "Bicep 14") ──
  let remaining = lower;
  for (const alias of sortedAliases) {
    const escaped = alias.replace(/[()\/]/g, "\\$&");
    remaining = remaining.replace(
      new RegExp(`\\b${escaped}\\b\\s+[\\d\\.]+`, "gi"),
      " "
    );
  }
  const SKIP = new Set(["and","the","for","with","from","then","also","next","plus"]);
  const customRe = /\b([a-z]{2,20})\s+(\d+(?:\.\d+)?)\b/g;
  let cm: RegExpExecArray | null;
  while ((cm = customRe.exec(remaining)) !== null) {
    const label = cm[1].trim();
    if (SKIP.has(label)) continue;
    const titleLabel = label.charAt(0).toUpperCase() + label.slice(1);
    if (!custom[titleLabel]) custom[titleLabel] = cm[2];
  }

  return { matched, custom };
}

// ─── HOOK ─────────────────────────────────────────────────────────────────
export type VoiceResultCallback = (
  matched: Record<string, string>,
  custom: Record<string, string>,
  raw: string
) => void;

export function useMeasurementVoice(onResult: VoiceResultCallback) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [supported, setSupported] = useState(true);
  const recRef = useRef<any>(null);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) setSupported(false);
  }, []);

  const start = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    const rec = new SR();
    rec.lang = "en-IN";
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e: any) => {
      let full = "";
      for (let i = 0; i < e.results.length; i++) {
        full += e.results[i][0].transcript + " ";
      }
      setTranscript(full.trim());
    };

    rec.onerror = (e: any) => {
      if (e.error !== "no-speech") {
        toast({ variant: "destructive", title: "Mic error", description: e.error });
      }
      setListening(false);
    };

    rec.onend = () => setListening(false);

    recRef.current = rec;
    rec.start();
    setListening(true);
    setTranscript("");
  }, []);

  const stop = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  const apply = useCallback(() => {
    if (!transcript) return;
    const { matched, custom } = parseVoiceTranscript(transcript);
    onResult(matched, custom, transcript);
    setTranscript("");
  }, [transcript, onResult]);

  const clear = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
    setTranscript("");
  }, []);

  return { listening, transcript, supported, start, stop, apply, clear };
}
