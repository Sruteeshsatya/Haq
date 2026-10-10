import fs from "node:fs/promises";
import { defaultCasesRoot, safeCasePath } from "../tools/caseFiles";

export const POLL_MS = 500;
export const HEARTBEAT_MS = 15_000;
export const MAX_STREAM_MS = 5 * 60 * 1000;

export interface TailOptions {
  root?: string;
  pollMs?: number;
  heartbeatMs?: number;
  maxMs?: number;
  /** Aborted when the client disconnects. */
  signal?: AbortSignal;
  /** Resume after this many lines (from the Last-Event-ID header). */
  afterLine?: number;
}

/** Last-Event-ID is the 1-based line number of the last event the client saw. */
export function parseLastEventId(value: string | null | undefined): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

function frame(id: number, data: string): string {
  return `id: ${id}\ndata: ${data}\n\n`;
}

/**
 * Tails cases/<id>/events.jsonl as Server-Sent Events text frames.
 * Sends every existing line, then polls for new lines (by byte offset, so a reload of the
 * server does not matter), and ends after a "done" or "error" event, after maxMs, or on abort.
 * It ends with "event: end" so EventSource clients do not reconnect forever.
 */
export async function* tailEvents(caseId: string, options: TailOptions = {}): AsyncGenerator<string> {
  const root = options.root ?? defaultCasesRoot();
  const file = safeCasePath(caseId, "events.jsonl", root);
  const pollMs = options.pollMs ?? POLL_MS;
  const heartbeatMs = options.heartbeatMs ?? HEARTBEAT_MS;
  const deadline = Date.now() + (options.maxMs ?? MAX_STREAM_MS);
  const skip = options.afterLine ?? 0;

  yield "retry: 3000\n\n";

  let offset = 0;
  let pending = Buffer.alloc(0);
  let lineNo = 0;
  let lastBeat = Date.now();

  while (!options.signal?.aborted) {
    let size = 0;
    try {
      size = (await fs.stat(file)).size;
    } catch {
      size = 0;
    }
    if (size < offset) {
      // The file was replaced or truncated: start over.
      offset = 0;
      pending = Buffer.alloc(0);
      lineNo = 0;
    }
    if (size > offset) {
      const handle = await fs.open(file, "r");
      try {
        const chunk = Buffer.alloc(size - offset);
        const { bytesRead } = await handle.read(chunk, 0, chunk.length, offset);
        offset += bytesRead;
        pending = Buffer.concat([pending, chunk.subarray(0, bytesRead)]);
      } finally {
        await handle.close();
      }
      let newline = pending.indexOf(0x0a);
      while (newline !== -1) {
        const line = pending.subarray(0, newline).toString("utf8").trim();
        pending = pending.subarray(newline + 1);
        newline = pending.indexOf(0x0a);
        if (!line) continue;
        lineNo += 1;
        if (lineNo <= skip) continue;
        yield frame(lineNo, line);
        let type: unknown;
        try {
          type = (JSON.parse(line) as { type?: unknown }).type;
        } catch {
          type = undefined;
        }
        // Stop at the END of a run only when no more complete lines follow. A case with a first appeal
        // has two runs in one file, and a page opened later must replay both.
        const lastLineSoFar = newline === -1;
        if ((type === "done" || type === "error") && lastLineSoFar) {
          yield "event: end\ndata: {}\n\n";
          return;
        }
      }
      lastBeat = Date.now();
    }
    if (Date.now() >= deadline) {
      yield "event: end\ndata: {\"reason\":\"timeout\"}\n\n";
      return;
    }
    if (Date.now() - lastBeat >= heartbeatMs) {
      yield ": keep-alive\n\n";
      lastBeat = Date.now();
    }
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, pollMs);
      options.signal?.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
    });
  }
}

/** Wraps tailEvents in a Response with SSE headers. Stops polling when the client disconnects. */
export function sseResponse(caseId: string, request: Request, options: TailOptions = {}): Response {
  const controller = new AbortController();
  request.signal.addEventListener("abort", () => controller.abort(), { once: true });
  const iterator = tailEvents(caseId, {
    ...options,
    signal: controller.signal,
    afterLine: Math.max(options.afterLine ?? 0, parseLastEventId(request.headers.get("last-event-id"))),
  });
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async pull(streamController) {
      try {
        const { value, done } = await iterator.next();
        if (done) streamController.close();
        else streamController.enqueue(encoder.encode(value));
      } catch {
        streamController.close();
      }
    },
    cancel() {
      controller.abort();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
