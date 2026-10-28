import { isStaff, roleChoice, roleLabel } from "@nbss/shared/identity";
import type { Metadata } from "next";

import { signOut } from "@/app/console/actions";
import { startImpersonation, stopImpersonation } from "@/app/console/impersonate";
import { BrandLockup } from "@/components/brand";
import { ConsoleNav } from "@/components/console/console-nav";
import { SosAlarm } from "@/components/console/sos-alarm";
import { navIndexFor } from "@/components/console/nav-items";
import {
  ImpersonationControl,
  type Person,
} from "@/components/console/impersonation";
import { UserMenu } from "@/components/console/user-menu";
import { Assistant } from "@/components/ai/assistant";
import { RealtimeRefresher } from "@/components/realtime-refresher";
import { AppShell, WebsiteTag } from "@/components/shell/app-shell";
import { isAssistantConfigured } from "@/lib/ai/assistant";
import { personaFor } from "@/lib/ai/personas";
import { CONSOLE_REALTIME_TABLES } from "@/lib/realtime/routes";
import { currentSession, homeFor } from "@/lib/auth";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import type { WorkspaceSite } from "@/lib/site-workspace";
import { site } from "@/content/site";
import { countSubmissions } from "@/lib/store";
import { ModeToggle } from "@/components/shell/mode-toggle";
import { DATA_MODE_COOKIE, parseMode } from "@/lib/mode/shared";
import { cookies } from "next/headers";
import { after } from "next/server";

export const metadata: Metadata = {
  title: { default: "Console", template: `%s · ${site.shortName} Console` },
  robots: { index: false, follow: false },
};

/** Reads live data on every request, so it must never be prerendered. */
export const dynamic = "force-dynamic";

/**
 * The console shell.
 *
 * The nav is built on the server from the signed-in profile, so a guard's
 * browser is never sent the admin routes at all. That is presentation, not
 * protection — every page behind these links calls `requireRole` for itself.
 *
 * The rail-collapse preference is read here rather than in the client, so the
 * first paint is already the right width. A cookie rather than localStorage for
 * exactly that reason: the server cannot read localStorage, and a rail that
 * expands on hydration is a page that jumps under the reader.
 */
export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const session = await currentSession();

  // The sign-in page lives under /console but has no shell of its own. Rather
  // than redirect here — which would fight the middleware — an unauthenticated
  // render passes the children straight through.
  if (!session) return <>{children}</>;

  const { profile, realProfile, impersonating } = session;
  // "Last seen" (0048), after the page is sent so it never slows one down. The real
  // person's, even while viewing as someone else: the cookie is theirs.
  // The client is made here, not inside the callback: it reads the request's
  // cookies, and `after()` runs once the request is gone.
  const presence = await supabaseServer();
  after(async () => {
    await presence.rpc("touch_presence");
  });
  const persona = personaFor(profile.role);
  const canImpersonate = realProfile.role === "developer";
  // Test / Live: a developer's switch. Everyone else sees their own side.
  const mode = parseMode((await cookies()).get(DATA_MODE_COOKIE)?.value);
  // The side this browser is on, kept on the profile for the realtime feed (0059): it
  // has no request headers, and a developer on Test otherwise heard nothing live.
  if (canImpersonate && (realProfile as { dev_view_test?: boolean }).dev_view_test !== (mode === "test")) {
    await supabaseAdmin().from("profiles").update({ dev_view_test: mode === "test" }).eq("id", realProfile.id);
  }

  // The impersonation picker needs the roster. Only a developer ever sees it, so
  // it is only fetched for one — and on the admin client, because a developer
  // already viewing as a guard would otherwise be filtered by that guard's
  // row-level policy and find the list empty.
  const people: Person[] = canImpersonate
    ? ((
        await supabaseAdmin()
          .from("profiles")
          .select("id, employee_code, full_name, role, trade")
          .eq("active", true)
          .neq("id", realProfile.id)
          // View as: only the people on the side being looked at.
          .eq("is_test", mode === "test")
          .order("full_name")
      ).data ?? [])
    : [];

  // Staff work site by site as well as across them: the switcher and a site's sidebar.
  const staff = isStaff(profile.role);
  const sites: WorkspaceSite[] = staff
    ? (
        (
          await (await supabaseServer())
            .from("sites")
            .select("id, name, district, client_name, active")
            .order("active", { ascending: false })
            .order("name")
        ).data ?? []
      ).map((s) => ({ id: s.id, name: s.name, district: s.district, client: s.client_name, active: s.active }))
    : [];

  // Unactioned counts beside menu items: new enquiries (contacted and closed do not count).
  const badges: Record<string, number> = {};
  if (staff) {
    const counts = await countSubmissions().catch(() => null);
    if (counts?.new) badges["/console/submissions"] = counts.new;
  }

  return (
    <AppShell
      brand={site.shortName}
      brandHref={homeFor(profile.role)}
      assistantHref="/console/assistant"
      assistant={
        <Assistant
          greetingName={profile.full_name.split(" ")[0] ?? profile.full_name}
          suggestions={persona.suggestions}
          configured={isAssistantConfigured()}
          scopeNote={persona.scopeNote}
        />
      }
      navIndex={navIndexFor(profile.role)}
      mark={<BrandLockup size="sm" priority />}
      sidebarFooter={<WebsiteTag label={`${roleLabel(profile.role, profile.trade)} console · nbss.co.in`} />}
      companion={{ person: realProfile.id }}
      nav={<ConsoleNav role={profile.role} sites={sites} badges={badges} />}
      sites={staff ? sites : undefined}
      topbarSecondary={
        // View as, as schoolerp has it: a pill, or while viewing a round icon whose panel
        // says who and offers Exit. A developer's alone.
        canImpersonate ? (
          <ImpersonationControl
            people={people}
            impersonating={impersonating}
            label={profile.full_name}
            currentRole={impersonating ? roleChoice(profile.role, profile.trade) : null}
            currentUserId={impersonating ? profile.id : null}
            start={startImpersonation}
            stop={stopImpersonation}
          />
        ) : undefined
      }
      topbarRight={
        // One element, not a fragment: a fragment crosses to the client shell as a
        // keyless list and React warns about the missing keys.
        <div className="flex items-center gap-2">
        {canImpersonate && <ModeToggle key="mode" mode={mode} />}
        <UserMenu
          key="user"
          name={profile.full_name}
          code={profile.employee_code}
          roleLabel={roleLabel(profile.role, profile.trade)}
          photoUrl={profile.avatar_url}
          signOut={signOut}
        />
        </div>
      }
    >
      {/* One child: several cross to the client shell as a keyless list. */}
      <div className="contents">
      <RealtimeRefresher
        key="realtime"
        tables={CONSOLE_REALTIME_TABLES}
        clientTopic={profile.role === "client" ? `client:${profile.id}` : undefined}
      />
      {isStaff(realProfile.role) && <SosAlarm key="sos" />}
      <div key="page" className="contents">{children}</div>
      </div>
    </AppShell>
  );
}
