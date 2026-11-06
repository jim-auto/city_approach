import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";

export async function startTestServer() {
  if (process.env.SMOKE_URL) return { url: process.env.SMOKE_URL, close: async () => {} };
  const root = fileURLToPath(new URL("../", import.meta.url));
  const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png" };
  const server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      const path = resolve(root, `.${pathname === "/" ? "/index.html" : pathname}`);
      if (!path.startsWith(root.endsWith(sep) ? root : root + sep)) { res.writeHead(403).end(); return; }
      const data = await readFile(path);
      res.writeHead(200, { "Content-Type": types[extname(path)] || "application/octet-stream" });
      res.end(data);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  return { url: `http://127.0.0.1:${server.address().port}/`, close: () => new Promise((done) => server.close(done)) };
}
