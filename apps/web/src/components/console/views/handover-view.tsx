
import { PageHeader } from "@/components/console/page-header";
import { HandoverWorkspace, type HandoverNote } from "@/components/console/handover-workspace";
import { requireRole } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";


const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

function monthAgo(): string {
  return new Date(Date.now() - 30 * 86_400_000).toISOString();
}

/** `siteId`: one site's workspace shows only that site's notes. */
export async function HandoverView({ siteId }: { siteId?: string } = {}) {
  await requireRole("admin", "supervisor");
  const supabase = await supabaseServer();
  const [notes, sites] = await Promise.all([
    supabase
      .from("handover_notes")
      .select("id, site_id, body, created_at, profiles!handover_notes_author_id_fkey(full_name, role), sites(name)")
      .gte("created_at", monthAgo())
      .match(siteId ? { site_id: siteId } : {})
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("sites").select("id, name").eq("active", true).match(siteId ? { id: siteId } : {}).order("name"),
  ]);

  const rows: HandoverNote[] = (notes.data ?? []).map((n) => {
    const p = one(n.profiles as unknown as { full_name: string; role: string } | null);
    return {
      id: n.id,
      siteId: n.site_id,
      siteName: one(n.sites as unknown as { name: string } | null)?.name ?? "A site",
      author: p?.full_name ?? "Someone",
      authorRole: p?.role ?? "guard",
      body: n.body,
      createdAt: n.created_at,
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Shift management" title="Handover notes" />
      <HandoverWorkspace notes={rows} sites={sites.data ?? []} />
    </div>
  );
}
