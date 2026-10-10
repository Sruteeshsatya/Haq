"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { EXAMPLES, LANGUAGES, speechLang, type LanguageCode } from "../lib/client/facts";
import { isSafetyCase } from "../lib/tools/text";
import Mic from "./Mic";
import PhotoPicker from "./PhotoPicker";
import SafetyCard from "./SafetyCard";

const MAX_CHARS = 2000;

export default function IntakeForm() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [place, setPlace] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [safety, setSafety] = useState(false);

  function fillExample(example: (typeof EXAMPLES)[number]) {
    setText(example.text);
    setLanguage(example.language);
    setPlace(example.place);
    setError(null);
    setSafety(false);
  }

  async function send(confirmCivic: boolean) {
    if (busy) return;
    const trimmed = text.trim();
    if (!trimmed) return setError("Please describe the problem first.");
    if (trimmed.length > MAX_CHARS) return setError(`Please shorten your description to ${MAX_CHARS} characters.`);
    // Safety and crime reports are not civic grievances: show the 112 card and create nothing.
    if (!confirmCivic && isSafetyCase(trimmed)) return setSafety(true);
    setSafety(false);
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("text", trimmed);
      form.set("language", language);
      if (confirmCivic) form.set("confirmCivic", "1");
      if (place.trim()) form.set("place", place.trim());
      if (photo) form.set("photo", photo);
      const response = await fetch("/api/cases", { method: "POST", body: form });
      const body = (await response.json().catch(() => ({}))) as { caseId?: string; error?: string };
      if (response.status === 422 && body.error === "safety_referral") {
        setSafety(true);
        setBusy(false);
        return;
      }
      if (!response.ok || !body.caseId) {
        setError(body.error ?? "Something went wrong. Please try again.");
        setBusy(false);
        return;
      }
      router.push(`/case/${body.caseId}`);
    } catch {
      setError("Could not reach Haq. Check your internet connection and try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => { event.preventDefault(); void send(false); }} className="flex flex-col gap-6" noValidate>
      <div>
        <p className="mb-2 text-sm font-semibold text-muted">Try an example</p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example.label}
              type="button"
              onClick={() => fillExample(example)}
              className="min-h-11 rounded-full border border-line bg-surface px-4 py-2 text-left text-base hover:border-accent hover:bg-accent-soft"
            >
              {example.label}
            </button>
          ))}
        </div>
      </div>

      <fieldset>
        <legend className="mb-2 text-base font-semibold">Language</legend>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Language">
          {LANGUAGES.map((item) => (
            <button
              key={item.code}
              type="button"
              role="radio"
              aria-checked={language === item.code}
              onClick={() => setLanguage(item.code)}
              className={`min-h-12 rounded-xl border px-2 py-2 text-lg font-semibold transition ${
                language === item.code ? "border-accent bg-accent text-white" : "border-line bg-surface hover:bg-accent-soft"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="problem" className="mb-2 block text-base font-semibold">
          What is the problem?
        </label>
        <textarea
          id="problem"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setSafety(false);
          }}
          rows={6}
          placeholder="Describe it in your own words: where it is, since when, who is affected."
          className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-lg leading-relaxed"
        />
        <div className="mt-1 flex items-start justify-between gap-3">
          <Mic
            lang={speechLang(language)}
            onText={(spoken) => setText((current) => (current ? `${current} ${spoken}` : spoken))}
            disabled={busy}
          />
          <span className={`shrink-0 text-sm ${text.length > MAX_CHARS ? "font-semibold text-bad" : "text-muted"}`}>
            {text.length}/{MAX_CHARS}
          </span>
        </div>
      </div>

      <div>
        <label htmlFor="place" className="mb-2 block text-base font-semibold">
          Place <span className="font-normal text-muted">(optional)</span>
        </label>
        <input
          id="place"
          value={place}
          onChange={(event) => setPlace(event.target.value)}
          maxLength={120}
          placeholder="For example: Guwahati"
          className="min-h-12 w-full rounded-xl border border-line bg-surface px-4 py-2 text-lg"
        />
      </div>

      <PhotoPicker onChange={setPhoto} />

      {safety && <SafetyCard busy={busy} onContinue={() => void send(true)} />}

      {error && (
        <p role="alert" className="rounded-xl border border-bad bg-white px-4 py-3 text-base text-bad">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="min-h-14 rounded-xl bg-accent px-6 py-3 text-xl font-bold text-white transition hover:bg-accent-strong disabled:opacity-70"
      >
        {busy ? "Starting your case…" : "Start my case"}
      </button>
      <p className="-mt-3 text-sm text-muted">
        Haq prepares drafts for you to file yourself. It never files anything or pays anything on your behalf.
      </p>
    </form>
  );
}
