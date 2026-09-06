import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const tags = [...html.matchAll(/<meta\s+(?:property|name)="([^"]+)"\s+content="([^"]*)"\s*\/>/g)];
function meta(key) {
  const values = tags.filter(tag => tag[1] === key);
  assert.equal(values.length, 1, `one static ${key} tag for non-JS crawlers`);
  return values[0][2];
}

test('share card has static title, description and canonical production URL', () => {
  assert.equal(meta('og:type'), 'website');
  assert.equal(meta('og:locale'), 'ko_KR');
  assert.equal(meta('og:title'), 'MUMU CIRCUIT · 돌아오는 불빛');
  assert.equal(meta('og:description'), meta('description'));
  assert.equal(meta('og:url'), 'https://mumu-racing.vercel.app/');
  assert.ok(html.includes('<link rel="canonical" href="https://mumu-racing.vercel.app/" />'));
});

test('share image is a real public PNG with accurate dimensions and bounded size', () => {
  const url = new URL(meta('og:image'));
  assert.equal(url.origin, 'https://mumu-racing.vercel.app');
  assert.equal(url.pathname, '/social/harbor-garage-v1.png');
  assert.equal(meta('og:image:secure_url'), url.href);
  assert.equal(meta('og:image:type'), 'image/png');
  const bytes = readFileSync(new URL('../public' + url.pathname, import.meta.url));
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(bytes.readUInt32BE(16), Number(meta('og:image:width')));
  assert.equal(bytes.readUInt32BE(20), Number(meta('og:image:height')));
  assert.ok(bytes.length < 1024 * 1024);
  assert.ok(meta('og:image:alt').length > 10);
});

test('large-image card uses the same accessible image and copy', () => {
  assert.equal(meta('twitter:card'), 'summary_large_image');
  for (const key of ['title', 'description', 'image', 'image:alt']) {
    assert.equal(meta('twitter:' + key), meta('og:' + key));
  }
});
