"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CaseEvent } from "../lib/agent/events";
import { isRunning, reduceEvents, type StreamEvent, type TimelineSection } from "../lib/client/timeline";

export interface CaseStream {
  sections: TimelineSection[];
  running: boolean;
  /** True when the connection dropped and we are retrying. */
  reconnecting: boolean;
  /** Reconnect from the last seen event (used right after an appeal starts a new run). */
  resume: () => void;
}

/**
 * Live events for one case over Server-Sent Events.
 * - Closes the EventSource on "event: end" (otherwise the browser reconnects forever).
 * - Remembers the last event id and reconnects with ?after=<id>, so an appeal only streams the new run.
 * - `onFinished` runs once each time a run ends (done or error), so the page can refetch the case.
 */
export function useCaseStream(caseId: string, onFinished: () => void): CaseStream {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [reconnecting, setReconnecting] = useState(false);
  const [generation, setGeneration] = useState(0);
  const lastId = useRef(0);
  const source = useRef<EventSource | null>(null);
  const finished = useRef(onFinished);

  useEffect(() => {
    finished.current = onFinished;
  }, [onFinished]);

  useEffect(() => {
    let closed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;

    function connect() {
      if (closed) return;
      const es = new EventSource(`/api/cases/${encodeURIComponent(caseId)}/events?after=${lastId.current}`);
      source.current = es;
      es.onopen = () => setReconnecting(false);
      es.onmessage = (message) => {
        const id = Number(message.lastEventId);
        if (!Number.isInteger(id) || id <= lastId.current) return;
        let event: CaseEvent;
        try {
          event = JSON.parse(message.data) as CaseEvent;
        } catch {
          return;
        }
        lastId.current = id;
        setEvents((current) => [...current, { ...event, eventId: id }]);
        if (event.type === "done" || event.type === "error") finished.current();
      };
      es.addEventListener("end", () => {
        es.close();
        source.current = null;
      });
      es.onerror = () => {
        // The browser would retry by itself, but with the old URL. Retry with the new last id instead.
        es.close();
        source.current = null;
        if (closed) return;
        setReconnecting(true);
        retry = setTimeout(connect, 2000);
      };
    }

    connect();
    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      source.current?.close();
      source.current = null;
    };
  }, [caseId, generation]);

  const resume = useCallback(() => {
    // Close the finished connection (if still open) and open a new one after the last seen id.
    source.current?.close();
    setGeneration((value) => value + 1);
  }, []);

  const sections = reduceEvents(events);
  return { sections, running: isRunning(sections), reconnecting, resume };
}
