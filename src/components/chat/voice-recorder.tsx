"use client";

import { useRef, useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";

import { Button } from "@/components/ui/button";

export function VoiceRecorder({
  disabled,
  busy,
  onRecorded,
}: {
  disabled?: boolean;
  busy?: boolean;
  onRecorded: (blob: Blob) => Promise<void> | void;
}) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [recording, setRecording] = useState(false);

  async function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      await onRecorded(blob);
      stream.getTracks().forEach((track) => track.stop());
    };

    recorderRef.current = recorder;
    recorder.start();
    setRecording(true);
  }

  return (
    <Button
      type="button"
      variant="secondary"
      disabled={disabled || busy}
      className="rounded-full border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100"
      onClick={toggleRecording}
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : recording ? (
        <Square className="h-4 w-4" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </Button>
  );
}
