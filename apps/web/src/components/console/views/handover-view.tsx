import { PageHeader } from "@/components/console/page-header";
import { HandoverWorkspace, type AppNote, type HandoverNote } from "@/components/console/handover-workspace";
import { requireRoleSession } from "@/lib/auth";
import { periodBounds, readPeriod } from "@/lib/period";
import { istDay } from "@/lib/roster";
import { supabaseServer } from "@/lib/supabase/server";

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

/** What the app shows a guard at check-in: a site's last 3 notes from the past 3 days. */
const APP_NOTES = 3;
const APP_DAYS = 3;

function appSince(): string {
  return new Date(Date.now() - APP_DAYS * 86_400_000).toISOString();
}

/** `siteId`: one site's workspace shows only that site's notes. */
export async function HandoverView({ siteId, searchParams }: { siteId?: string; searchParams?: Promise<{ period?: string; at?: string }> }) {
  const session = await requireRoleSession("admin", "supervisor");
  const today = istDay(0);
  const { period, at } = readPeriod((await searchParams) ?? {}, today);
  const { from, to } = periodBounds(period, at);
  const supabase = await supabaseServer();
  const [notes, sites, recent] = await Promise.all([
    supabase
      .from("handover_notes")
      .select(
        "id, site_id, attendance_id, body, created_at, profiles!handover_notes_author_id_fkey(full_name, role, employee_code, phone, avatar_url), sites(name, district), attendance(check_in_at, check_out_at)",
      )
      .gte("created_at", from.toISOString())
      .lt("created_at", to.toISOString())
      .match(siteId ? { site_id: siteId } : {})
      .order("created_at", { ascending: false })
      .limit(2000),
    supabase.from("sites").select("id, name").eq("active", true).match(siteId ? { id: siteId } : {}).order("name"),
    supabase
      .from("handover_notes")
      .select("id, site_id, body, created_at, profiles!handover_notes_author_id_fkey(full_name)")
      .gte("created_at", appSince()).match(siteId ? { site_id: siteId } : {}).order("created_at", { ascending: false }),
  ]);

  // The notes a guard checking in now would see, per site.
  const shownNow = new Set<string>();
  const perSite = new Map<string, number>();
  const appNotes: AppNote[] = [];
  for (const n of recent.data ?? []) {
    const k = perSite.get(n.site_id) ?? 0;
    if (k < APP_NOTES) {
      shownNow.add(n.id);
      appNotes.push({
        id: n.id,
        siteId: n.site_id,
        body: n.body,
        author: one(n.profiles as unknown as { full_name: string } | null)?.full_name ?? "Someone",
        createdAt: n.created_at,
      });
    }
    perSite.set(n.site_id, k + 1);
  }

  const rows: HandoverNote[] = (notes.data ?? []).map((n) => {
    const p = one(n.profiles as unknown as { full_name: string; role: string; employee_code: string | null; phone: string | null; avatar_url: string | null } | null);
    const s = one(n.sites as unknown as { name: string; district: string | null } | null);
    const a = one(n.attendance as unknown as { check_in_at: string | null; check_out_at: string | null } | null);
    return {
      id: n.id,
      siteId: n.site_id,
      siteName: s?.name ?? "A site",
      district: s?.district ?? null,
      author: p?.full_name ?? "Someone",
      authorRole: p?.role ?? "guard",
      authorCode: p?.employee_code ?? null,
      authorPhone: p?.phone ?? null,
      avatarUrl: p?.avatar_url ?? null,
      body: n.body,
      createdAt: n.created_at,
      atCheckOut: !!n.attendance_id,
      shiftIn: a?.check_in_at ?? null,
      shiftOut: a?.check_out_at ?? null,
      inApp: shownNow.has(n.id),
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Shift management" title="Handover notes" />
      <HandoverWorkspace
        notes={rows}
        appNotes={appNotes}
        sites={sites.data ?? []}
        period={period}
        at={at}
        today={today}
        canEdit={!session.impersonating}
        oneSite={!!siteId}
        capped={(notes.data ?? []).length >= 2000}
      />
    </div>
  );
}
