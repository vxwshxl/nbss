import "server-only";

import { createSign } from "node:crypto";

/**
 * Google's own count of Maps Platform requests, read from Cloud Monitoring — the same
 * numbers as Google Cloud Console → Google Maps Platform → Metrics.
 *
 * Needs a service account key with the "Monitoring Viewer" role on the Google Cloud
 * project that owns the Maps key, as JSON in GOOGLE_CLOUD_MONITORING_KEY (the file's
 * contents, or the same base64-encoded). Read-only; nothing here can change anything
 * in Google Cloud. Without it, the Maps usage page falls back to NBSS's own count.
 */

type Key = { client_email: string; private_key: string; project_id: string };

/** The Maps APIs worth showing, by Google's service name. */
export const MAPS_SERVICES = {
  "maps-backend.googleapis.com": "Maps JavaScript API (website map loads)",
  "static-maps-backend.googleapis.com": "Maps Static API (SOS email maps)",
  "maps-android-backend.googleapis.com": "Maps SDK for Android (app, free)",
  "maps-ios-backend.googleapis.com": "Maps SDK for iOS",
} as const;
export type MapsService = keyof typeof MAPS_SERVICES;

export type GoogleUsage = { byService: Record<string, number>; byDay: Record<string, number> };

function readKey(): Key | null {
  const raw = process.env.GOOGLE_CLOUD_MONITORING_KEY?.trim();
  if (!raw) return null;
  try {
    const json = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    const k = JSON.parse(json) as Partial<Key>;
    return k.client_email && k.private_key && k.project_id ? (k as Key) : null;
  } catch {
    return null;
  }
}

export function monitoringConfigured(): boolean {
  return readKey() !== null;
}

const b64url = (v: string | Buffer) => Buffer.from(v).toString("base64url");

/** A one-hour access token for the read-only monitoring scope. */
async function token(key: Key): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64url(
    JSON.stringify({
      iss: key.client_email,
      scope: "https://www.googleapis.com/auth/monitoring.read",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${head}.${body}`);
  const jwt = `${head}.${body}.${b64url(signer.sign(key.private_key))}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
    cache: "no-store",
  });
  const data = (await res.json()) as { access_token?: string; error_description?: string };
  if (!data.access_token) throw new Error(data.error_description ?? "Google refused the monitoring key.");
  return data.access_token;
}

/**
 * Requests per Maps API and per day (IST dates) between two instants. Throws with
 * Google's message when the key or its role is wrong, so the page can say why.
 */
export async function googleMapsUsage(from: Date, to: Date): Promise<GoogleUsage | null> {
  const key = readKey();
  if (!key) return null;
  const access = await token(key);
  const services = Object.keys(MAPS_SERVICES)
    .map((s) => `"${s}"`)
    .join(",");
  const params = new URLSearchParams({
    filter: `metric.type="serviceruntime.googleapis.com/api/request_count" AND resource.type="consumed_api" AND resource.labels.service=one_of(${services})`,
    "interval.startTime": from.toISOString(),
    "interval.endTime": to.toISOString(),
    "aggregation.alignmentPeriod": "86400s",
    "aggregation.perSeriesAligner": "ALIGN_SUM",
    "aggregation.crossSeriesReducer": "REDUCE_SUM",
    "aggregation.groupByFields": "resource.labels.service",
  });
  const res = await fetch(`https://monitoring.googleapis.com/v3/projects/${key.project_id}/timeSeries?${params}`, {
    headers: { authorization: `Bearer ${access}` },
    next: { revalidate: 600 },
  });
  const data = (await res.json()) as {
    error?: { message?: string };
    timeSeries?: { resource?: { labels?: { service?: string } }; points?: { interval: { endTime: string }; value: { int64Value?: string } }[] }[];
  };
  if (data.error) throw new Error(data.error.message ?? "Cloud Monitoring refused the request.");

  const byService: Record<string, number> = {};
  const byDay: Record<string, number> = {};
  for (const series of data.timeSeries ?? []) {
    const service = series.resource?.labels?.service ?? "other";
    for (const p of series.points ?? []) {
      const n = Number(p.value.int64Value ?? 0);
      byService[service] = (byService[service] ?? 0) + n;
      // The day a point covers is the one before its end instant, in IST.
      const day = new Date(new Date(p.interval.endTime).getTime() - 1).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      if (service !== "maps-android-backend.googleapis.com") byDay[day] = (byDay[day] ?? 0) + n;
    }
  }
  return { byService, byDay };
}
