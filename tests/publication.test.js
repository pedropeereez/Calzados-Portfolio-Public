import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = new URL('../', import.meta.url);
test('public page has no live endpoints, inline handlers or remote dependencies', async () => {
    const html = await readFile(new URL('index.html', root), 'utf8');
    const app = await readFile(new URL('app.js', root), 'utf8');
    assert.doesNotMatch(html, /(?:src|href|action)\s*=\s*["']https?:\/\//i);
    assert.doesNotMatch(html, /\son[a-z]+\s*=/i);
    assert.match(html, /connect-src 'none'/);
    assert.match(html, /form-action 'none'/);
    assert.match(html, /script-src 'self';/);
    assert.doesNotMatch(app, /innerHTML|insertAdjacentHTML|document\.write|eval\(|fetch\(/);
    assert.doesNotMatch(html, /src="config(?:\.local)?\.js"/);
});
test('publication tree excludes local configs, original photo archives and credential file types', async () => {
    async function visit(dir) {
        for (const entry of await readdir(new URL(dir, root), { withFileTypes: true })) {
            if (['.git', 'node_modules'].includes(entry.name)) continue;
            const rel = path.posix.join(dir, entry.name);
            assert.doesNotMatch(entry.name, /^(?:\.env(?:\..*)?|config\.js|config\.local\..*|Fotos|private|backups)$/);
            assert.doesNotMatch(entry.name, /\.(?:pem|key|p12|pfx|code-workspace)$/i);
            if (entry.isDirectory()) await visit(rel + '/');
        }
    }
    await visit('./');
});
