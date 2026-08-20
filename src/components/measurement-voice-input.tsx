"use client";

import { Button } from "@/components/ui/button";
import { useMeasurementVoice, type VoiceResultCallback } from "@/hooks/use-measurement-voice";
import { Mic, MicOff, X } from "lucide-react";

interface MeasurementVoiceInputProps {
  onResult: VoiceResultCallback;
}

export function MeasurementVoiceInput({ onResult }: MeasurementVoiceInputProps) {
  const voice = useMeasurementVoice(onResult);

  if (!voice.supported) return null;

  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Mic className="h-4 w-4 text-primary shrink-0" />
          <span className="text-xs font-semibold">Voice Input</span>
          <span className="text-[10px] text-muted-foreground hidden sm:inline">
            say "Bust 36 Waist 28" or "Bicep 14" for custom
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Fill / Clear buttons shown after recording stops */}
          {voice.transcript && !voice.listening && (
            <>
              <Button
                size="sm"
                variant="default"
                className="h-7 text-xs px-2.5"
                onClick={voice.apply}
              >
                Fill Fields
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs px-2"
                onClick={voice.clear}
              >
                <X className="h-3 w-3" />
              </Button>
            </>
          )}

          {/* Start / Stop mic button */}
          <Button
            size="sm"
            variant={voice.listening ? "destructive" : "outline"}
            className="h-8 px-3 gap-1.5"
            onClick={voice.listening ? voice.stop : voice.start}
          >
            {voice.listening ? (
              <><MicOff className="h-3.5 w-3.5" /> Stop</>
            ) : (
              <><Mic className="h-3.5 w-3.5" /> {voice.transcript ? "Re-record" : "Start"}</>
            )}
          </Button>
        </div>
      </div>

      {/* Live transcript display */}
      {(voice.listening || voice.transcript) && (
        <div
          className={`rounded-md px-3 py-2 text-xs min-h-[2rem] transition-colors ${
            voice.listening
              ? "bg-red-50 border border-red-200 text-red-900 dark:bg-red-950/30 dark:border-red-800 dark:text-red-200"
              : "bg-background border text-foreground"
          }`}
        >
          {voice.listening && !voice.transcript ? (
            <span className="flex items-center gap-1.5 text-muted-foreground animate-pulse">
              <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />
              Listening...
            </span>
          ) : (
            voice.transcript
          )}
        </div>
      )}
    </div>
  );
}
