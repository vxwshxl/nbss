"use client";

import { FileDown, Play } from "lucide-react";
import { useRef } from "react";

import { Card, CardTitle } from "./ui";

/** Chapter starts in the demo film, in seconds (apps/video, PLAN.scenes). */
const CHAPTERS = [
  { n: 1, title: "The website", at: 10, who: "Everyone" },
  { n: 2, title: "Clients book online", at: 28, who: "Client" },
  { n: 3, title: "Every role", at: 56, who: "Everyone" },
  { n: 4, title: "Booking to quote", at: 71, who: "Office" },
  { n: 5, title: "Sites & geofences", at: 85, who: "Office" },
  { n: 6, title: "The roster", at: 112, who: "Supervisor" },
  { n: 7, title: "Geofenced attendance", at: 133, who: "Guard" },
  { n: 8, title: "SOS", at: 155, who: "Guard" },
  { n: 9, title: "Stats & people", at: 187, who: "Office" },
  { n: 10, title: "The client's view", at: 201, who: "Client" },
];
const time = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** The demo film with its chapters, as birdev's guide shows its tutorial. */
export function GuideFilms() {
  const film = useRef<HTMLVideoElement>(null);
  const jump = (at: number) => {
    const v = film.current;
    if (!v) return;
    v.currentTime = at;
    void v.play();
    v.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  return (
    <Card className="h-auto">
      <CardTitle
        title="Watch how it works"
        hint="3 min 44 s · the website, every role, attendance and SOS"
        right={
          <a href="/video/nbss-guide.pdf" download className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-ink hover:underline">
            <FileDown className="size-4" /> PDF guide
          </a>
        }
      />
      <video ref={film} controls preload="metadata" poster="/video/nbss-demo-poster.jpg" className="aspect-video w-full rounded-2xl bg-ink">
        <source src="/video/nbss-demo.mp4" type="video/mp4" />
      </video>
      <ol className="mt-4 grid gap-2 @2xl/main:grid-cols-2">
        {CHAPTERS.map((c) => (
          <li key={c.n}>
            <button type="button" onClick={() => jump(c.at)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-subtle">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-subtle text-primary-ink">
                <Play className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium">
                  {c.n}. {c.title}
                </span>
                <span className="text-[12px] text-secondary-fg">
                  {c.who} · {time(c.at)}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </Card>
  );
}
