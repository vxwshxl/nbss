/**
 * The operations session, shared by the middleware and the sign-in action.
 *
 * The site used to sit behind HTTP basic auth, which meant the browser's own
 * grey credential dialog — unstyleable, untranslatable, and impossible to sign
 * out of without closing the browser. This replaces it with an ordinary form
 * and a signed cookie, so the prompt can be a real part of the site.
 *
 * Everything here has to run on the edge runtime as well as in Node, because
 * `src/middleware.ts` imports it. That rules out `node:crypto` — the HMAC is
 * done with Web Crypto, which both runtimes expose as a global. For the same
 * reason nothing in this module may reach for `src/lib/store` (Node `fs`).
 *
 * The cookie carries no identity, only an expiry and a signature over it:
 * there is one shared operator credential, so there is nothing else to say.
 */

export const SESSION_COOKIE = "nbss_ops";

/** A working day, so the office is not signed out mid-shift. */
const TTL_MS = 8 * 60 * 60 * 1000;
const VERSION = "v1";

const USER = process.env.NBSS_ADMIN_USER ?? "admin";
const PASS = process.env.NBSS_ADMIN_PASS ?? "nbss-kokrajhar";

/**
 * Falling back to the credentials themselves is what makes a password change
 * also invalidate every cookie already issued. Set `NBSS_ADMIN_SECRET` to
 * decouple the two — sessions then survive a password rotation.
 */
const SECRET = process.env.NBSS_ADMIN_SECRET ?? `${VERSION}:${USER}:${PASS}`;

const encoder = new TextEncoder();

/** Length-independent equality — never bails out early on a mismatch. */
export function safeEqual(a: string, b: string): boolean {
  const x = encoder.encode(a);
  const y = encoder.encode(b);
  // Fold the length difference into the result rather than returning early.
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  }
  return diff === 0;
}

// Importing the key is asynchronous, so it is memoised rather than redone on
// every request. The promise is cached, not the key, so concurrent first
// requests share one import instead of racing.
let cachedKey: Promise<CryptoKey> | null = null;

function hmacKey(): Promise<CryptoKey> {
  cachedKey ??= crypto.subtle.importKey(
    "raw",
    encoder.encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return cachedKey;
}

function base64url(buffer: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(payload: string): Promise<string> {
  return base64url(await crypto.subtle.sign("HMAC", await hmacKey(), encoder.encode(payload)));
}

/** The one credential check, so the middleware and the action cannot drift. */
export function credentialsValid(user: string, pass: string): boolean {
  // Both comparisons always run, so a correct username cannot be detected from
  // how long the request takes.
  const userOk = safeEqual(user, USER);
  const passOk = safeEqual(pass, PASS);
  return userOk && passOk;
}

export async function createSession(now = Date.now()): Promise<{ value: string; maxAge: number }> {
  const payload = `${VERSION}.${now + TTL_MS}`;
  return { value: `${payload}.${await sign(payload)}`, maxAge: Math.floor(TTL_MS / 1000) };
}

export async function verifySession(token: string | undefined, now = Date.now()): Promise<boolean> {
  if (!token) return false;

  const cut = token.lastIndexOf(".");
  if (cut < 1) return false;

  const payload = token.slice(0, cut);
  const [version, expiry] = payload.split(".");
  const expiresAt = Number(expiry);

  // The signature is checked before the expiry is trusted at all — an expiry
  // read off an unsigned token is just an attacker's number.
  const signatureOk = safeEqual(token.slice(cut + 1), await sign(payload));
  const fresh = version === VERSION && Number.isFinite(expiresAt) && expiresAt > now;

  return signatureOk && fresh;
}

/**
 * Scoped to `/admin`, so the cookie is never attached to a public page view —
 * and never lands in a shared cache alongside one.
 */
export const sessionCookie = {
  name: SESSION_COOKIE,
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/admin",
} as const;
