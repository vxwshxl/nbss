"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2 } from "lucide-react";

import { saveRelease } from "@/app/console/app-updates/actions";
import { emptyReleaseState } from "@/app/console/app-updates/state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function Save() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Publishing…" : "Publish update"}
    </Button>
  );
}

export type Release = {
  version_code: number;
  version_name: string | null;
  store_url: string | null;
  notes: string | null;
};

export function AppReleaseForm({ release }: { release: Release }) {
  const [state, action] = useActionState(saveRelease, emptyReleaseState);
  // After a refusal, what was typed; otherwise what is published.
  const v = state.values ?? {
    version_code: String(release.version_code),
    version_name: release.version_name ?? "",
    store_url: release.store_url ?? "",
    notes: release.notes ?? "",
  };

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {state.error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive sm:col-span-2"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}
      {state.ok && state.message && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2.5 text-sm text-primary sm:col-span-2"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <span>{state.message}</span>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="version_name">Version</Label>
        <Input id="version_name" name="version_name" key={`n${v.version_name}`} defaultValue={v.version_name} placeholder="1.0.1" maxLength={40} />
        <p className="text-xs text-muted-foreground">What people see on the update screen.</p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="version_code">Build number</Label>
        <Input
          id="version_code"
          name="version_code"
          inputMode="numeric"
          pattern="[0-9]*"
          key={`c${v.version_code}`}
          defaultValue={v.version_code}
          required
          className="font-mono"
        />
        <p className="text-xs text-muted-foreground">
          The version code in the Play Console. Phones on a lower build are asked to update; 0 asks no one.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:col-span-2">
        <Label htmlFor="store_url">Play Store link</Label>
        <Input
          id="store_url"
          name="store_url"
          type="url"
          key={`u${v.store_url}`}
          defaultValue={v.store_url}
          placeholder="https://play.google.com/store/apps/details?id=com.nbss.okhrang"
        />
      </div>

      <div className="flex flex-col gap-2 sm:col-span-2">
        <Label htmlFor="notes">
          What&apos;s new <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea id="notes" name="notes" key={`t${v.notes}`} defaultValue={v.notes} rows={4} maxLength={500} placeholder="Sign in with your name and mobile number." />
      </div>

      <div className="sm:col-span-2">
        <Save />
      </div>
    </form>
  );
}
