import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, IdCard, KeyRound, UserRound } from "lucide-react";

import { Mark } from "@/components/brand";
import { PageHeader } from "@/components/console/page-header";
import { DetailsForm, PinForm } from "@/components/console/profile-forms";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { StatusPill } from "@/components/ui/status-pill";
import { site } from "@/content/site";
import { requireSession } from "@/lib/auth";
import { initials } from "@/lib/ui/initials";
import type { Role } from "@/lib/auth";

export const metadata: Metadata = { title: "My profile" };
export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrator",
  supervisor: "Supervisor",
  guard: "Guard",
  client: "Client",
};

export default async function ProfilePage() {
  const { profile, impersonating } = await requireSession();
  const isGuard = profile.role === "guard";

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Account" title="My profile" />

      {/* Identity first, and read-only: the employee code and the role are set
          by the office, and showing them as fields somebody can type into is
          the fastest way to get asked why saving them does nothing. */}
      <Panel tone="indigo" title="Account" icon={IdCard}>
        <div className="flex flex-wrap items-center gap-4">
          <Avatar className="size-14 border border-border">
            <AvatarFallback className="bg-foreground text-base font-semibold text-background">
              {initials(profile.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-display text-xl font-bold tracking-tight">
              {profile.full_name}
            </p>
            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="font-mono">{profile.employee_code}</span>
              <StatusPill label={ROLE_LABEL[profile.role]} tone="violet" />
            </p>
          </div>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Your employee code and your role are set by the office. If either is wrong,
          the operations desk changes it — the change is recorded in the audit log.
        </p>
      </Panel>

      <Panel tone="emerald" title="Your details" icon={UserRound}>
        <DetailsForm fullName={profile.full_name} phone={profile.phone ?? ""} />
      </Panel>

      <Panel
        tone="amber"
        title={isGuard ? "Change your PIN" : "Change your passphrase"}
        icon={KeyRound}
      >
        {impersonating ? (
          <p className="text-sm text-muted-foreground">
            A credential cannot be changed from a &ldquo;view as&rdquo; session. Stop
            viewing as this person, then issue a new PIN from the Guards screen — that
            path is recorded in the audit log.
          </p>
        ) : (
          <PinForm isGuard={isGuard} mustChange={profile.must_change_pin} />
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          Your {isGuard ? "PIN" : "passphrase"} is stored hashed and cannot be read by
          anyone, including an administrator. If you forget it, the office issues a new
          one — they never see the old.
        </p>
      </Panel>

      {/* The console's mark leads to the dashboard, so the way back out to the
          public site lives here: findable, but not a click somebody makes by
          accident in the middle of a shift. */}
      <Panel tone="slate" title="Public website" icon={ExternalLink}>
        <div className="flex flex-wrap items-center gap-4">
          <Mark size={40} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{site.name}</p>
            <p className="text-sm text-muted-foreground">
              Services, training, careers and the enquiry forms.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/">
              Visit the site
              <ExternalLink data-icon="inline-end" />
            </Link>
          </Button>
        </div>
      </Panel>
    </div>
  );
}
