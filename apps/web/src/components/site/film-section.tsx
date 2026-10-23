"use client";

import { Maximize2, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Right after the hero: the NBSS parade film under its heading, at its full size from the start.
 * It used to grow out of a small tilted card on scroll, which read as a glitch; now it simply sits
 * there, and the corner button opens it full screen.
 *
 * It starts by itself once on screen, with sound where the browser allows it. Browsers refuse
 * sound until the visitor has clicked, tapped or pressed a key on the page (scrolling doesn't
 * count), so then it plays muted and their first tap anywhere turns the sound on. The corner
 * speaker, or a tap on the film, toggles it like a reel.
 *
 * Full screen goes to the video element where the browser allows it (the native player, with
 * its own controls) and falls back to iOS Safari's webkitEnterFullscreen.
 */
export function FilmSection() {
  const video = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const userMuted = useRef(false);

  // Plays while on screen (with sound if allowed), pauses when scrolled away.
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const unmuteOnFirstTap = () => {
      if (userMuted.current) return;
      v.muted = false;
      setMuted(false);
      if (!v.paused) return;
      void v.play().catch(() => {});
    };
    const start = async () => {
      if (!userMuted.current) {
        v.muted = false;
        try {
          await v.play();
          setMuted(false);
          return;
        } catch {
          // No sound before the visitor has interacted with the page: play muted instead.
        }
      }
      v.muted = true;
      setMuted(true);
      await v.play().catch(() => {});
      for (const e of ["pointerdown", "keydown", "touchend"]) addEventListener(e, unmuteOnFirstTap, { once: true, passive: true });
    };
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) void start();
        else v.pause();
      },
      { threshold: 0.5 },
    );
    io.observe(v);
    return () => {
      io.disconnect();
      for (const e of ["pointerdown", "keydown", "touchend"]) removeEventListener(e, unmuteOnFirstTap);
    };
  }, []);

  const fullscreen = () => {
    const v = video.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (!v) return;
    if (v.requestFullscreen) void v.requestFullscreen().catch(() => v.webkitEnterFullscreen?.());
    else v.webkitEnterFullscreen?.();
    if (v.paused) void v.play().catch(() => {});
  };

  const toggle = () => {
    const v = video.current;
    if (!v) return;
    v.muted = !v.muted;
    userMuted.current = v.muted;
    setMuted(v.muted);
    if (v.paused) void v.play().catch(() => {});
  };

  return (
    <section aria-labelledby="film-title" className="relative overflow-hidden bg-subtle px-4 py-20 sm:px-8 sm:py-28">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_60%,color-mix(in_oklab,var(--ds-accent)_14%,transparent),transparent)]" />
      <div className="relative mx-auto max-w-3xl text-center">
        <p className="eyebrow">On the parade ground</p>
        <h2 id="film-title" className="display-section mt-3 text-[clamp(1.75rem,4vw,3.25rem)] text-foreground">
          Trained and drilled, <span className="text-secondary-fg">before they reach your gate.</span>
        </h2>
      </div>
      <div className="relative mx-auto mt-10 w-[min(72rem,100%,calc((100svh-84px-2.5rem)*16/9))] overflow-hidden rounded-[22px] bg-ink shadow-e3 sm:mt-14">
        <video
          ref={video}
          muted
          playsInline
          loop
          preload="metadata"
          poster="/img/nbss/parade-night.jpg"
          onClick={toggle}
          className="block aspect-video w-full cursor-pointer"
          aria-label="NBSS guards on parade"
        >
          <source src="/video/nbss-parade.mp4" type="video/mp4" />
        </video>
        <div className="absolute right-3 bottom-3 flex gap-2 sm:right-5 sm:bottom-5">
          <button
            type="button"
            onClick={toggle}
            aria-label={muted ? "Turn sound on" : "Mute"}
            aria-pressed={!muted}
            className="grid size-11 place-items-center rounded-full bg-ink/60 text-white backdrop-blur transition-transform hover:scale-105 active:scale-95"
          >
            {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
          </button>
          <button
            type="button"
            onClick={fullscreen}
            aria-label="Play full screen"
            className="grid size-11 place-items-center rounded-full bg-ink/60 text-white backdrop-blur transition-transform hover:scale-105 active:scale-95"
          >
            <Maximize2 className="size-5" />
          </button>
        </div>
      </div>
    </section>
  );
}
