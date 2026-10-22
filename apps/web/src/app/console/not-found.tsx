import { SearchX } from "lucide-react";
import Link from "next/link";

export default function ConsoleNotFound() {
  return (
    <div className="grid min-h-[60svh] place-items-center">
      <div className="max-w-md rounded-3xl border-2 border-border bg-elevated p-8 text-center shadow-e1">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-muted">
          <SearchX className="size-6 text-secondary-fg" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-[-0.02em]">No such page in the console.</h1>
        <p className="mt-2 text-secondary-fg">It may have moved, or the link is mistyped. A record may also have been removed.</p>
        <Link href="/console" className="mt-6 inline-flex h-11 items-center rounded-full bg-ink px-5 text-sm font-medium text-ink-fg">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
