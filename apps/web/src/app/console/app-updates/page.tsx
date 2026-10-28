import type { Metadata } from "next";
import { Download, Smartphone } from "lucide-react";

import { AppReleaseForm } from "@/components/console/app-release-form";
import { PageHeader } from "@/components/console/page-header";
import { Panel } from "@/components/ui/panel";
import { requireRole } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "App updates" };
export const dynamic = "force-dynamic";

/** "1.0.0 (24)" → 24. Phones before the build number was reported send just "1.0.0". */
function buildOf(version: string | null): number | null {
  const m = /\((\d+)\)\s*$/.exec(version ?? "");
  return m ? Number(m[1]) : null;
}

/**
 * Tells the app a newer build is out. Whatever is published here, a phone on a
 * lower build number shows a full-screen "Update available" page with a button
 * to the Play Store, at launch and whenever it comes back to the front.
 */
export default async function AppUpdatesPage() {
  await requireRole("admin");
  const admin = supabaseAdmin();

  const [{ data: release }, { data: phones }] = await Promise.all([
    admin.from("app_release").select("version_code, version_name, store_url, notes, updated_at").eq("id", 1).maybeSingle(),
    admin.from("guard_devices").select("app_version, last_seen_at").order("last_seen_at", { ascending: false }),
  ]);

  const current = release ?? { version_code: 0, version_name: null, store_url: null, notes: null, updated_at: null };
  const builds = new Map<string, number>();
  let behind = 0;
  for (const p of phones ?? []) {
    const build = buildOf(p.app_version);
    const key = build === null ? "Older app (no build number)" : `Build ${build}`;
    builds.set(key, (builds.get(key) ?? 0) + 1);
    if (current.version_code > 0 && (build === null || build < current.version_code)) behind += 1;
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Administration" title="App updates" />

      <Panel tone="emerald" title="Latest release" icon={Download}>
        <p className="mb-4 text-sm text-muted-foreground">
          When a new build is on the Play Store, enter its build number and link here. Every phone on an
          older build then shows an &ldquo;Update available&rdquo; screen with a button to the store. People
          can choose Later; it asks again the next time the app is opened.
        </p>
        <AppReleaseForm release={current} />
      </Panel>

      <Panel tone="slate" title="Phones" icon={Smartphone}>
        {phones?.length ? (
          <div className="space-y-3">
            {current.version_code > 0 && (
              <p className="text-sm">
                <span className="font-semibold tabular-nums">{behind}</span> of{" "}
                <span className="tabular-nums">{phones.length}</span> phones are on a build below {current.version_code}.
              </p>
            )}
            <ul className="grid gap-2 sm:grid-cols-3">
              {[...builds.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([label, count]) => (
                  <li key={label} className="flex items-center justify-between rounded-xl border border-app-line-soft px-3 py-2 text-sm">
                    <span>{label}</span>
                    <span className="font-semibold tabular-nums">{count}</span>
                  </li>
                ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Each phone reports its build when it opens the app. Apps installed before build numbers were reported
              show as &ldquo;Older app&rdquo; until they update.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No phones have reported in yet.</p>
        )}
      </Panel>
    </div>
  );
}
