"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, ArrowRight, CheckCircle2, CircleDashed, Download, ExternalLink, Radio, Sparkles } from "lucide-react";

import { saveRelease } from "@/app/console/app-updates/actions";
import { emptyReleaseState } from "@/app/console/app-updates/state";
import { GateScene } from "@/components/auth/gate-scene";
import { BrandLockup } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type Release = {
  version_code: number;
  version_name: string | null;
  store_url: string | null;
  notes: string | null;
  updated_at: string | null;
};

function Publish() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} size="lg" className="rounded-full px-5">
      <Radio data-icon="inline-start" />
      {pending ? "Publishing…" : "Publish update"}
    </Button>
  );
}

/**
 * The release form beside a phone showing exactly what guards will see, redrawn as
 * each field is typed. The preview's button opens the link typed, so it can be checked
 * before anyone is sent there.
 */
export function AppReleaseEditor({ release, latestBuild }: { release: Release; latestBuild: number | null }) {
  const [state, action] = useActionState(saveRelease, emptyReleaseState);
  const [name, setName] = useState(release.version_name ?? "");
  const [code, setCode] = useState(release.version_code ? String(release.version_code) : "");
  const [url, setUrl] = useState(release.store_url ?? "");
  const [notes, setNotes] = useState(release.notes ?? "");

  const live = release.version_code > 0 && !!release.store_url;
  const changed =
    name !== (release.version_name ?? "") ||
    code !== (release.version_code ? String(release.version_code) : "") ||
    url !== (release.store_url ?? "") ||
    notes !== (release.notes ?? "");

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-5">
        {/* Where things stand, before anything is typed. */}
        <div
          className={cn(
            "flex items-start gap-3 rounded-2xl border px-4 py-3.5",
            live ? "border-emerald-200 bg-emerald-50/70 dark:border-emerald-500/30 dark:bg-emerald-500/10" : "border-app-line bg-muted/50",
          )}
        >
          {live ? <Radio className="mt-0.5 size-5 shrink-0 text-emerald-600" /> : <CircleDashed className="mt-0.5 size-5 shrink-0 text-muted-foreground" />}
          <div className="min-w-0 text-sm">
            <p className="font-semibold">
              {live ? `Live: phones below build ${release.version_code} see the update screen` : "Nothing published: no phone is asked to update"}
            </p>
            <p className="text-muted-foreground">
              {live
                ? `Version ${release.version_name ?? "-"} · ${release.store_url}`
                : "Fill in the build that is on the Play Store and publish. Until then the app never shows the update screen."}
            </p>
          </div>
        </div>

        <form action={action} className="space-y-5 rounded-2xl border border-app-line bg-card p-5 shadow-card">
          {state.error && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{state.error}</span>
            </div>
          )}
          {state.ok && state.message && !changed && (
            <div role="status" className="flex items-start gap-2 rounded-xl border border-primary/25 bg-primary/5 px-3 py-2.5 text-sm text-primary">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              <span>{state.message}</span>
            </div>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="version_name">Version name</Label>
              <Input id="version_name" name="version_name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 1.0.1" maxLength={40} />
              <p className="text-xs text-muted-foreground">Shown to guards on the update screen.</p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="version_code">Build number</Label>
              <Input
                id="version_code"
                name="version_code"
                inputMode="numeric"
                pattern="[0-9]*"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder={latestBuild ? `e.g. ${latestBuild}` : "e.g. 25"}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                The version code in the Play Console. Phones on a lower build are asked to update. Empty or 0 asks no one.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="store_url">Play Store link</Label>
            <Input id="store_url" name="store_url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://play.google.com/store/apps/details?id=com.nbss.okhrang" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">
              What&apos;s new <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea id="notes" name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} maxLength={500} placeholder="e.g. Sign in with your name and mobile number." />
            <p className="text-right text-xs tabular-nums text-muted-foreground">{notes.length} / 500</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-app-line-soft pt-4">
            <Publish />
            <p className="text-xs text-muted-foreground">
              Phones check at launch and whenever the app comes back to the front.
            </p>
          </div>
        </form>
      </div>

      {/* The preview, kept in view while the form is filled in. */}
      <aside className="xl:sticky xl:top-20 xl:self-start">
        <p className="mb-2 text-sm font-semibold">What guards will see</p>
        <PhonePreview name={name} url={url} notes={notes} />
      </aside>
    </div>
  );
}

/** The app's Update available screen (apps/mobile/src/components/update-screen.tsx), in a phone. */
function PhonePreview({ name, url, notes }: { name: string; url: string; notes: string }) {
  const ok = /^https:\/\//.test(url);
  return (
    <div className="mx-auto w-full max-w-[300px] rounded-[2.6rem] bg-neutral-900 p-2.5 shadow-xl ring-1 ring-black/10">
      <div className="relative flex h-[600px] flex-col overflow-hidden rounded-[2.1rem] bg-background">
        <div className="absolute top-2 left-1/2 h-5 w-20 -translate-x-1/2 rounded-full bg-neutral-900" />
        <div className="flex flex-1 flex-col items-center px-5 pt-10 text-center">
          <BrandLockup size="xs" />
          <span className="mt-6 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
            <Sparkles className="size-3" />
            {name.trim() ? `Version ${name.trim()}` : "New version"}
          </span>
          <p className="mt-2 font-display text-[22px] leading-tight font-extrabold tracking-[-0.02em]">Update available</p>
          <p className="mt-1.5 text-[11.5px] leading-snug text-muted-foreground">
            A newer NBSS app is ready on the Play Store. Update to keep checking in, tracking and SOS working as they should.
          </p>
          {notes.trim() && (
            <div className="mt-3 w-full rounded-xl border border-border bg-muted px-3 py-2 text-left">
              <p className="text-[9.5px] font-semibold tracking-widest text-muted-foreground">WHAT&apos;S NEW</p>
              <p className="mt-0.5 line-clamp-4 text-[11.5px] whitespace-pre-line">{notes.trim()}</p>
            </div>
          )}
          <a
            href={ok ? url : undefined}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!ok}
            title={ok ? "Opens the link above" : "Add an https:// Play Store link to try it"}
            className={cn(
              "mt-4 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-brand-gradient-strong text-[13px] font-semibold text-white shadow-sm",
              !ok && "pointer-events-none opacity-60",
            )}
          >
            <Download className="size-3.5" /> Update now <ArrowRight className="size-3.5" />
          </a>
          <p className="mt-2.5 text-[12px] font-medium text-muted-foreground">Later</p>
        </div>
        <div className="relative mt-auto h-[120px] overflow-hidden rounded-t-[20px] bg-[#06110d]">
          <GateScene className="absolute inset-0 h-full" />
        </div>
      </div>
      {ok && (
        <p className="mt-2 flex items-center justify-center gap-1 text-[11px] text-neutral-400">
          <ExternalLink className="size-3" /> Update now opens your link
        </p>
      )}
    </div>
  );
}
