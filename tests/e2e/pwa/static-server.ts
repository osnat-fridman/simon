import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { extname, join, normalize } from 'node:path';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.webmanifest': 'application/manifest+json',
};

export interface StaticServer {
  // Switches which build directory is served (simulates deploying a new version).
  setRoot(dir: string): void;
  // Makes one path answer with HTTP 500 (simulates a failed download), or null to stop.
  failPath(path: string | null): void;
  // How many requests were answered with the simulated failure.
  failedHits(): number;
  close(): Promise<void>;
}

// Minimal server for a Vite build under `base`; no caching headers, like a fresh deploy.
export async function startStaticServer(port: number, base: string, root: string) {
  let currentRoot = root;
  let failing: string | null = null;
  let hits = 0;

  const server: Server = createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    if (path === failing) {
      hits++;
      res.writeHead(500).end();
      return;
    }
    if (!path.startsWith(base)) {
      res.writeHead(404).end();
      return;
    }
    const relative = path.slice(base.length);
    const file = !relative || relative.endsWith('/') ? `${relative}index.html` : normalize(relative);
    try {
      const body = await readFile(join(currentRoot, file));
      res.writeHead(200, {
        'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
        'cache-control': 'no-cache',
      });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });

  await new Promise<void>((resolve) => server.listen(port, resolve));

  return {
    setRoot: (dir: string) => (currentRoot = dir),
    failPath: (p: string | null) => {
      failing = p;
      hits = 0;
    },
    failedHits: () => hits,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  } satisfies StaticServer;
}
