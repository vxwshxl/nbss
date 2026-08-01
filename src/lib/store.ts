import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Persistence for the three public forms.
 *
 * The site is read-mostly and the write volume for a regional agency is a
 * handful of enquiries a day, so a JSON file behind an in-process mutex is the
 * right amount of database: no driver, no migration, and the operator can read
 * the file with `cat`. Swapping in SQLite or Postgres later means
 * reimplementing this one module.
 *
 * Writes go through a temp file and an atomic rename, so a crash mid-write can
 * never leave a half-serialised record on disk.
 */

export type Kind = "enquiry" | "quote" | "application";
export type Status = "new" | "contacted" | "closed";

export type Submission = {
  id: string;
  kind: Kind;
  status: Status;
  createdAt: string;

  name: string;
  email?: string;
  phone: string;
  company?: string;
  subject?: string;
  message?: string;

  // Quote-specific.
  service?: string;
  siteType?: string;
  district?: string;
  headcount?: string;
  startWhen?: string;

  // Application-specific.
  vacancyId?: string;
  vacancyTitle?: string;
  age?: string;
  education?: string;
  experience?: string;

  // Request metadata, useful for spam triage.
  userAgent?: string;
  remoteIp?: string;
};

const DATA_FILE =
  process.env.NBSS_DATA ?? path.join(process.cwd(), "data", "submissions.json");

/**
 * Serialises every read-modify-write. Two form posts landing in the same tick
 * would otherwise both read the same array and one would overwrite the other.
 */
let queue: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  // Keep the chain alive even if this operation rejects.
  queue = run.catch(() => undefined);
  return run;
}

async function readAll(): Promise<Submission[]> {
  try {
    const raw = await readFile(DATA_FILE, "utf8");
    return raw.trim() ? (JSON.parse(raw) as Submission[]) : [];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

async function writeAll(subs: Submission[]): Promise<void> {
  await mkdir(path.dirname(DATA_FILE), { recursive: true });
  // A unique temp name keeps concurrent processes (e.g. a rebuild) from
  // clobbering each other's partial writes.
  const tmp = `${DATA_FILE}.${randomUUID()}.tmp`;
  await writeFile(tmp, JSON.stringify(subs, null, 2), "utf8");
  await rename(tmp, DATA_FILE);
}

/** Derives the next reference number from what is already on disk. */
function nextReference(subs: Submission[]): string {
  const highest = subs.reduce((max, s) => {
    const n = Number.parseInt(s.id.replace("NBSS-", ""), 10);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  return `NBSS-${String(highest + 1).padStart(5, "0")}`;
}

export type NewSubmission = Omit<Submission, "id" | "status" | "createdAt">;

/** Stores a submission and returns it with its reference number stamped on. */
export function addSubmission(input: NewSubmission): Promise<Submission> {
  return withLock(async () => {
    const subs = await readAll();
    const submission: Submission = {
      ...input,
      id: nextReference(subs),
      status: "new",
      createdAt: new Date().toISOString(),
    };
    subs.push(submission);
    await writeAll(subs);
    return submission;
  });
}

/** Newest first, optionally filtered by kind. */
export function listSubmissions(kind?: Kind): Promise<Submission[]> {
  return withLock(async () => {
    const subs = await readAll();
    return subs
      .filter((s) => !kind || s.kind === kind)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });
}

export function setStatus(id: string, status: Status): Promise<boolean> {
  return withLock(async () => {
    const subs = await readAll();
    const found = subs.find((s) => s.id === id);
    if (!found) return false;
    found.status = status;
    await writeAll(subs);
    return true;
  });
}

export type Counts = Record<string, number>;

export function countSubmissions(): Promise<Counts> {
  return withLock(async () => {
    const subs = await readAll();
    const counts: Counts = {
      total: subs.length,
      new: 0,
      enquiry: 0,
      quote: 0,
      application: 0,
    };
    for (const s of subs) {
      counts[s.kind] = (counts[s.kind] ?? 0) + 1;
      if (s.status === "new") counts.new += 1;
    }
    return counts;
  });
}
