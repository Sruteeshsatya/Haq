"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { DETAILS_KEY, loadDetails, saveDetails, type Details } from "../lib/client/draft";

// The citizen's name, address, phone and date. Browser only: localStorage, never sent to the server.
// `memory` keeps the values for this visit if storage is blocked (for example private mode).
let memory = "";
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function snapshot(): string {
  try {
    return window.localStorage.getItem(DETAILS_KEY) ?? memory;
  } catch {
    return memory;
  }
}

/** [details, setDetails]. Renders empty on the server and first paint, then the saved values. */
export function useDetails(): [Details, (next: Details) => void] {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "");
  const details = useMemo(() => loadDetails({ getItem: () => raw || null }), [raw]);
  const setDetails = useCallback((next: Details) => {
    memory = JSON.stringify(next);
    try {
      saveDetails(window.localStorage, next);
    } catch {
      // blocked storage: the in-memory copy above still serves this visit
    }
    listeners.forEach((listener) => listener());
  }, []);
  return [details, setDetails];
}
