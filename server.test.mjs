import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createApp } from './server.mjs';

async function serve(t, options) {
  const server = createApp(options);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

test('búsqueda limitada a cinco, parámetros, deduplicación y caché', async t => {
  let calls = 0;
  const base = await serve(t, { apiKey: 'test-secret', fetchImpl: async input => {
    calls++;
    const url = new URL(input);
    assert.equal(url.searchParams.get('maxResults'), '5');
    assert.equal(url.searchParams.get('videoDuration'), 'short');
    assert.equal(url.searchParams.get('type'), 'video');
    assert.match(url.searchParams.get('q'), /Press de pecho.*#shorts/);
    const items = Array.from({ length: 8 }, (_, i) => ({ id: { videoId: `abcdefghij${i}` }, snippet: { title: `Ejercicio ${i}` } }));
    return Response.json({ items: [items[0], ...items] });
  } });
  const url = `${base}/api/youtube/videos?q=Press%20de%20pecho`;
  const response = await fetch(url);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.items.length, 5);
  assert.equal(new Set(body.items.map(item => item.id.videoId)).size, 5);
  assert.ok(!JSON.stringify(body).includes('test-secret'));
  await fetch(url);
  assert.equal(calls, 1);
});

test('configuración faltante, entrada inválida y rutas privadas', async t => {
  const base = await serve(t, { apiKey: '' });
  assert.equal((await fetch(`${base}/api/youtube/videos?q=remo`)).status, 503);
  assert.equal((await fetch(`${base}/api/youtube/videos?q=`)).status, 400);
  assert.equal((await fetch(`${base}/api/youtube/videos?q=${'a'.repeat(121)}`)).status, 400);
  assert.equal((await fetch(`${base}/.env`)).status, 404);
  assert.equal((await fetch(`${base}/server.mjs`)).status, 404);
  assert.equal((await fetch(base, { method: 'POST' })).status, 405);
  const page = await fetch(base);
  assert.match(page.headers.get('content-type'), /text\/html/);
  assert.match(await page.text(), /Buscar Shorts/);
});

test('errores de YouTube no filtran detalles ni claves', async t => {
  const base = await serve(t, { apiKey: 'secret', fetchImpl: async () => new Response('secret internal error', { status: 403 }) });
  const response = await fetch(`${base}/api/youtube/videos?q=remo`);
  assert.equal(response.status, 502);
  assert.ok(!(await response.text()).includes('secret'));
});

test('respuesta vacía y fallo de red', async t => {
  const empty = await serve(t, { apiKey: 'test', fetchImpl: async () => Response.json({ items: [] }) });
  assert.deepEqual(await (await fetch(`${empty}/api/youtube/videos?q=remo`)).json(), { items: [] });
  const offline = await serve(t, { apiKey: 'test', fetchImpl: async () => { throw new Error('network'); } });
  assert.equal((await fetch(`${offline}/api/youtube/videos?q=remo`)).status, 504);
});

test('JavaScript del HTML es válido', async () => {
  const html = await readFile(new URL('./rutina_completa_3dias_movil-v5.html', import.meta.url), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  assert.doesNotThrow(() => new vm.Script(script));
  assert.equal((html.match(/class="exercise-card"/g) || []).length, 13);
});
