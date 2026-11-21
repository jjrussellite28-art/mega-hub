// Starter media add-on layer test: node scripts/stream-addons-check.mjs
// Starts a tiny fake add-on on this machine and runs the client in ui/core/stream-addons.js against it.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { addonBase, loadAddon, loadAllStreams, loadCatalog, loadMeta, loadStreams, safeUrl, toStream, withAddon, withoutAddon } from '../ui/core/stream-addons.js';

// --- address handling -------------------------------------------------------
assert.equal(safeUrl('javascript:alert(1)'), null);
assert.equal(safeUrl('file:///c:/x'), null);
assert.equal(safeUrl('data:text/html,hi'), null);
assert.equal(safeUrl(42), null);
assert.equal(safeUrl('https://example.com/a.png'), 'https://example.com/a.png');
assert.equal(addonBase('https://x.example/abc/manifest.json'), 'https://x.example/abc');
assert.equal(addonBase('https://x.example/abc/'), 'https://x.example/abc');
assert.equal(addonBase('stremio://x.example/abc/manifest.json'), 'https://x.example/abc');
assert.equal(addonBase('https://x.example/abc/manifest.json?key=1#h'), 'https://x.example/abc');
assert.equal(addonBase('not a link'), null);
assert.equal(addonBase('ftp://x.example/manifest.json'), null);

// --- toStream ---------------------------------------------------------------
assert.equal(toStream({ url: 'javascript:1' }).playable, false);
assert.equal(toStream({ infoHash: 'abc' }).needs, 'torrent');
assert.equal(toStream({ url: 'https://v.example/a.mp4', title: 'HD' }).playable, true);
assert.equal(toStream(null), null);

// --- fake add-on --------------------------------------------------------------
const manifest = {
  id: 'test.addon',
  name: 'Test Add-on',
  version: '1.0.0',
  resources: ['catalog', 'meta', { name: 'stream', types: ['movie'] }],
  types: ['movie'],
  catalogs: [
    { type: 'movie', id: 'top', name: 'Top' },
    { type: 'movie', id: 'search-only', name: 'Search', extra: [{ name: 'search', isRequired: true }] }
  ]
};
const seen = [];
const server = createServer((req, res) => {
  seen.push(req.url);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  const send = (o, code = 200) => { res.statusCode = code; res.end(JSON.stringify(o)); };
  if (req.url === '/manifest.json') return send(manifest);
  if (req.url === '/catalog/movie/top.json') {
    return send({
      metas: [
        { id: 'tt1', type: 'movie', name: 'One', poster: 'https://img.example/1.jpg', releaseInfo: '2020' },
        { id: 'tt2', type: 'movie', name: 'Two', poster: 'javascript:alert(1)' },
        { id: '', name: 'No id' },
        'junk'
      ]
    });
  }
  if (req.url === '/meta/movie/tt1.json') return send({ meta: { id: 'tt1', type: 'movie', name: 'One', description: 'Plot', genres: ['Drama'] } });
  if (req.url === '/stream/movie/tt1.json') {
    return send({ streams: [{ infoHash: 'abc', title: 'torrent' }, { url: 'https://v.example/one.mp4', title: '1080p' }] });
  }
  if (req.url === '/stream/movie/boom.json') return send({ error: 'x' }, 500);
  return send({}, 404);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

try {
  const addon = await loadAddon(`${base}/manifest.json`);
  assert.equal(addon.id, 'test.addon');
  assert.equal(addon.base, base);
  assert.deepEqual(addon.resources, ['catalog', 'meta', 'stream']);
  assert.equal(addon.catalogs.length, 2);
  assert.equal(addon.catalogs[0].browsable, true);
  assert.equal(addon.catalogs[1].browsable, false);

  const items = await loadCatalog(addon, addon.catalogs[0]);
  assert.equal(items.length, 2, 'bad entries are dropped');
  assert.equal(items[0].name, 'One');
  assert.equal(items[0].poster, 'https://img.example/1.jpg');
  assert.equal(items[0].year, '2020');
  assert.equal(items[0].source.name, 'Test Add-on');
  assert.equal(items[1].poster, null, 'unsafe picture address is removed');

  const meta = await loadMeta(addon, 'movie', 'tt1');
  assert.equal(meta.description, 'Plot');
  assert.deepEqual(meta.genres, ['Drama']);

  const streams = await loadStreams(addon, 'movie', 'tt1');
  assert.equal(streams.length, 2);
  assert.equal(streams[1].playable, true);
  assert.equal(streams[0].needs, 'torrent');

  // One failing add-on must not hide the other one's streams.
  const broken = { ...addon, id: 'broken', name: 'Broken', base: `${base}/nothing` };
  const all = await loadAllStreams([broken, addon], 'movie', 'tt1');
  assert.equal(all.length, 2);
  assert.equal(all[0].playable, true, 'playable first');
  assert.equal(all[0].from, 'Test Add-on');

  // Not an add-on / not reachable
  await assert.rejects(() => loadAddon('nonsense'), /not-an-address/);
  await assert.rejects(() => loadAddon(`${base}/zzz/manifest.json`), /HTTP 404/);
  await assert.rejects(() => loadAddon(`${base}/manifest.json`, async () => ({ ok: true, json: async () => ({ hello: 1 }) })), /not-an-addon/);

  // List editing
  let list = withAddon([], addon);
  list = withAddon(list, { ...addon, version: '2' });
  assert.equal(list.length, 1);
  assert.equal(list[0].version, '2');
  assert.equal(withoutAddon(list, 'test.addon').length, 0);

  console.log('stream-addons-check: ok');
} finally {
  server.close();
}
