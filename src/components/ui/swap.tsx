import { cn } from "@/lib/utils";

/**
 * Crossfades a control's content between two states without resizing it.
 *
 * Both states occupy the same grid cell, so the box is always as wide as the
 * wider of the two and nothing reflows when it flips — the usual
 * `{pending && <Spinner/>}` pattern shoves the label sideways at the exact
 * moment the user is watching it.
 *
 * The blur is the part that matters. A plain crossfade shows two legible,
 * overlapping strings mid-transition, which reads as two objects; blurring both
 * as they pass bridges the gap so the eye accepts it as one thing changing.
 * Kept at 2px — heavy blur is expensive to composite, especially in Safari.
 */
export function Swap({
  busy,
  idle,
  pending,
  className,
}: {
  /** Content while the action is running. */
  busy: React.ReactNode;
  /** Content at rest. */
  idle: React.ReactNode;
  pending: boolean;
  className?: string;
}) {
  return (
    <span className={cn("grid place-items-center *:[grid-area:1/1]", className)}>
      <span
        aria-hidden={pending}
        data-off={pending || undefined}
        className="inline-flex items-center gap-1.5 transition-[opacity,filter] duration-200 ease-out-strong data-off:opacity-0 data-off:blur-[2px]"
      >
        {idle}
      </span>
      <span
        aria-hidden={!pending}
        data-off={!pending || undefined}
        className="inline-flex items-center gap-1.5 transition-[opacity,filter] duration-200 ease-out-strong data-off:opacity-0 data-off:blur-[2px]"
      >
        {busy}
      </span>
    </span>
  );
}
