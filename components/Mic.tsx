"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

// The browser SpeechRecognition API is not in the TypeScript DOM types.
interface RecognitionResult { isFinal: boolean; 0: { transcript: string } }
interface RecognitionEvent { resultIndex: number; results: ArrayLike<RecognitionResult> }
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function getCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const ERROR_HINTS: Record<string, string> = {
  "not-allowed": "Microphone access was blocked. You can type instead.",
  "service-not-allowed": "Voice typing is not allowed here. You can type instead.",
  "no-speech": "I did not hear anything. Tap the microphone and try again.",
  "audio-capture": "No microphone was found. You can type instead.",
  network: "Voice typing needs an internet connection. You can type instead.",
  "language-not-supported": "This browser cannot listen in this language. You can type instead.",
};

/**
 * Microphone button. Adds the spoken words to the text through onText. If the browser has no
 * SpeechRecognition, or it errors, it shows a short hint and the page keeps working.
 */
export default function Mic({ lang, onText, disabled }: { lang: string; onText: (text: string) => void; disabled?: boolean }) {
  // null on the server and first paint (so no mismatch), then true/false from the browser.
  const supported = useSyncExternalStore(
    () => () => {},
    () => getCtor() !== null,
    () => null,
  );
  const [listening, setListening] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const recognition = useRef<Recognition | null>(null);

  useEffect(() => {
    return () => {
      try {
        recognition.current?.abort();
      } catch {
        // already stopped
      }
    };
  }, []);

  function start() {
    setHint(null);
    const Ctor = getCtor();
    if (!Ctor) return setHint("Voice typing is not available in this browser. You can type instead.");
    try {
      const rec = new Ctor();
      rec.lang = lang;
      rec.continuous = false;
      rec.interimResults = false;
      rec.onresult = (event) => {
        let spoken = "";
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          if (event.results[i].isFinal) spoken += event.results[i][0].transcript;
        }
        if (spoken.trim()) onText(spoken.trim());
      };
      rec.onerror = (event) => {
        setListening(false);
        setHint(ERROR_HINTS[event.error ?? ""] ?? "Voice typing did not work. You can type instead.");
      };
      rec.onend = () => setListening(false);
      recognition.current = rec;
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
      setHint("Voice typing did not start. You can type instead.");
    }
  }

  function stop() {
    try {
      recognition.current?.stop();
    } catch {
      // ignore
    }
    setListening(false);
  }

  if (supported === null) return null;
  if (!supported) {
    return <p className="text-sm text-muted">Voice typing is not available in this browser. You can type instead.</p>;
  }
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={listening ? stop : start}
        disabled={disabled}
        aria-pressed={listening}
        className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border px-4 py-2 text-base font-semibold transition ${
          listening ? "border-accent bg-accent text-white" : "border-line bg-surface text-accent-strong hover:bg-accent-soft"
        } disabled:opacity-50`}
      >
        <span aria-hidden="true">{listening ? "●" : "🎤"}</span>
        {listening ? "Listening… tap to stop" : "Speak instead"}
      </button>
      {hint && <p role="status" className="text-sm text-muted">{hint}</p>}
    </div>
  );
}
