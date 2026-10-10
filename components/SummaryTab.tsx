"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { speechLang } from "../lib/client/facts";

/** Picks a voice for the case language, then hi-IN, then en-IN. Returns null when the browser has none of them. */
export function pickVoice(
  voices: Array<{ lang: string }>,
  language: string,
): { voice: { lang: string }; usedFallback: boolean } | null {
  const wanted = speechLang(language).toLowerCase();
  const base = (lang: string) => lang.toLowerCase().replace("_", "-");
  const order = [wanted, "hi-in", "en-in"];
  for (const [index, lang] of order.entries()) {
    const exact = voices.find((voice) => base(voice.lang) === lang);
    const loose = voices.find((voice) => base(voice.lang).startsWith(lang.split("-")[0]));
    const voice = exact ?? loose;
    if (voice) return { voice, usedFallback: index > 0 };
  }
  return null;
}

export default function SummaryTab({ text, language }: { text: string | null; language: string }) {
  const [speaking, setSpeaking] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const supported = useRef<boolean | null>(null);

  useEffect(() => {
    supported.current = typeof window !== "undefined" && "speechSynthesis" in window;
    return () => {
      if (supported.current) window.speechSynthesis.cancel();
    };
  }, []);

  if (!text) return <p className="text-muted">The summary is not ready yet.</p>;

  function stop() {
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }

  function read() {
    setNote(null);
    if (!supported.current) return setNote("Read aloud is not available in this browser.");
    const synth = window.speechSynthesis;
    const picked = pickVoice(synth.getVoices(), language);
    if (!picked) {
      return setNote("This device has no voice for this language, so it cannot read aloud. You can read the summary on screen.");
    }
    synth.cancel();
    const plain = (text ?? "").replace(/[#*_`>]/g, "");
    const utterance = new SpeechSynthesisUtterance(plain);
    utterance.voice = picked.voice as SpeechSynthesisVoice;
    utterance.lang = picked.voice.lang;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => {
      setSpeaking(false);
      setNote("Reading aloud did not work on this device.");
    };
    if (picked.usedFallback) {
      setNote(`No ${speechLang(language)} voice was found, so this uses a ${picked.voice.lang} voice. It may sound unusual.`);
    }
    setSpeaking(true);
    synth.speak(utterance);
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={speaking ? stop : read}
        className="min-h-12 self-start rounded-xl bg-accent px-5 py-2 text-lg font-bold text-white hover:bg-accent-strong"
      >
        {speaking ? "■ Stop" : "🔊 Read aloud"}
      </button>
      {note && <p role="status" className="text-base text-muted">{note}</p>}
      <div className="prose-haq text-lg" lang={language === "as" ? "as" : language === "hi" ? "hi" : "en"}>
        <ReactMarkdown>{text}</ReactMarkdown>
      </div>
    </div>
  );
}
