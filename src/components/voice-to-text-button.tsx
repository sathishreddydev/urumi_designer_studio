"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface VoiceToTextButtonProps {
  onTranscript: (text: string) => void;
  className?: string;
}

export function VoiceToTextButton({ onTranscript, className }: VoiceToTextButtonProps) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recRef = useRef<any>(null);

  // Always keep a fresh ref to onTranscript — avoids stale closure problem
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSupported(!!SR);
  }, []);

  function start() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    const rec = new SR();
    rec.lang = "en-IN";
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e: any) => {
      // Collect all final results from this event batch
      let finalText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          finalText += e.results[i][0].transcript;
        }
      }
      // Call immediately with fresh ref — no stale closure
      if (finalText.trim()) {
        onTranscriptRef.current(finalText.trim());
      }
    };

    rec.onerror = (e: any) => {
      if (e.error !== "no-speech") {
        setTimeout(() =>
          toast({ variant: "destructive", title: "Mic error", description: e.error }), 0
        );
      }
      setListening(false);
    };

    rec.onend = () => setListening(false);

    recRef.current = rec;
    rec.start();
    setListening(true);
  }

  function stop() {
    recRef.current?.stop();
    setListening(false);
  }

  if (!supported) return null;

  return (
    <Button
      type="button"
      size="icon"
      variant={listening ? "destructive" : "ghost"}
      className={`h-8 w-8 shrink-0 transition-colors ${className ?? ""}`}
      onClick={listening ? stop : start}
      title={listening ? "Stop dictation" : "Dictate text"}
    >
      {listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
    </Button>
  );
}
