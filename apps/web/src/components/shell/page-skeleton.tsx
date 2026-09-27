import { Skeleton } from "@/components/ui/skeleton";

/**
 * What a console page looks like while its data is on the way.
 *
 * Served as each console's `loading.tsx`. That file is what lets Next prefetch
 * a dynamic page at all (only the shell up to the nearest loading boundary is
 * fetched ahead), and it is what makes a click answer at once: without it the
 * old page sat frozen until the server had rendered the whole new one.
 *
 * Deliberately generic — a title, a row of tiles, a panel — so it resembles
 * most pages without pretending to be any one of them. It fades in after a
 * beat, so a page that arrives quickly never flashes a skeleton at all.
 */
export function PageSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="animate-in fade-in-0 fill-mode-both flex flex-col gap-6 delay-150 duration-300"
    >
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-64 max-w-[70%] rounded-lg" />
        <Skeleton className="h-4 w-80 max-w-[85%]" />
      </div>
      <div className="grid grid-cols-2 gap-4 @4xl/main:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="flex flex-col gap-3 rounded-2xl border border-app-line-soft bg-card p-4 shadow-card"
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-16 rounded-lg" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3 rounded-2xl border border-app-line-soft bg-card p-4 shadow-card">
        <Skeleton className="h-5 w-40" />
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
