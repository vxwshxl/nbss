// PM2 process for okhrang.core. Port 3040 is bound to localhost; nginx fronts it.
// Other projects on the box hold 3003/3004/3010/3020/3030 — never reuse them.

const fs = require("fs");

// Which build is live: deploy/deploy.sh builds into whichever of .next-a / .next-b is not
// serving, then writes its name here and reloads. Read each time PM2 loads this file, so
// a reload starts the new build while the old one served until that moment. Before the
// first such deploy there is no file, and the site runs from .next as it always did.
const distDir = (() => {
  try {
    const name = fs.readFileSync("/srv/nbss/apps/web/.next-active", "utf8").trim();
    return /^\.next-[ab]$/.test(name) ? name : ".next";
  } catch {
    return ".next";
  }
})();

module.exports = {
  apps: [
    {
      name: "nbss",
      cwd: "/srv/nbss/apps/web",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3040 -H 127.0.0.1",
      env: { NODE_ENV: "production", TZ: "Asia/Kolkata", NBSS_DATA: "/var/lib/nbss/submissions.json", NEXT_DIST_DIR: distDir },
      // The heap is capped below the restart limit, so Node collects garbage before PM2
      // has to kill it. At 700M a burst of console pages (750–935 MB) restarted the site
      // several times a day, and every restart dropped pages for a few seconds. The box
      // has 16 GB.
      node_args: "--max-old-space-size=1280",
      max_memory_restart: "1536M",
      time: true,
    },
    {
      // Sends push_outbox to Expo (supabase/migrations/0020_push_worker.sql).
      name: "nbss-push",
      cwd: "/srv/nbss/apps/web",
      script: "scripts/push-worker.mjs",
      node_args: "--env-file=.env",
      env: { TZ: "Asia/Kolkata" },
      max_memory_restart: "150M",
      time: true,
    },
  ],
};
