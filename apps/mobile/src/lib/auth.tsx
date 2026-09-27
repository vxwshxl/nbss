import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { Row } from "@nbss/shared/db";
import {
  codeToEmail,
  isValidCode,
  isValidEmail,
  isValidSecret,
  normaliseCode,
  type Role,
} from "@nbss/shared/identity";

import { WEB_URL } from "./config";
import { releasePush } from "./push";
import { stopTracking } from "./location";
import { supabase } from "./supabase";

export type Profile = Row<"profiles">;

type AuthState = {
  /** null once resolved and nobody is signed in; undefined while still resolving. */
  session: Session | null | undefined;
  profile: Profile | null;
  role: Role | null;
  loading: boolean;
  /** Mails a six-digit code. Always "succeeds" — see sendCode below. */
  sendCode: (identifier: string) => Promise<{ error?: string }>;
  verifyCode: (identifier: string, code: string) => Promise<{ error?: string }>;
  signIn: (identifier: string, secret: string) => Promise<{ error?: string }>;
  signUpClient: (input: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
  }) => Promise<{ error?: string; needsConfirmation?: boolean }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

/**
 * One sign-in for every role, with the website's rules.
 *
 * What someone types is an email address or an employee code:
 *
 *   an email      → Supabase Auth directly. The code is mailed by Auth itself
 *                   (through the ZeptoMail relay it is configured with) and
 *                   verified here, so this path needs nothing but Supabase.
 *   an employee   → the website's /api/auth endpoints, because turning a code
 *   code            into its login needs the server's secret key, which this app
 *                   must never hold. They hand back the session's tokens.
 *
 * Where each person lands afterwards is decided by their profile (app/index.tsx),
 * never by anything typed here.
 */
const REFUSED = "Those details were not accepted.";
const BAD_CODE = "That code is invalid or has expired.";

function isEmail(identifier: string): boolean {
  return identifier.includes("@");
}

async function viaServer(
  step: "code" | "verify" | "password",
  body: Record<string, string>,
): Promise<{ error?: string }> {
  if (!WEB_URL) {
    return { error: "Sign in with your email address — the office can tell you which one is on file." };
  }
  try {
    const res = await fetch(`${WEB_URL}/api/auth/${step}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as
      | { error?: string; session?: { access_token: string; refresh_token: string } }
      | null;
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
  const [loading, setLoading] = useState(false);

  const loadProfile = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();

    // A deactivated profile means no access even though the auth user still exists —
    // deactivating a guard should never require deleting their attendance history.
    setProfile(data && data.active ? data : null);
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

  const sendCode = useCallback(async (raw: string) => {
    const identifier = raw.trim();
    if (!identifier) return { error: "Enter your email or employee code." };
    setLoading(true);
    try {
      if (isEmail(identifier)) {
        if (!isValidEmail(identifier)) return { error: "That email address does not look right." };
        // Errors are swallowed on purpose: an unknown address must look exactly
        // like a known one, or this screen would say who works here.
        await supabase.auth.signInWithOtp({
          email: identifier.toLowerCase(),
          options: { shouldCreateUser: false },
        });
        return {};
      }
      if (!isValidCode(normaliseCode(identifier))) {
        return { error: "That does not look like an employee code or an email address." };
      }
      return await viaServer("code", { identifier });
    } finally {
      setLoading(false);
    }
  }, []);

  const verifyCode = useCallback(async (raw: string, code: string) => {
    const identifier = raw.trim();
    const token = code.replace(/\D/g, "");
    if (token.length !== 6) return { error: "Enter the 6-digit code from your email." };
    setLoading(true);
    try {
      if (isEmail(identifier)) {
        const { error } = await supabase.auth.verifyOtp({
          email: identifier.toLowerCase(),
          token,
          type: "email",
        });
        return error ? { error: BAD_CODE } : {};
      }
      return await viaServer("verify", { identifier, code: token });
    } finally {
      setLoading(false);
    }
  }, []);

  const signIn = useCallback(async (raw: string, secret: string) => {
    const identifier = raw.trim();
    if (!identifier) return { error: "Enter your email or employee code." };
    if (secret.length < 4) return { error: "Enter your PIN or password." };

    setLoading(true);
    try {
      if (isEmail(identifier)) {
        const { error } = await supabase.auth.signInWithPassword({
          email: identifier.toLowerCase(),
          password: secret,
        });
        // One message for every failure, so the form cannot be used to discover
        // which accounts exist.
        return error ? { error: REFUSED } : {};
      }
      const code = normaliseCode(identifier);
      if (!isValidCode(code)) {
        return { error: "That does not look like an employee code or an email address." };
      }
      // Older logins still sit under their synthesized address, so that is
      // tried first; it needs no server. Otherwise the server resolves the code.
      const legacy = await supabase.auth.signInWithPassword({ email: codeToEmail(code), password: secret });
      if (!legacy.error) return {};
      return await viaServer("password", { identifier: code, secret });
    } finally {
      setLoading(false);
    }
  }, []);

  const signUpClient = useCallback(
    async (input: { email: string; password: string; fullName: string; phone?: string }) => {
      if (!isValidEmail(input.email)) return { error: "Enter a valid email address." };
      if (!isValidSecret(input.password, "client")) {
        return { error: "Choose a password of at least 8 characters." };
      }
      if (input.fullName.trim().length < 2) return { error: "Enter your name." };

      setLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email: input.email.trim().toLowerCase(),
        password: input.password,
        options: {
          /**
           * `signup: 'client'` is what the trigger in 0007 looks for. The role itself is
           * NOT sent: the trigger hardcodes 'client' and never reads metadata for it, so
           * a modified app asking for 'admin' here gets a client account anyway.
           */
          data: {
            signup: "client",
            full_name: input.fullName.trim(),
            ...(input.phone?.trim() ? { phone: input.phone.trim() } : {}),
          },
        },
      });
      setLoading(false);

      if (error) return { error: error.message };

      // Supabase returns a user with no session when email confirmation is on. The
      // screen has to say "check your email" rather than waiting for a session that
      // is not coming.
      return { needsConfirmation: !data.session };
    },
    [],
  );

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

  const value = useMemo<AuthState>(
    () => ({
      session,
      profile,
      role: profile?.role ?? null,
      loading,
      sendCode,
      verifyCode,
      signIn,
      signUpClient,
      signOut,
      refresh,
    }),
    [session, profile, loading, sendCode, verifyCode, signIn, signUpClient, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>.");
  return context;
}
