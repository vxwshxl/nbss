/**
 * Serves the Expo app's web export (`expo export -p web`) with a single-page
 * fallback, so the film can capture the real app screens in a phone frame.
 *
 *   node scripts/serve-app.mjs <export dir> [port]
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "dist-app");
const port = Number(process.argv[3] ?? 8090);
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".ttf": "font/ttf", ".ico": "image/x-icon", ".css": "text/css", ".svg": "image/svg+xml", ".webp": "image/webp" };

http
  .createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let file = path.join(root, url);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      file = path.join(root, "index.html");
    }
    res.writeHead(200, { "content-type": types[path.extname(file)] ?? "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  })
  .listen(port, () => console.log(`app on http://localhost:${port}`));
