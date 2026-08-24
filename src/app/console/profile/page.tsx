import type { Metadata } from "next";

import { DetailsForm, PinForm } from "@/components/console/ProfileForms";
import { Icon } from "@/components/Icon";
import { requireSession } from "@/lib/auth";

export const metadata: Metadata = { title: "My profile" };
export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrator",
  supervisor: "Supervisor",
  guard: "Guard",
  client: "Client",
};

export default async function ProfilePage() {
  const { profile, impersonating } = await requireSession();
  const isGuard = profile.role === "guard";

  return (
    <div className="cwrap">
      <div className="chead">
        <div>
          <h1 className="chead__h">My profile</h1>
          <p className="chead__lede">
            Your details and how you sign in. Your employee code and role are set by the office.
          </p>
        </div>
      </div>

      <div className="cpanel">
        <div className="cpanel__head">
          <h2 className="cpanel__h">Account</h2>
        </div>
        <div className="cpanel__body">
          <dl className="ui-dl">
            <dt>Employee code</dt>
            <dd className="mono">{profile.employee_code}</dd>
            <dt>Role</dt>
            <dd>{ROLE_LABEL[profile.role] ?? profile.role}</dd>
          </dl>
        </div>
      </div>

      <div className="cpanel">
        <div className="cpanel__head">
          <h2 className="cpanel__h">Your details</h2>
        </div>
        <DetailsForm fullName={profile.full_name} phone={profile.phone ?? ""} />
      </div>

      <div className="cpanel">
        <div className="cpanel__head">
          <h2 className="cpanel__h">{isGuard ? "Change your PIN" : "Change your passphrase"}</h2>
        </div>
        {impersonating ? (
          <div className="cpanel__body">
            <p className="chead__lede" style={{ margin: 0 }}>
              A credential cannot be changed from a &ldquo;view as&rdquo; session. Stop viewing as
              this person, then issue a new PIN from the People screen — that path is recorded in
              the audit log.
            </p>
          </div>
        ) : (
          <PinForm isGuard={isGuard} mustChange={profile.must_change_pin} />
        )}
      </div>

      <p className="admin-note">
        <Icon name="key" />
        <span>
          Your PIN is stored hashed and cannot be read by anyone, including an administrator. If
          you forget it, the office issues a new one — they never see the old.
        </span>
      </p>
    </div>
  );
}
