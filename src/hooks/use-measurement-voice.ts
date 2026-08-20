import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/hooks/use-toast";

// ─── ALIASES ──────────────────────────────────────────────────────────────
// Maps spoken aliases → canonical field names.
export const VOICE_ALIASES: Record<string, string> = {
  // Upper body
  "shoulder":       "Shoulder",
  "shoulder length":"Shoulder",
  "upper bust":     "Upper Bust",
  "upperbust":      "Upper Bust",
  "bust":           "Bust",
  "chest":          "Bust",
  "lower bust":     "Lower Bust",
  "lowerbust":      "Lower Bust",
  "waist":          "Waist",
  "lower waist":    "Lower Waist",
  "lowerwaist":     "Lower Waist",
  "hip":            "Hip",
  "hips":           "Hip",
  // Apex & sleeves
  "apex":           "Apex Point",
  "apex point":     "Apex Point",
  "apex down":      "Apex Down",
  "apex gap":       "Apex Gap",
  "sleeve":         "Sleeve Length",
  "sleeve length":  "Sleeve Length",
  "sleeve loose":   "Sleeve Loose",
  "armhole":        "Armhole",
  "arm hole":       "Armhole",
  "neck front":     "Neck Front",
  "neckfront":      "Neck Front",
  "neck back":      "Neck Back",
  "neckback":       "Neck Back",
  "neck":           "Neck Front",
  // Bottom
  "pant length":    "Pant Length",
  "pantlength":     "Pant Length",
  "pant waist":     "Pant Waist",
  "pantwaist":      "Pant Waist",
  "hip seat":       "Hip / Seat",
  "seat":           "Hip / Seat",
  "crotch":         "Crotch (Rise)",
  "rise":           "Crotch (Rise)",
  "thigh":          "Thigh",
  "knee":           "Knee",
  "ankle":          "Ankle",
  "bottom":         "Bottom Loose",
  "bottom loose":   "Bottom Loose",
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

// ─── TRANSCRIPT PARSER ───────────────────────────────────────────────────
// Returns matched (known fields) + custom (unrecognised single-word fields).
export function parseVoiceTranscript(transcript: string): {
  matched: Record<string, string>;
  custom: Record<string, string>;
} {
  const lower = transcript.toLowerCase().trim();
  const matched: Record<string, string> = {};
  const custom: Record<string, string> = {};

  const sortedAliases = Object.keys(VOICE_ALIASES).sort((a, b) => b.length - a.length);
  const aliasPattern = sortedAliases.map((a) => a.replace(/[()\/]/g, "\\$&")).join("|");

  // Pass 1 — known aliases
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

  // Pass 2 — custom single-word fields (e.g. "Bicep 14")
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
