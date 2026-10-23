// PM2 process for okhrang.core. Port 3040 is bound to localhost; nginx fronts it.
// Other projects on the box hold 3003/3004/3010/3020/3030 — never reuse them.
module.exports = {
  apps: [
    {
      name: "nbss",
      cwd: "/srv/nbss/apps/web",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3040 -H 127.0.0.1",
      env: { NODE_ENV: "production", NBSS_DATA: "/var/lib/nbss/submissions.json" },
      max_memory_restart: "700M",
      time: true,
    },
  ],
};
