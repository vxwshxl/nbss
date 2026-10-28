import type { Session } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { Row } from "@nbss/shared/db";
import { isValidMobile, type Role } from "@nbss/shared/identity";

import { WEB_URL } from "./config";
import { IS_EXPO_GO } from "./runtime";
import { releasePush } from "./push";
import { stopTracking } from "./location";
import { supabase } from "./supabase";

/** The public website: Supabase's own site, always on its allow list (unlike an IP address). */
const PUBLIC_SITE = "https://nbsskokrajhar.com";

export type Profile = Row<"profiles">;

/** The Google account's photo, when the guard has signed in with Google (or linked it). */
export function photoOf(session: Session | null | undefined): string | null {
  const m = (session?.user.user_metadata ?? {}) as { avatar_url?: unknown; picture?: unknown };
  const fromIdentity = session?.user.identities?.find((i) => i.provider === "google")?.identity_data as { avatar_url?: unknown; picture?: unknown } | undefined;
  const url = m.avatar_url ?? m.picture ?? fromIdentity?.avatar_url ?? fromIdentity?.picture;
  return typeof url === "string" && url.startsWith("https://") ? url : null;
}

type AuthState = {
  /** null once resolved and nobody is signed in; undefined while still resolving. */
  session: Session | null | undefined;
  profile: Profile | null;
  role: Role | null;
  loading: boolean;
  /** Name and mobile, for every role but client. */
  signIn: (name: string, mobile: string) => Promise<{ error?: string }>;
  /** Google, as on the website: an account already on the books, or a new client. */
  signInWithGoogle: () => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

/**
 * One sign-in for every role, with the website's rules.
 *
 * Everyone who works for NBSS types their name and 10-digit mobile, and the
 * website's /api/auth endpoint decides: finding someone by name and number needs
 * the server's secret key, which this app must never hold. It hands back the
 * session's tokens. Clients use Google.
 *
 * Where each person lands afterwards is decided by their profile (app/index.tsx),
 * never by anything typed here.
 */
const REFUSED = "Those details were not accepted.";

async function viaServer(body: Record<string, string>): Promise<{ error?: string }> {
  if (!WEB_URL) return { error: "Sign-in is not set up in this build of the app." };
  try {
    const res = await fetch(`${WEB_URL}/api/auth/worker`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as
      | { error?: string; session?: { access_token: string; refresh_token: string } }
      | null;
    // A server that fails is not a wrong name, so it is not reported as one.
    if (res.status >= 500) return { error: "NBSS could not sign you in just now. Try again in a minute." };
    if (!res.ok) return { error: data?.error ?? REFUSED };
    if (data?.session) {
      const { error } = await supabase.auth.setSession(data.session);
      if (error) return { error: REFUSED };
    }
    return {};
  } catch {
    return { error: "Could not reach NBSS. Check your connection and try again." };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [profile, setProfile] = useState<Profile | null>(null);
  // Whose profile has been looked up. Until it matches the session's user, the app is
  // still checking, and says so (session undefined) rather than flash the sign-in page.
  const [checkedFor, setCheckedFor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadProfile = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null);
      setCheckedFor(null);
      return;
    }
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();

    // A deactivated profile means no access even though the auth user still exists —
    // deactivating a guard should never require deleting their attendance history.
    setProfile(data && data.active ? data : null);
    setCheckedFor(userId);
  }, []);

  useEffect(() => {
    let cancelled = false;

    // The session is read from encrypted storage, so the first paint has to wait for
    // it. `undefined` rather than null while that happens, so the router can show a
    // splash instead of flashing the sign-in screen at someone already signed in.
    void supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      setSession(data.session ?? null);
      await loadProfile(data.session?.user.id);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next ?? null);
      // Not awaited inside the callback: supabase-js warns that an async callback here
      // can deadlock its own internal lock.
      void loadProfile(next?.user.id);

      if (event === "SIGNED_OUT") setProfile(null);
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (name: string, raw: string) => {
    const mobile = raw.replace(/\D/g, "");
    if (!name.trim()) return { error: "Enter your name." };
    if (!isValidMobile(mobile)) return { error: "Enter your 10-digit mobile number." };
    setLoading(true);
    try {
      return await viaServer({ name, mobile });
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Sign in with Google: Google's page opens in a secure browser sheet, Supabase
   * sends it back to this app's own link with a one-time code (PKCE), and the code
   * is exchanged here for the session. Same accounts and rules as the website's
   * button (0021): a known email signs into its own account, an unknown one becomes
   * a client, and staff can never be created this way.
   */
  const signInWithGoogle = useCallback(async () => {
    setLoading(true);
    try {
      // Where the browser sheet hands back to: this app's own link. In Expo Go that link
      // is exp://<the computer's IP>, which Supabase refuses, so the sign-in returns by
      // way of the public website's /auth/app, which passes the code straight on.
      const appLink = Linking.createURL("auth/callback");
      const redirectTo = IS_EXPO_GO ? `${PUBLIC_SITE}/auth/app?to=${encodeURIComponent(appLink)}` : appLink;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: "select_account" } },
      });
      if (error || !data.url) return { error: "Google sign-in is not available right now." };

      const result = await WebBrowser.openAuthSessionAsync(data.url, appLink);
      if (result.type !== "success") return {};

      const url = new URL(result.url);
      const params = new URLSearchParams(url.search || url.hash.replace(/^#/, ""));
      const failure = params.get("error_description") ?? params.get("error");
      if (failure) return { error: failure.replace(/\+/g, " ") };
      const code = params.get("code");
      if (!code) return { error: "Google did not finish signing you in. Try again." };

      const { data: exchanged, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError || !exchanged.session) return { error: "Google sign-in could not be completed. Try again." };

      // Signed in to Google, but not an NBSS account (an address another profile holds,
      // or a deactivated one): out again, with a reason, rather than a blank app.
      const { data: profileRow } = await supabase.from("profiles").select("id, active").eq("id", exchanged.session.user.id).maybeSingle();
      if (!profileRow?.active) {
        await supabase.auth.signOut();
        return { error: "This Google account is not registered with NBSS. Staff and guards sign in with their name and mobile number." };
      }
      return {};
    } catch {
      return { error: "Could not reach Google. Check your connection and try again." };
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setLoading(true);
    /**
     * Order matters, and this is the order.
     *
     * The push token is released and tracking stopped while the session is still
     * valid — both are authenticated calls, and after `signOut` they would fail. A
     * phone that signs out while still registered keeps receiving alerts for a site
     * the next shift is now covering.
     */
    await releasePush();
    await stopTracking();
    await supabase.auth.signOut();
    setProfile(null);
    setLoading(false);
  }, []);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    await loadProfile(data.session?.user.id);
  }, [loadProfile]);

  // Signed in but the profile not looked up yet: still checking, as far as screens know.
  const settled = session && checkedFor !== session.user.id ? undefined : session;

  const value = useMemo<AuthState>(
    () => ({
      session: settled,
      profile,
      role: profile?.role ?? null,
      loading,
      signIn,
      signInWithGoogle,
      signOut,
      refresh,
    }),
    [settled, profile, loading, signIn, signInWithGoogle, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>.");
  return context;
}
