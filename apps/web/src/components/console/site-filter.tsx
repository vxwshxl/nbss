"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Building2, Loader2 } from "lucide-react";

import { Dropdown } from "@/components/ui/dropdown";
import { cn } from "@/lib/utils";

/** All sites, or one: the `?site=` switch on the attendance pages. Other filters are kept. */
export function SiteFilter({ sites, value, className }: { sites: { id: string; name: string }[]; value?: string; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const go = (site: string) => {
    const q = new URLSearchParams(params.toString());
    if (site) q.set("site", site);
    else q.delete("site");
    // A punch opened from another site's list means nothing here.
    q.delete("record");
    start(() => router.push(`${pathname}${q.size ? `?${q}` : ""}`, { scroll: false }));
  };
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {pending ? <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" /> : <Building2 className="size-4 shrink-0 text-muted-foreground" />}
      <Dropdown
        options={[{ value: "", label: "All sites" }, ...sites.map((s) => ({ value: s.id, label: s.name }))]}
        value={value ?? ""}
        onValueChange={(v) => v !== (value ?? "") && go(v)}
        placeholder="All sites"
        searchPlaceholder="Search sites…"
        className="min-w-56 rounded-full bg-card shadow-e1 sm:w-72"
      />
    </div>
  );
}
