import { NextResponse } from "next/server";
import { z } from "zod";

import { askAssistant, isAssistantConfigured } from "@/lib/ai/assistant";
import { getAiContext } from "@/lib/ai/context";
import { audit } from "@/lib/auth";

/**
 * The assistant endpoint.
 *
 * Note what the body does NOT contain: no guard id, no role, no site. The only
 * thing the client gets to choose is what it says. Everything about *whose*
 * data may be read is re-derived here from the session cookie, so a crafted
 * request body has nothing to attack.
 *
 * The reply is streamed back as newline-delimited JSON rather than one object.
 * A grounded answer takes several database round trips and a reasoning pass
 * before its first word, and a supervisor watching a spinner for eight seconds
 * concludes it has hung. NDJSON rather than SSE because there is no need for
 * the event framing, and a line is the natural unit here anyway.
 */
export const dynamic = "force-dynamic";

const Body = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        // Long enough for a real question, short enough that the context window
        // cannot be stuffed with an injected instruction set.
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(24),
});

type Event =
  | { type: "step"; label: string }
  | { type: "reasoning"; delta: string }
  | { type: "text"; delta: string }
  | { type: "error"; message: string }
  | { type: "done" };

/**
 * Per-account throttle.
 *
 * In-process and therefore per-instance, which on a serverless host means a
 * determined caller gets a fresh allowance on every cold start — the same
 * honest limitation the sign-in throttle carries, and the same plan: it moves
 * into Postgres alongside that one. It is here to stop a runaway browser tab
 * spending the month's budget in an afternoon, not to stop an attacker, and
 * every turn is already behind a session and an audit row.
 */
const turns = new Map<string, { count: number; first: number }>();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_TURNS = 60;

function throttled(userId: string): boolean {
  const now = Date.now();
  const record = turns.get(userId);
  if (!record || now - record.first > WINDOW_MS) {
    turns.set(userId, { count: 1, first: now });
    return false;
  }
  record.count += 1;
  return record.count > MAX_TURNS;
}

export async function POST(req: Request) {
  const ctx = await getAiContext();
  if (!ctx) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  // The assistant is an office tool. A guard's question is "am I checked in",
  // which the duty screen answers in one look and a chat box answers worse.
  if (ctx.role !== "admin" && ctx.role !== "supervisor") {
    return NextResponse.json({ error: "Not available for this account." }, { status: 403 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  if (!isAssistantConfigured()) {
    return NextResponse.json(
      { error: "The assistant is not connected yet — no API key is configured." },
      { status: 503 },
    );
  }

  // Keyed on the real account, not the effective one: an admin viewing as four
  // different people is still one person asking questions.
  if (throttled(ctx.realUserId)) {
    return NextResponse.json(
      { error: "That is a lot of questions at once. Try again in a little while." },
      { status: 429 },
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: Event) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // The reader went away mid-answer — the tab was closed, or Stop was
          // pressed. Nothing to recover; stop trying to write.
          closed = true;
        }
      };

      let toolsUsed: string[] = [];
      try {
        const reply = await askAssistant(
          parsed.data.messages,
          ctx,
          {
            onStep: (label) => send({ type: "step", label }),
            onReasoning: (delta) => send({ type: "reasoning", delta }),
            onText: (delta) => send({ type: "text", delta }),
          },
          req.signal,
        );
        toolsUsed = reply.toolsUsed;
        send({ type: "done" });
      } catch (err) {
        if (req.signal.aborted) {
          // Stop was pressed. Not a failure worth logging or reporting.
        } else {
          console.error("[ai] turn failed", err);
          send({
            type: "error",
            message:
              err instanceof Error ? err.message : "The assistant is unavailable.",
          });
        }
      } finally {
        // What was *asked* is not recorded — a question can name a guard, and
        // this log is read by people who should not be handed a transcript of
        // their colleagues' names. What is recorded is that the assistant ran,
        // for whom, and which lookups it touched, which is what an audit of
        // this feature actually needs. In `finally`, so an abandoned turn is
        // still accounted for.
        await audit({
          actor: null,
          action: "ai_query",
          entity: "profiles",
          entityId: ctx.realUserId,
          detail: {
            role: ctx.role,
            viewing_as: ctx.viewingAs,
            tools: toolsUsed,
            aborted: req.signal.aborted,
          },
        }).catch((err) => console.error("[ai] audit failed", err));

        closed = true;
        try {
          controller.close();
        } catch {
          // Already closed by the runtime when the client disconnected.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store, no-transform",
      // Nginx and some CDNs buffer a response body by default, which would hold
      // every line back until the turn finished and defeat the whole point.
      "x-accel-buffering": "no",
    },
  });
}
