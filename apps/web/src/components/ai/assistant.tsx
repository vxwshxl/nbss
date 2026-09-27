"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ArrowUp,
  Check,
  Eye,
  EyeOff,
  Sparkles,
  Square,
  SquarePen,
  TriangleAlert,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/console/page-header";
import { pageKnowledge } from "@/lib/ai/pages";
import { cn } from "@/lib/utils";
import { useAssistantPanel } from "./assistant-panel";
import { Markdown } from "./markdown";

/**
 * The operations assistant.
 *
 * Deliberately thin: it holds a transcript and posts it to `/api/ai/chat`. It
 * knows nothing about roles or permissions and has no way to ask for a
 * particular guard's records — the server derives all of that from the session,
 * so there is nothing here worth tampering with.
 *
 * The thread shows three separate things, in the order they happen, because
 * collapsing them into one spinner is what made the old version feel broken on
 * a slow question:
 *
 *   1. **Thinking** — the model's own working-out, streamed as it arrives. It
 *      is collapsed the moment the answer starts, because it is working-out and
 *      not a claim about the agency's records.
 *   2. **Steps** — one line per lookup that actually returned, in plain words.
 *      This is the receipt: it is how a supervisor can tell an answer that
 *      was read from a figure that was invented.
 *   3. **The answer**, rendered as markdown.
 */

type Msg = {
  id: number;
  role: "you" | "assistant";
  text: string;
  /** What it looked at, in the order it looked. */
  steps: string[];
  /** The model reasons out loud before answering. Kept apart from the answer. */
  reasoning: string;
  streaming: boolean;
  error: string;
};

/** Matches the route's cap; a long register is cut rather than refused. */
const SCREEN_LIMIT = 12000;

/**
 * The visible text of the page behind the panel, read at the moment of asking
 * so it is the screen the question was about and not the one it opened on.
 *
 * `innerText` rather than `textContent`: it skips what is hidden, keeps rows
 * on their own lines, and so reads the page the way the person does. The panel
 * is outside `<main>`, so the conversation never quotes itself.
 */
function readScreen(): { title?: string; text?: string } {
  const main = document.querySelector("main");
  if (!main) return {};
  const title = main.querySelector("h1")?.textContent?.trim() || undefined;
  let text = main.innerText
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
  if (text.length > SCREEN_LIMIT) text = `${text.slice(0, SCREEN_LIMIT - 1)}…`;
  return { title, text: text || undefined };
}

type Event =
  | { type: "step"; label: string }
  | { type: "reasoning"; delta: string }
  | { type: "text"; delta: string }
  | { type: "error"; message: string }
  | { type: "done" };

export function Assistant({
  greetingName,
  suggestions,
  configured,
  scopeNote,
}: {
  greetingName: string;
  suggestions: string[];
  /** False when no API key is set; the composer explains rather than fails. */
  configured: boolean;
  /** One line saying exactly what the assistant can see. */
  scopeNote: string;
}) {
  const panel = useAssistantPanel();
  const pathname = usePathname();
  const page = pageKnowledge(pathname);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  // Whether the page behind the panel goes with each question. On by default —
  // that is the point of asking from beside it — and one tap to withhold.
  const [sharePage, setSharePage] = useState(true);

  const threadRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const idRef = useRef(0);
  // Whether the reader is following along at the bottom. A thread that yanks
  // itself down while someone is re-reading an earlier answer is unusable.
  const pinned = useRef(true);

  const empty = messages.length === 0;
  const canSend = configured && !busy && draft.trim().length > 0;

  const onScroll = useCallback(() => {
    const el = threadRef.current;
    if (!el) return;
    pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);

  useEffect(() => {
    const el = threadRef.current;
    if (!el || !pinned.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  const grow = useCallback(() => {
    const el = boxRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);

  // The height has to be recomputed when the box gets narrower, not only when
  // it is typed into. Rotating a phone, or opening the console on a 320px
  // screen, rewraps the text into more lines than the height set for the old
  // width — and the last line was being clipped by the fixed height left over
  // from before. A ResizeObserver catches every cause of that, including the
  // sidebar drawer opening, which a window resize listener does not.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    grow();
    // Width only. `grow` sets the element's own height, so an observer that
    // reacted to height would re-enter itself on every call.
    let lastWidth = el.clientWidth;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth === lastWidth) return;
      lastWidth = el.clientWidth;
      grow();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [grow]);

  // Opening the panel is asking to type. Not on touch, where focusing the box
  // throws a keyboard over the suggestions the person opened it to read.
  const panelOpen = panel?.open ?? false;
  useEffect(() => {
    if (!panelOpen) return;
    if (window.matchMedia("(pointer: fine)").matches) boxRef.current?.focus();
  }, [panelOpen]);

  function stop() {
    abortRef.current?.abort();
  }

  function newChat() {
    stop();
    setMessages([]);
    setDraft("");
    pinned.current = true;
    boxRef.current?.focus();
  }

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy || !configured) return;

    const mine: Msg = {
      id: (idRef.current += 1),
      role: "you",
      text: question,
      steps: [],
      reasoning: "",
      streaming: false,
      error: "",
    };
    const live: Msg = {
      id: (idRef.current += 1),
      role: "assistant",
      text: "",
      steps: [],
      reasoning: "",
      streaming: true,
      error: "",
    };

    // The wire transcript is what came before plus this question — never the
    // steps or the reasoning, which are ours to display and not the model's to
    // re-read.
    const history = [
      ...messages
        .filter((m) => m.text.trim())
        .map((m) => ({
          role: m.role === "you" ? ("user" as const) : ("assistant" as const),
          content: m.text,
        })),
      { role: "user" as const, content: question },
    ];

    setMessages((prev) => [...prev, mine, live]);
    setDraft("");
    setBusy(true);
    pinned.current = true;
    requestAnimationFrame(grow);

    // Every update rewrites the last message from the mutable `live` object, so
    // a token arriving mid-render cannot be lost to a stale closure.
    const flush = () =>
      setMessages((prev) =>
        prev.map((m) => (m.id === live.id ? { ...live } : m)),
      );

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: history,
          // Only from the panel: on the standalone page the "screen" is this
          // conversation. The server turns the path into page notes; the text
          // is what this person is already looking at, and grants nothing.
          page:
            panel && sharePage
              ? { path: pathname, ...readScreen() }
              : undefined,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "The assistant is unavailable.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // NDJSON: one event per line, and a chunk can end mid-line, so the
        // remainder is carried over to the next read.
        let newline: number;
        while ((newline = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (!line) continue;

          let event: Event;
          try {
            event = JSON.parse(line) as Event;
          } catch {
            continue;
          }

          if (event.type === "text") live.text += event.delta;
          else if (event.type === "reasoning") live.reasoning += event.delta;
          else if (event.type === "step") live.steps = [...live.steps, event.label];
          else if (event.type === "error") live.error = event.message;
          flush();
        }
      }
    } catch (err) {
      // An abort is the Stop button doing its job, not a failure. Whatever had
      // already streamed in stays on screen.
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        live.error = err instanceof Error ? err.message : "Something went wrong.";
      }
    } finally {
      live.streaming = false;
      flush();
      abortRef.current = null;
      setBusy(false);
      boxRef.current?.focus();
    }
  }

  const newChatButton = (
    <button
      type="button"
      onClick={newChat}
      disabled={empty && !busy}
      title="New chat"
      aria-label="New chat"
      className={cn(
        "press flex items-center justify-center border border-app-line text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-40",
        panel ? "size-8 rounded-lg" : "size-9 rounded-full bg-card",
      )}
    >
      <SquarePen className="size-4" strokeWidth={1.9} />
    </button>
  );

  const header = panel ? (
    // One header for the panel. The close button sits with "New chat" because
    // both act on the panel rather than on any one message.
    <div className="flex items-center gap-2.5 border-b border-app-line-soft px-4 py-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/12 text-violet-600 dark:text-violet-300">
        <Sparkles className="size-4" strokeWidth={1.9} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="truncate font-display text-sm font-semibold tracking-tight">
          Assistant
        </span>
        <span className="truncate text-[11px] text-muted-foreground">
          {configured ? "Connected" : "Not connected"}
        </span>
      </span>
      {newChatButton}
      <button
        type="button"
        onClick={panel.close}
        aria-label="Close the assistant"
        className="press flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
      >
        <X className="size-4.5" strokeWidth={2} />
      </button>
    </div>
  ) : (
    <PageHeader
      eyebrow="Ask"
      title="Assistant"
      action={
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-full px-3 py-1.5 text-[11px] font-semibold tracking-wide",
              configured
                ? "bg-violet-500/12 text-violet-700 dark:text-violet-300"
                : "bg-muted text-muted-foreground",
            )}
          >
            {configured ? "Connected" : "Not connected"}
          </span>
          {newChatButton}
        </div>
      }
    />
  );

  const body = (
    <>
      <div
        ref={threadRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto scroll-smooth p-4 motion-reduce:scroll-auto sm:p-6"
      >
        {empty ? (
          <div className="flex h-full flex-col items-center justify-center gap-2.5 py-6 text-center">
            <span className="flex size-13 items-center justify-center rounded-2xl bg-violet-500/12 text-violet-600 dark:text-violet-300">
              <Sparkles className="size-6" strokeWidth={1.6} />
            </span>
            <h2
              className={cn(
                "mt-1 font-display font-semibold tracking-tight",
                panel ? "text-xl" : "text-2xl",
              )}
            >
              What can I do for you, {greetingName}?
            </h2>
            <p className="max-w-[52ch] text-sm leading-relaxed text-muted-foreground">
              {scopeNote}
            </p>
            {/* It knows where you are. Saying so is what makes "what is this
                page for?" a question somebody thinks to ask. */}
            {panel && sharePage && page && (
              <p className="text-xs text-muted-foreground">
                It can also see the{" "}
                <span className="font-medium text-foreground">{page.title}</span> page
                you have open.
              </p>
            )}
            <ul className="mt-4 flex max-w-2xl flex-wrap justify-center gap-2">
              {suggestions.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => send(s)}
                    disabled={!configured}
                    className="press rounded-full border border-app-line-soft bg-muted/60 px-3.5 py-2 text-left text-xs font-medium text-muted-foreground outline-none transition-colors hover:border-app-line hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-50 sm:text-[13px]"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
            {!configured && (
              <p className="mt-3 text-xs text-muted-foreground">
                No API key is configured on the server yet.
              </p>
            )}
          </div>
        ) : (
          <ul className="flex flex-col gap-6">
            {messages.map((m) => (
              <li
                key={m.id}
                className={cn(
                  "flex max-w-[70ch] min-w-0 flex-col gap-1.5",
                  m.role === "you" && "ml-auto items-end text-right",
                )}
              >
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.14em] uppercase",
                    m.role === "you"
                      ? "text-muted-foreground/70"
                      : "text-violet-600 dark:text-violet-300",
                  )}
                >
                  {m.role === "assistant" && (
                    <Sparkles className="size-3" strokeWidth={1.9} aria-hidden />
                  )}
                  {m.role === "you" ? "You" : "Assistant"}
                </span>

                {m.role === "you" ? (
                  <p className="rounded-2xl rounded-br-md border border-app-line-soft bg-muted/60 px-4 py-2.5 text-left text-sm leading-relaxed break-words whitespace-pre-wrap">
                    {m.text}
                  </p>
                ) : (
                  <>
                    {m.reasoning && (
                      // Open while it is the only thing there is to read, and
                      // shut the moment the answer starts — useful for seeing
                      // why a figure was reached, noise the rest of the time.
                      <details
                        open={m.streaming && !m.text.trim()}
                        className="w-fit max-w-full self-start rounded-xl border border-app-line-soft bg-muted/50 px-3 py-1.5 text-xs open:w-full"
                      >
                        <summary className="cursor-pointer list-none font-semibold text-muted-foreground outline-none marker:content-none focus-visible:ring-2 focus-visible:ring-ring/60 [&::-webkit-details-marker]:hidden">
                          <span className="mr-1.5 inline-block transition-transform duration-200 [details[open]_&]:rotate-90 motion-reduce:transition-none">
                            ▸
                          </span>
                          {m.streaming && !m.text.trim() ? "Thinking…" : "Thought it through"}
                        </summary>
                        <p className="mt-2 max-h-48 overflow-y-auto text-xs leading-relaxed break-words whitespace-pre-wrap text-muted-foreground">
                          {m.reasoning}
                        </p>
                      </details>
                    )}

                    {m.steps.length > 0 && (
                      <ul className="flex flex-col gap-1 py-0.5">
                        {m.steps.map((step, i) => (
                          <li
                            key={i}
                            className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground"
                          >
                            <Check
                              className="size-3 shrink-0 text-emerald-600 dark:text-emerald-400"
                              strokeWidth={2.6}
                              aria-hidden
                            />
                            {step}
                          </li>
                        ))}
                      </ul>
                    )}

                    {m.text.trim() && <Markdown source={m.text.trim()} />}

                    {m.streaming && !m.text.trim() && !m.reasoning && (
                      <p className="flex items-center gap-1" aria-label="Working">
                        <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground motion-reduce:animate-none motion-reduce:opacity-50" />
                        <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:150ms] motion-reduce:animate-none motion-reduce:opacity-50" />
                        <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:300ms] motion-reduce:animate-none motion-reduce:opacity-50" />
                      </p>
                    )}

                    {m.error && (
                      <p className="mt-1 flex items-start gap-2 rounded-xl bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">
                        <TriangleAlert className="mt-px size-3.5 shrink-0" />
                        {m.error}
                      </p>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div
        className={cn(
          "flex flex-col gap-2.5 border-t border-app-line-soft p-3 sm:px-4 sm:pt-3.5 sm:pb-4",
          // Full screen inside the app, the composer must clear the home
          // indicator; the inset is 0 everywhere else.
          panel && "pb-[calc(--spacing(3)+env(safe-area-inset-bottom))] lg:pb-4",
        )}
      >
        <textarea
          ref={boxRef}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            grow();
          }}
          onKeyDown={(e) => {
            // Enter sends; Shift + Enter is a new line. A composer that needs
            // a mouse to submit is a composer nobody uses twice.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(draft);
            }
          }}
          rows={1}
          disabled={!configured}
          placeholder={
            configured
              ? "Ask about attendance, sites or guards…"
              : "Not connected — add an API key on the server to enable this."
          }
          aria-label="Message the assistant"
          className="max-h-50 min-h-11 w-full resize-none rounded-xl border border-app-line bg-background px-3.5 py-2.5 text-sm leading-relaxed outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring/60 focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-60"
        />

        <div className="flex items-center gap-3">
          {panel ? (
            // What goes with the question, said where the question is
            // written — and withheld with one tap.
            <button
              type="button"
              onClick={() => setSharePage((v) => !v)}
              aria-pressed={sharePage}
              title={
                sharePage
                  ? "The text of the page you have open is sent with each question. Tap to stop."
                  : "Tap to let the assistant see the page you have open."
              }
              className={cn(
                "press mr-auto flex min-w-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60",
                sharePage
                  ? "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300"
                  : "border-app-line text-muted-foreground hover:text-foreground",
              )}
            >
              {sharePage ? (
                <Eye className="size-3.5 shrink-0" strokeWidth={1.9} aria-hidden />
              ) : (
                <EyeOff className="size-3.5 shrink-0" strokeWidth={1.9} aria-hidden />
              )}
              <span className="truncate">
                {sharePage ? `Sees: ${page?.title ?? "this page"}` : "Page not shared"}
              </span>
            </button>
          ) : (
            <p className="mr-auto text-[11px] leading-snug text-muted-foreground">
              Enter to send · Shift + Enter for a new line.{" "}
              <span className="max-sm:hidden">
                Answers come from your own records — check anything you are about to act on.
              </span>
            </p>
          )}

          {busy ? (
            <button
              type="button"
              onClick={stop}
              aria-label="Stop"
              className="press flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              <Square className="size-3" strokeWidth={2.4} fill="currentColor" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => send(draft)}
              disabled={!canSend}
              aria-label="Send"
              className="press flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-35"
            >
              <ArrowUp className="size-4.5" strokeWidth={2.2} />
            </button>
          )}
        </div>
      </div>
    </>
  );

  // One card, not two. In the panel the `<aside>` is already the card, so this
  // is only the frame — `h-full` to fill it with the composer on the bottom
  // edge. The standalone page draws its own card of a fixed height.
  return panel ? (
    <div className="flex h-full min-h-0 flex-col">
      {header}
      {body}
    </div>
  ) : (
    <>
      {header}
      <div className="flex h-[min(72vh,780px)] min-h-[26rem] flex-col overflow-hidden rounded-2xl border border-app-line-soft bg-card shadow-card">
        {body}
      </div>
    </>
  );
}
