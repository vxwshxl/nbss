/**
 * Points each app at the single .env at the repository root.
 *
 * Next reads `.env` from the app directory and does not walk up; Expo reads it
 * from the project directory. Three copies of one set of credentials is three
 * chances for a rotated key to be rotated in two of them — so there is one file
 * and the apps get symlinks to it.
 *
 * The links are not committed (.env is gitignored, and a symlink to a missing
 * file is worse than no symlink), so this runs after a fresh clone:
 *
 *   pnpm env:link
 */

import fs from "node:fs";
import path from "node:path";

import { ROOT } from "./db.mjs";

const source = path.join(ROOT, ".env");

if (!fs.existsSync(source)) {
  console.error("No .env at the repository root. Nothing to link.");
  process.exit(1);
}

for (const app of ["apps/web", "apps/mobile"]) {
  const dir = path.join(ROOT, app);
  if (!fs.existsSync(dir)) continue;

  const link = path.join(dir, ".env");

  // lstat, not exists: a symlink pointing at a file that has since moved reports
  // as absent to exists() and would then fail to be replaced.
  let current = null;
  try {
    current = fs.lstatSync(link);
  } catch {
    /* not there yet */
  }

  if (current?.isSymbolicLink()) {
    if (path.resolve(dir, fs.readlinkSync(link)) === source) {
      console.log(`ok       ${app}/.env`);
      continue;
    }
    fs.unlinkSync(link);
  } else if (current) {
    // A real file, not a link. Refused rather than overwritten: it may hold the
    // only copy of something.
    console.error(`SKIPPED  ${app}/.env is a real file, not a link. Move it aside first.`);
    continue;
  }

  fs.symlinkSync(path.relative(dir, source), link);
  console.log(`linked   ${app}/.env -> ${path.relative(dir, source)}`);
}
