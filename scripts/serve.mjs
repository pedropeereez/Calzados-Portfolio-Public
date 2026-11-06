// Local preview only. Deliberately serves an allowlist, never .git or config files.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicFiles = new Set(['index.html', 'app.js', 'core.js', 'demo-data.js', 'styles.css']);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8' };
http.createServer(async (req, res) => {
    try {
        if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
        const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\//, '') || 'index.html';
        if (!publicFiles.has(name) && !/^assets\/[a-zA-Z0-9_.-]+\.(css|js|svg|txt)$/.test(name)) { res.writeHead(404); res.end(); return; }
        const file = path.resolve(root, name);
        if (!file.startsWith(root + path.sep)) { res.writeHead(404); res.end(); return; }
        const body = await readFile(file);
        res.writeHead(200, {
            'Content-Type': types[path.extname(file)] || 'application/octet-stream',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'Referrer-Policy': 'no-referrer',
            'Cache-Control': 'no-store',
            'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'none'; font-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'; frame-ancestors 'none'"
        });
        res.end(req.method === 'HEAD' ? undefined : body);
    } catch { res.writeHead(404); res.end(); }
}).listen(4173, '127.0.0.1', () => console.log('Demo: http://127.0.0.1:4173'));
