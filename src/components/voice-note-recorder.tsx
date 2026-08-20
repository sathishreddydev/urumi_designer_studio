"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Trash2, Play, Square, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export interface VoiceNote {
  id: string;
  url: string;
  label: string;
  createdAt: string;
}

interface VoiceNoteRecorderProps {
  notes: VoiceNote[];
  label: string; // e.g. "Designer Instructions", "Trial Notes"
  canRecord: boolean;
  onAdd: (note: VoiceNote) => void;
  onDelete: (id: string) => void;
}

export function VoiceNoteRecorder({
  notes,
  label,
  canRecord,
  onAdd,
  onDelete,
}: VoiceNoteRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast({ variant: "destructive", title: "Mic not available", description: "This browser does not support audio recording." });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await uploadNote(blob);
      };

      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch {
      toast({ variant: "destructive", title: "Mic blocked", description: "Allow microphone access to record a voice note." });
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  async function uploadNote(blob: Blob) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", blob, `voice-note-${Date.now()}.webm`);

      const res = await fetch("/api/upload/audio", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");

      const { url } = await res.json();
      onAdd({
        id: crypto.randomUUID(),
        url,
        label,
        createdAt: new Date().toISOString(),
      });
      toast({ title: "Voice note saved" });
    } catch {
      toast({ variant: "destructive", title: "Upload failed", description: "Could not save voice note." });
    } finally {
      setUploading(false);
    }
  }

  function togglePlay(note: VoiceNote) {
    const audio = audioRefs.current[note.id];
    if (!audio) return;

    if (playingId === note.id) {
      audio.pause();
      setPlayingId(null);
    } else {
      // Stop any currently playing
      Object.values(audioRefs.current).forEach((a) => a?.pause());
      audio.currentTime = 0;
      audio.play();
      setPlayingId(note.id);
      audio.onended = () => setPlayingId(null);
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    });
  }

  return (
    <div className="space-y-2">
      {/* Saved notes */}
      {notes.length > 0 && (
        <div className="space-y-1.5">
          {notes.map((note, i) => (
            <div
              key={note.id}
              className="flex items-center gap-2 rounded-md border bg-muted/30 px-2.5 py-1.5"
            >
              {/* Hidden audio element */}
              <audio
                ref={(el) => { audioRefs.current[note.id] = el; }}
                src={note.url}
                preload="none"
              />

              {/* Play/Stop button */}
              <button
                type="button"
                onClick={() => togglePlay(note)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                {playingId === note.id
                  ? <Square className="h-3 w-3" />
                  : <Play className="h-3 w-3 ml-0.5" />
                }
              </button>

              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium truncate">Note {i + 1}</p>
                <p className="text-[10px] text-muted-foreground">{formatDate(note.createdAt)}</p>
              </div>

              {canRecord && (
                <button
                  type="button"
                  onClick={() => onDelete(note.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Record button */}
      {canRecord && (
        <Button
          type="button"
          size="sm"
          variant={recording ? "destructive" : "outline"}
          className="gap-1.5 h-8"
          disabled={uploading}
          onClick={recording ? stopRecording : startRecording}
        >
          {uploading ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...</>
          ) : recording ? (
            <><MicOff className="h-3.5 w-3.5" /> Stop Recording</>
          ) : (
            <><Mic className="h-3.5 w-3.5" /> {notes.length > 0 ? "Add Note" : "Record Voice Note"}</>
          )}
        </Button>
      )}
    </div>
  );
}
