import type { Metadata } from "next";
import { Smartphone } from "lucide-react";

import { AppReleaseEditor } from "@/components/console/app-release-form";
import { PageHeader } from "@/components/console/page-header";
import { Panel } from "@/components/ui/panel";
import { requireRole } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "App updates" };
export const dynamic = "force-dynamic";

/**
 * "1.0.0 (25)" → { version: "1.0.0", build: 25 }. Apps from before build 24 send only
 * "1.0.0". Expo Go and the simulators are developers' test apps, not guards' phones.
 */
function parse(appVersion: string | null): { version: string | null; build: number | null; test: boolean } {
  const v = (appVersion ?? "").trim();
  const m = /^(.*?)\s*\((\d+)\)\s*$/.exec(v);
  const build = m ? Number(m[2]) : null;
  return { version: (m ? m[1] : v) || null, build, test: v === "sim" || (build != null && build > 100_000) };
}

/** The request's clock, read once. */
function thirtyDaysAgo(): string {
  return new Date(Date.now() - 30 * 86_400_000).toISOString();
}

type Person = { full_name: string; phone: string | null; employee_code: string; active: boolean; is_test: boolean | null };
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

/**
 * Tells the app a newer build is out. Whatever is published here, a phone on a
 * lower build number shows a full-screen "Update available" page with a button
 * to the Play Store, at launch and whenever it comes back to the front.
 */
export default async function AppUpdatesPage() {
  await requireRole("admin");
  const admin = supabaseAdmin();

  const since = thirtyDaysAgo();
  const [{ data: release }, { data: phones }] = await Promise.all([
    admin.from("app_release").select("version_code, version_name, store_url, notes, updated_at").eq("id", 1).maybeSingle(),
    admin
      .from("guard_devices")
      .select("id, app_version, brand, model, last_seen_at, profiles!guard_devices_profile_id_fkey(full_name, phone, employee_code, active, is_test)")
      .gte("last_seen_at", since)
      .order("last_seen_at", { ascending: false }),
  ]);

  const current = release ?? { version_code: 0, version_name: null, store_url: null, notes: null, updated_at: null };

  // Real phones only: in the last 30 days, of active people, not test or load-test accounts or developer test apps.
  const real = (phones ?? [])
    .map((d) => ({ d, p: one(d.profiles as unknown as Person | null), v: parse(d.app_version) }))
    .filter(({ p, v }) => p && p.active && !p.is_test && !/^(TEST|LOAD|E2F)-/.test(p.employee_code) && !v.test);

  const groups = new Map<string, { label: string; build: number | null; people: { name: string; phone: string | null; device: string }[] }>();
  for (const { d, p, v } of real) {
    const key = v.build == null ? "old" : String(v.build);
    const label = v.build == null ? "Before build 24" : `v${v.version ?? "?"} · build ${v.build}`;
    const g = groups.get(key) ?? { label, build: v.build, people: [] };
    g.people.push({ name: p!.full_name, phone: p!.phone, device: [d.brand, d.model].filter(Boolean).join(" ") || "Unknown phone" });
    groups.set(key, g);
  }
  const list = [...groups.values()].sort((a, b) => (b.build ?? -1) - (a.build ?? -1));
  const latestBuild = list.find((g) => g.build != null)?.build ?? null;
  const behind = current.version_code > 0 ? real.filter(({ v }) => v.build == null || v.build < current.version_code).length : 0;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Administration" title="App updates" />

      <AppReleaseEditor release={current} latestBuild={latestBuild} />

      <Panel tone="slate" title="Guards' phones" icon={Smartphone}>
        <p className="mb-4 text-sm text-muted-foreground">
          {real.length} phones used in the last 30 days, by the app build they run
          {current.version_code > 0 ? (
            <>
              . <span className="font-semibold text-foreground">{behind}</span> are below build {current.version_code} and see the update screen.
            </>
          ) : (
            "."
          )}{" "}
          Test accounts and developers&apos; test apps are left out.
        </p>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">No phones have reported in the last 30 days.</p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {list.map((g) => {
              const old = current.version_code > 0 && (g.build == null || g.build < current.version_code);
              return (
                <details key={g.label} className="group rounded-2xl border border-app-line-soft bg-card" open={list.length <= 2}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                    <span className="min-w-0">
                      <span className="block font-semibold">{g.label}</span>
                      <span className={old ? "text-xs font-medium text-amber-700" : "text-xs text-muted-foreground"}>
                        {g.build == null ? "Installed before builds were reported" : old ? "Asked to update" : "Up to date"}
                      </span>
                    </span>
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-sm font-bold tabular-nums">{g.people.length}</span>
                  </summary>
                  <ul className="divide-y divide-app-line-soft border-t border-app-line-soft">
                    {g.people.map((p, i) => (
                      <li key={`${p.name}-${i}`} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{p.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">{p.device}</span>
                        </span>
                        {p.phone && (
                          <a href={`tel:${p.phone}`} className="shrink-0 font-mono text-xs text-primary hover:underline">
                            {p.phone}
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </details>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
