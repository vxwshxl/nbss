import type { Metadata } from "next";
import { ShieldCheck, Smartphone, Store } from "lucide-react";

import { pageMetadata } from "@/lib/seo/page-metadata";

import { AuthShell } from "../login/auth-shell";

export const metadata: Metadata = pageMetadata({
  title: "Get the NBSS Kokrajhar app for Android",
  description:
    "Get the NBSS Kokrajhar Android app on Google Play: guards check in and out, share live location and raise SOS; supervisors and the office follow every post; clients see their site. Android 7.0 and newer.",
  path: "/android",
  image: { url: "/og/android", width: 1200, height: 630, alt: "Get the NBSS Kokrajhar app for Android" },
  keywords: ["NBSS app", "NBSS Kokrajhar app", "security guard app Assam", "NBSS Google Play"],
});

/**
 * The app is on Google Play since 26 Nov 2026 (1.1.0, build 39). The APK this page
 * used to hand out is signed with a different key from the Play build, so a phone
 * that has it must uninstall it once before Play can install the app.
 */
const PLAY = "https://play.google.com/store/apps/details?id=com.nbss.okhrang";

const STEPS: { title: string; text: string }[] = [
  {
    title: "Had the old app from this website?",
    text: "Uninstall it first: hold the NBSS icon, then Uninstall. Your duties and attendance stay safe with the office.",
  },
  { title: "Install from Google Play", text: "Tap the green button, then Install. Updates come by themselves from now on." },
  { title: "Sign in", text: "Open NBSS Kokrajhar. Staff and guards sign in with their full name and mobile number; clients sign in with Google." },
];

export default function AndroidPage() {
  return (
    <AuthShell>
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          <Smartphone className="size-3.5" />
          Android app
        </span>
        <h1 className="mt-3 font-display text-[32px] leading-tight font-extrabold tracking-[-0.025em]">Get the NBSS Kokrajhar app</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          For guards, housekeepers, supervisors, the office and our clients. Works on Android 7.0 and newer.
        </p>
      </div>

      <a
        href={PLAY}
        className="press mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-gradient-strong text-[15px] font-semibold text-white shadow-sm"
      >
        <Store className="size-5" />
        Get it on Google Play
      </a>

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
          Play Store says it can&rsquo;t install?
        </p>
        <ul className="mt-1.5 list-disc space-y-1 pl-5 text-muted-foreground">
          <li>The old NBSS app is still on the phone. Uninstall it, then try again.</li>
          <li>Free at least 200 MB of storage.</li>
        </ul>
      </div>
    </AuthShell>
  );
}
