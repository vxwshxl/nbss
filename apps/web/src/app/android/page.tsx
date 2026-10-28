import type { Metadata } from "next";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Download, ShieldCheck, Smartphone } from "lucide-react";

import { AuthShell } from "../login/auth-shell";

export const metadata: Metadata = {
  title: "NBSS app for Android",
  description: "Download and install the NBSS Kokrajhar app for guards, supervisors and the office.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Where the APK and its details live on the server. nginx serves the APK itself at
 * /android/NBSS-Kokrajhar.apk (deploy/nginx); this page only reads the details, so a
 * new build is published by copying two files, with no deploy.
 */
const DIR = process.env.NBSS_ANDROID_DIR ?? "/var/www/nbss-android";
const APK = "/android/NBSS-Kokrajhar.apk";

type Build = { build: number; version: string; bytes: number; published: string };

async function currentBuild(): Promise<Build | null> {
  try {
    return JSON.parse(await readFile(path.join(DIR, "version.json"), "utf8")) as Build;
  } catch {
    return null;
  }
}

const STEPS: { title: string; text: string }[] = [
  { title: "Download", text: "Tap the green button. Let it finish: the file is large, so use Wi-Fi if you can." },
  {
    title: "Open the file",
    text: "Open it from the notification or from Files → Downloads. If the phone asks, allow “Install unknown apps” for Chrome or Files, then go back.",
  },
  {
    title: "Install",
    text: "Tap Install. If Play Protect warns you, tap More details → Install anyway. Already have the app? Installing over it keeps you signed in.",
  },
  { title: "Sign in", text: "Open NBSS Kokrajhar and sign in with your full name and mobile number." },
];

export default async function AndroidPage() {
  const build = await currentBuild();
  const size = build ? `${Math.round(build.bytes / 1_000_000)} MB` : null;
  const published = build
    ? new Date(build.published).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })
    : null;

  return (
    <AuthShell>
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          <Smartphone className="size-3.5" />
          Android app
        </span>
        <h1 className="mt-3 font-display text-[32px] leading-tight font-extrabold tracking-[-0.025em]">Get the NBSS app</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          For guards, housekeepers, supervisors and the office. Works on Android 7.0 and newer.
        </p>
      </div>

      <a
        href={APK}
        download="NBSS-Kokrajhar.apk"
        className="press mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-gradient-strong text-[15px] font-semibold text-white shadow-sm"
      >
        <Download className="size-5" />
        Download for Android
      </a>
      {build && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Version {build.version} · build {build.build} · {size} · {published}
        </p>
      )}

      <ol className="mt-7 space-y-4">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{s.title}</p>
              <p className="text-sm text-muted-foreground">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-7 rounded-xl border border-app-line-soft bg-muted/50 px-4 py-3 text-sm">
        <p className="flex items-center gap-1.5 font-semibold">
          <ShieldCheck className="size-4 text-primary" />
          &ldquo;App not installed&rdquo;?
        </p>
        <ul className="mt-1.5 list-disc space-y-1 pl-5 text-muted-foreground">
          <li>Free at least 500 MB of storage and try again.</li>
          <li>Download it again here: a file sent over WhatsApp can arrive incomplete.</li>
          <li>If an old NBSS app is on the phone and still fails, uninstall it first.</li>
        </ul>
      </div>
    </AuthShell>
  );
}
