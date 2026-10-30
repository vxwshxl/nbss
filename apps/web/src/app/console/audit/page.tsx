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

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ period?: string; at?: string }> }) {
  await requireRole("admin");
  const today = istDay(0);
  const { period, at } = readPeriod(await searchParams, today);
  const { from, to } = periodBounds(period, at);
  const supabase = await supabaseServer();

  // One day, month or year at a time, as the table only grows.
  const { data } = await supabase
    .from("audit_log")
    .select("id, actor_id, actor_code, action, entity, entity_id, detail, ip, created_at")
    // "View as" is a developer's tool, not something the office needs to read here.
    .not("action", "in", "(impersonation_started,impersonation_stopped)")
    .gte("created_at", from.toISOString())
    .lt("created_at", to.toISOString())
    .order("created_at", { ascending: false })
    .limit(5000);
  const raw = data ?? [];

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
  const siteId = (r: (typeof raw)[number]): string | null => {
    if (r.entity === "sites" && r.entity_id && uuid.test(r.entity_id)) return r.entity_id;
    const s = detailOf(r).site;
    return typeof s === "string" && uuid.test(s) ? s : null;
  };
  const people = [...new Set(raw.map(personId).filter((x): x is string => !!x))];
  const places = [...new Set(raw.map(siteId).filter((x): x is string => !!x))];
  const [{ data: who }, { data: where }] = await Promise.all([
    people.length ? supabase.from("profiles").select("id, full_name, phone, employee_code").in("id", people) : Promise.resolve({ data: [] }),
    places.length ? supabase.from("sites").select("id, name").in("id", places) : Promise.resolve({ data: [] }),
  ]);
  const personBy = new Map((who ?? []).map((p) => [p.id, p]));
  const siteBy = new Map((where ?? []).map((s) => [s.id, s.name]));

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
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Administration" title="Audit log" />
      <PeriodSwitch period={period} at={at} today={today} />

      <Panel
        tone="slate"
        title={`${raw.length.toLocaleString("en-IN")} action${raw.length === 1 ? "" : "s"} · ${periodTitle(period, at, today)}${raw.length >= 5000 ? " (latest 5,000)" : ""}`}
        icon={ScrollText}
        bodyClassName="p-3 sm:p-4"
      >
        <AuditWorkspace rows={rows} />
      </Panel>

      <p className="text-xs text-muted-foreground">
        Append-only and retained indefinitely. Treat it as a business record.
      </p>
    </div>
  );
}
