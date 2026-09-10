"use client";

import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Trash2, Play, Square, Loader2, Pause } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { LiveAudioVisualizer } from "react-audio-visualize";

export interface VoiceNote {
  id: string;
  url: string;
  label: string;
  createdAt: string;
}

interface VoiceNoteRecorderProps {
  notes: VoiceNote[];
  label: string;
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
  const [paused, setPaused] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  // Keep MediaRecorder in state so LiveAudioVisualizer re-renders when it's set
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

  const chunksRef = useRef<Blob[]>([]);
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function startTimer() {
    setRecordingSeconds(0);
    timerRef.current = setInterval(() => setRecordingSeconds((s: number) => s + 1), 1000);
  }

  function stopTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  function pauseTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  function resumeTimer() {
    timerRef.current = setInterval(() => setRecordingSeconds((s: number) => s + 1), 1000);
  }

  function formatDuration(secs: number) {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

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
        stopTimer();
        setRecordingSeconds(0);
        setMediaRecorder(null);
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await uploadNote(blob);
      };

      mr.start(100);
      setMediaRecorder(mr);
      setRecording(true);
      setPaused(false);
      startTimer();
    } catch {
      toast({ variant: "destructive", title: "Mic blocked", description: "Allow microphone access to record a voice note." });
    }
  }

  function pauseRecording() {
    if (mediaRecorder?.state === "recording") {
      mediaRecorder.pause();
      setPaused(true);
      pauseTimer();
    }
  }

  function resumeRecording() {
    if (mediaRecorder?.state === "paused") {
      mediaRecorder.resume();
      setPaused(false);
      resumeTimer();
    }
  }

  function stopRecording() {
    mediaRecorder?.stop();
    setRecording(false);
    setPaused(false);
  }

  async function uploadNote(blob: Blob) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", blob, `voice-note-${Date.now()}.webm`);

      const res = await fetch("/api/upload/audio", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");

      const { url } = await res.json();
      onAdd({ id: crypto.randomUUID(), url, label, createdAt: new Date().toISOString() });
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
    <div className="space-y-3">

      {/* ── Saved notes ─────────────────────────────────────── */}
      {notes.length > 0 && (
        <div className="space-y-1.5">
          {notes.map((note, i) => (
            <div
              key={note.id}
              className="flex items-center gap-2 rounded-md border bg-muted/30 px-2.5 py-1.5"
            >
              <audio
                ref={(el) => { audioRefs.current[note.id] = el; }}
                src={note.url}
                preload="none"
              />

              <button
                type="button"
                onClick={() => togglePlay(note)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                {playingId === note.id
                  ? <Square className="h-3 w-3" />
                  : <Play className="h-3 w-3 ml-0.5" />}
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

      {/* ── Live visualizer — shown only while recording ──── */}
      {recording && mediaRecorder && (
        <div className={`rounded-lg border px-3 py-2 transition-colors ${paused ? "bg-muted/40 border-muted" : "bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800"}`}>
          <div className="flex items-center gap-2 mb-2">
            {/* Pulsing dot */}
            <span className={`h-2 w-2 rounded-full shrink-0 ${paused ? "bg-muted-foreground" : "bg-rose-500 animate-pulse"}`} />
            <span className={`text-[11px] font-medium ${paused ? "text-muted-foreground" : "text-rose-600 dark:text-rose-400"}`}>
              {paused ? "Paused" : "Recording"}
            </span>
            <span className="ml-auto text-xs tabular-nums font-mono text-muted-foreground">
              {formatDuration(recordingSeconds)}
            </span>
          </div>

          {/* Waveform — frozen automatically when MediaRecorder is paused */}
          <LiveAudioVisualizer
            mediaRecorder={mediaRecorder}
            width={320}
            height={40}
            barWidth={2}
            gap={1}
            barColor={paused ? "rgb(148,163,184)" : "hsl(346, 100%, 58%)"}
            backgroundColor="transparent"
            fftSize={256}
            smoothingTimeConstant={0.8}
          />
        </div>
      )}

      {/* ── Controls ─────────────────────────────────────── */}
      {canRecord && (
        <div className="flex items-center gap-2 flex-wrap">
          {/* Record / Stop */}
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
              <><MicOff className="h-3.5 w-3.5" /> Stop</>
            ) : (
              <><Mic className="h-3.5 w-3.5" /> {notes.length > 0 ? "Add Note" : "Record Voice Note"}</>
            )}
          </Button>

          {/* Pause / Resume */}
          {recording && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5 h-8"
              onClick={paused ? resumeRecording : pauseRecording}
            >
              {paused ? (
                <><Mic className="h-3.5 w-3.5 text-primary" /> Resume</>
              ) : (
                <><Pause className="h-3.5 w-3.5" /> Pause</>
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
