import "server-only";

import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type GetObjectCommandOutput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Cloudflare R2, over the S3 API.
 *
 * The bucket is private and stays private. Guard selfies, identity documents
 * and incident photographs live here, so nothing is served from a public
 * bucket URL — reads go through a short-lived presigned link issued to
 * somebody the server has already checked.
 *
 * The one exception is map tiles, which are public data from OpenStreetMap and
 * are streamed back through our own route so the site's Content-Security-Policy
 * can stay `default-src 'self'`.
 */

let cached: S3Client | null = null;

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set in .env`);
  return value;
}

export function r2(): S3Client {
  cached ??= new S3Client({
    region: "auto",
    endpoint:
      process.env.R2_ENDPOINT ??
      `https://${required("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: required("R2_ACCESS_KEY_ID"),
      secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
    },
  });
  return cached;
}

export function bucket(): string {
  return process.env.R2_BUCKET_NAME ?? "nbss";
}

/** Returns null for a miss rather than throwing, so callers can treat it as a cache. */
export async function getObject(key: string): Promise<GetObjectCommandOutput | null> {
  try {
    return await r2().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  } catch {
    return null;
  }
}

export async function putObject(
  key: string,
  body: Uint8Array | Buffer,
  contentType: string,
): Promise<void> {
  await r2().send(
    new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType }),
  );
}

/**
 * A link that works for a few minutes and then does not.
 *
 * Everything private in this bucket is reached this way: the URL is minted per
 * request, for someone whose role has already been checked, and expires long
 * before it could be usefully shared.
 */
export function signedUrl(key: string, seconds = 300): Promise<string> {
  return getSignedUrl(r2(), new GetObjectCommand({ Bucket: bucket(), Key: key }), {
    expiresIn: seconds,
  });
}
