"use client";

import { useEffect, useRef, useState } from "react";
import { photoProblem } from "../lib/client/facts";

/** File input with a preview. Checks type and size in the browser; the server checks again. */
export default function PhotoPicker({ onChange }: { onChange: (file: File | null) => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const url = useRef<string | null>(null);

  // The preview URL is made in the change handler and freed when replaced, removed or unmounted.
  function showPreview(next: string | null) {
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = next;
    setPreview(next);
  }
  useEffect(
    () => () => {
      if (url.current) URL.revokeObjectURL(url.current);
    },
    [],
  );

  function clear() {
    if (input.current) input.current.value = "";
    showPreview(null);
    onChange(null);
  }

  function choose(file: File | null) {
    setProblem(null);
    if (!file) return clear();
    const issue = photoProblem(file);
    if (issue) {
      setProblem(issue);
      return clear();
    }
    showPreview(URL.createObjectURL(file));
    onChange(file);
  }

  return (
    <div>
      <label htmlFor="photo" className="mb-2 block text-base font-semibold">
        Photo <span className="font-normal text-muted">(optional, JPEG/PNG/WebP, up to 5 MB)</span>
      </label>
      <input
        ref={input}
        id="photo"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => choose(event.target.files?.[0] ?? null)}
        className="block w-full text-base file:mr-3 file:min-h-11 file:rounded-xl file:border file:border-line file:bg-surface file:px-4 file:py-2 file:font-semibold"
      />
      {problem && <p role="alert" className="mt-2 text-base text-bad">{problem}</p>}
      {preview && (
        <div className="mt-3 flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview, not optimisable */}
          <img src={preview} alt="Preview of your photo" className="h-28 w-28 rounded-xl border border-line object-cover" />
          <button
            type="button"
            onClick={() => {
              setProblem(null);
              clear();
            }}
            className="min-h-11 rounded-xl border border-line bg-surface px-4 py-2 font-semibold"
          >
            Remove photo
          </button>
        </div>
      )}
    </div>
  );
}