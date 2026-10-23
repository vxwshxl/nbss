"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { Loader2, MapPinOff } from "lucide-react";

import { baseOptions, loadGoogleMaps } from "@/lib/google-maps";
import { cn } from "@/lib/utils";

/**
 * Creates one Google map in `host` and keeps it for the life of the component.
 * The map is never recreated when data changes — that would reset the reader's
 * pan and zoom on every live update — so callers draw onto it in their own
 * effects, keyed on `map`.
 */
export function useGoogleMap(host: RefObject<HTMLDivElement | null>, options?: google.maps.MapOptions) {
  const [state, setState] = useState<{ maps: typeof google.maps; map: google.maps.Map } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const initial = useRef(options);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !host.current) return;
        const map = new maps.Map(host.current, baseOptions(initial.current));
        setState({ maps, map });
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [host]);

  return { maps: state?.maps ?? null, map: state?.map ?? null, error };
}

/** The frame every console map sits in: rounded, with a loading and an error state. */
export function MapFrame({
  hostRef,
  ready,
  error,
  height,
  className,
  children,
}: {
  hostRef: RefObject<HTMLDivElement | null>;
  ready: boolean;
  error: string | null;
  height?: number | string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn("relative overflow-hidden rounded-xl border border-app-line-soft bg-muted", className)}
      style={height !== undefined ? { height } : undefined}
    >
      <div ref={hostRef} className="size-full" />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          {error ? (
            <>
              <MapPinOff className="size-4" />
              {error}
            </>
          ) : (
            <>
              <Loader2 className="size-4 animate-spin" />
              Loading the map…
            </>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
