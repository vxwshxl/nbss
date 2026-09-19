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
 * Turning what someone typed into the address their login is registered under.
 *
 * The web console does this on the server, where it can look the employee code up
 * with the secret key. The app has no secret key and must not have one, and an RPC
 * that answered "which address does code NBSS-004 belong to" would be an employee-code
 * enumeration endpoint open to the internet.
 *
 * So the app reads the shape of what was typed instead:
 *
 *   contains an '@'  → an email, used as-is. Clients register with their own address,
 *                      and office staff created with one keep it.
 *   otherwise        → an employee code, converted by the same deterministic rule the
 *                      server used when the account was made.
 *
 * This is complete for guards, who are the overwhelming majority of app users and
 * always have a synthesized address. A staff account created *with* a real email has
 * to sign in with that email rather than their code — which is worth knowing, and is
 * why the field is labelled "Employee code or email".
 */
function toLoginEmail(identifier: string): string | null {
  const trimmed = identifier.trim();
  if (trimmed.includes("@")) return isValidEmail(trimmed) ? trimmed.toLowerCase() : null;

  const code = normaliseCode(trimmed);
  return isValidCode(code) ? codeToEmail(code) : null;
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

  const signIn = useCallback(async (identifier: string, secret: string) => {
    const email = toLoginEmail(identifier);
    if (!email) {
      return { error: "That does not look like an employee code or an email address." };
    }

    // Checked before the round trip, and deliberately against the looser of the two
    // rules: the app does not know the role until after sign-in, so it cannot enforce
    // "six digits for a guard" here without locking out a client with a short password.
    if (secret.length < 4) return { error: "Enter your PIN or password." };

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: secret });
    setLoading(false);

    if (error) {
      // One message for a wrong code and a wrong PIN both, so the form cannot be used
      // to discover which employee codes exist.
      return { error: "That employee code and PIN do not match. Check both and try again." };
    }
    return {};
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
      signIn,
      signUpClient,
      signOut,
      refresh,
    }),
    [session, profile, loading, signIn, signUpClient, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>.");
  return context;
}
