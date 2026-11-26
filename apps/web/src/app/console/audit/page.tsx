import { fetchAll } from "@nbss/shared/paging";
import type { Metadata } from "next";
import { ScrollText } from "lucide-react";

import { AuditWorkspace, type AuditRow } from "@/components/console/audit-workspace";
import { PageHeader } from "@/components/console/page-header";
import { PeriodSwitch } from "@/components/console/period-switch";
import { Panel } from "@/components/ui/panel";
import { requireRole } from "@/lib/auth";
import { periodBounds, periodTitle, readPeriod } from "@/lib/period";
import { istDay } from "@/lib/roster";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Audit log" };
export const dynamic = "force-dynamic";

type LogRow = {
  id: number;
  actor_id: string | null;
  actor_code: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  detail: unknown;
  ip: string | null;
  created_at: string;
  source?: string;
  before?: unknown;
  after?: unknown;
};

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ period?: string; at?: string }> }) {
  await requireRole("admin");
  const today = istDay(0);
  const { period, at } = readPeriod(await searchParams, today);
  const { from, to } = periodBounds(period, at);
  const supabase = await supabaseServer();

  // One day, month or year at a time, as the table only grows.
  const read = (columns: string) =>
    fetchAll(
      supabase
        .from("audit_log")
        .select(columns)
        // "View as" is a developer's tool, not something the office needs to read here.
        .not("action", "in", "(impersonation_started,impersonation_stopped)")
        .gte("created_at", from.toISOString())
        .lt("created_at", to.toISOString())
        .order("created_at", { ascending: false }),
    ) as unknown as Promise<{ data: LogRow[]; error: { message: string } | null }>;
  const base = "id, actor_id, actor_code, action, entity, entity_id, detail, ip, created_at";
  let { data, error } = await read(`${base}, source, before, after`);
  // Until migration 0081 is applied the log has no before/after: read it as before.
  if (error) ({ data, error } = await read(base));
  const raw = data;

  /**
   * Who and where, by name. A guard's check-in is logged with their id but no code,
   * and a sign-in names the person as the record rather than the actor, so each row is
   * read for the person it is about: the actor, else the profile it concerns, else the
   * guard in its detail. The site is the record (check-in, check-out) or in the detail.
   */
  const uuid = /^[0-9a-f-]{36}$/i;
  const detailOf = (r: (typeof raw)[number]) => (r.detail ?? {}) as Record<string, unknown>;
  const personId = (r: (typeof raw)[number]): string | null => {
    if (r.actor_id) return r.actor_id;
    if (r.entity === "profiles" && r.entity_id && uuid.test(r.entity_id)) return r.entity_id;
    const g = detailOf(r).guard;
    return typeof g === "string" && uuid.test(g) ? g : null;
  };
  const rowOf = (r: (typeof raw)[number]) => ((r.after ?? r.before ?? {}) as Record<string, unknown>);
  const siteId = (r: (typeof raw)[number]): string | null => {
    if (r.entity === "sites" && r.entity_id && uuid.test(r.entity_id)) return r.entity_id;
    const s = r.source === "trigger" ? rowOf(r).site_id : detailOf(r).site;
    return typeof s === "string" && uuid.test(s) ? s : null;
  };

  // Every id inside a recorded change (guard, site, reviewer…), so the console can
  // say "Saniya Narzary" where the record says 3dd67060-….
  const inside = new Set<string>();
  for (const r of raw) {
    if (r.source !== "trigger") continue;
    for (const side of [r.before, r.after] as unknown[]) {
      if (!side || typeof side !== "object") continue;
      for (const v of Object.values(side as Record<string, unknown>)) if (typeof v === "string" && uuid.test(v)) inside.add(v);
    }
  }
  const people = [...new Set([...raw.map(personId).filter((x): x is string => !!x), ...inside])];
  const places = [...new Set([...raw.map(siteId).filter((x): x is string => !!x), ...inside])];
  const chunks = <T,>(xs: T[]) => Array.from({ length: Math.ceil(xs.length / 200) }, (_, i) => xs.slice(i * 200, i * 200 + 200));
  const [who, where] = await Promise.all([
    Promise.all(chunks(people).map((ids) => supabase.from("profiles").select("id, full_name, phone, employee_code").in("id", ids))).then((rs) => rs.flatMap((x) => x.data ?? [])),
    Promise.all(chunks(places).map((ids) => supabase.from("sites").select("id, name").in("id", ids))).then((rs) => rs.flatMap((x) => x.data ?? [])),
  ]);
  const personBy = new Map(who.map((p) => [p.id, p]));
  const siteBy = new Map(where.map((s) => [s.id, s.name]));
  const names: Record<string, string> = {};
  for (const id of inside) {
    const p = personBy.get(id);
    const s = siteBy.get(id);
    if (p) names[id] = p.employee_code ? `${p.full_name} (${p.employee_code})` : p.full_name;
    else if (s) names[id] = s;
  }

  const rows: AuditRow[] = raw.map((r) => {
    const p = personBy.get(personId(r) ?? "");
    const site = siteBy.get(siteId(r) ?? "");
    return {
      id: r.id,
      actor_code: r.actor_code ?? p?.employee_code ?? null,
      who: p ? { name: p.full_name, phone: p.phone } : null,
      site: site ?? null,
      action: r.action,
      entity: r.entity,
      entity_id: r.entity_id,
      detail: r.detail,
      ip: r.ip,
      created_at: r.created_at,
      source: r.source === "trigger" ? "trigger" : "app",
      before: (r.before ?? null) as Record<string, unknown> | null,
      after: (r.after ?? null) as Record<string, unknown> | null,
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Audit log" action={<PeriodSwitch period={period} at={at} today={today} inHeader />} />

      <Panel
        tone="slate"
        title={`${raw.length.toLocaleString("en-IN")} action${raw.length === 1 ? "" : "s"} · ${periodTitle(period, at, today)}${raw.length >= 5000 ? " (latest 5,000)" : ""}`}
        icon={ScrollText}
        bodyClassName="p-3 sm:p-4"
      >
        <AuditWorkspace rows={rows} names={names} />
      </Panel>

    </div>
  );
}
