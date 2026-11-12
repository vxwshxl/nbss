"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { PeriodBar } from "@/components/console/period-bar";

/** The period bar for a server-rendered page: a new period is a new URL, other filters kept. */
export function PeriodNav({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const go = (f: string, t: string) => {
    const q = new URLSearchParams(params.toString());
    q.set("from", f);
    q.set("to", t);
    router.replace(`${pathname}?${q}`);
  };
  return <PeriodBar from={from} to={to} onChange={go} />;
}
