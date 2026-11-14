import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const page = new URL('./rutina_completa_3dias_movil-v5.html', import.meta.url);
const MAX_RESULTS = 5;

export function createApp({ apiKey = process.env.YOUTUBE_API_KEY, fetchImpl = fetch } = {}) {
  const cache = new Map();
  const pending = new Map();
  async function search(query) {
    const cached = cache.get(query);
    if (cached && cached.expires > Date.now()) return cached.items;
    if (pending.has(query)) return pending.get(query);
    const request = (async () => {
      const params = new URLSearchParams({
        part: 'snippet', type: 'video', maxResults: String(MAX_RESULTS),
        q: `${query} técnica ejercicio #shorts`, videoDuration: 'short',
        relevanceLanguage: 'es', order: 'relevance', safeSearch: 'moderate', key: apiKey
      });
      let response;
      try {
        response = await fetchImpl(`https://www.googleapis.com/youtube/v3/search?${params}`, {
          signal: AbortSignal.timeout(10000)
        });
      } catch {
        throw { status: 504, message: 'YouTube no respondió. Intenta de nuevo.' };
      }
      if (!response.ok) {
        throw { status: 502, message: response.status === 403 || response.status === 429
          ? 'YouTube rechazó la consulta. Revisa la cuota y la configuración de la clave API en el servidor.'
          : 'YouTube no pudo completar la búsqueda. Intenta de nuevo.' };
      }
      let data;
      try { data = await response.json(); }
      catch { throw { status: 502, message: 'YouTube devolvió una respuesta inválida.' }; }
      if (!Array.isArray(data.items)) throw { status: 502, message: 'Respuesta de YouTube incompleta.' };
      const seen = new Set();
      const items = data.items.filter(item => {
        const id = item?.id?.videoId;
        if (!/^[A-Za-z0-9_-]{11}$/.test(id) || !item.snippet || seen.has(id)) return false;
        seen.add(id);
        return true;
      }).slice(0, MAX_RESULTS).map(item => ({
        id: { videoId: item.id.videoId },
        snippet: { title: String(item.snippet.title || 'Video de YouTube'),
          channelTitle: String(item.snippet.channelTitle || '') }
      }));
      if (cache.size >= 100) cache.delete(cache.keys().next().value);
      cache.set(query, { items, expires: Date.now() + 5 * 60 * 1000 });
      return items;
    })();
    pending.set(query, request);
    try { return await request; } finally { pending.delete(query); }
  }
  return http.createServer(async (req, res) => {
    const json = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(body));
    };
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    try {
      const url = new URL(req.url, 'http://localhost');
      if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return json(405, { error: 'Método no permitido.' });
      }
      if (url.pathname === '/api/youtube/videos') {
        const query = (url.searchParams.get('q') || '').normalize('NFKC').trim().replace(/\s+/g, ' ');
        if (!query || query.length > 120 || /[\u0000-\u001f]/.test(query)) return json(400, { error: 'Escribe un ejercicio de 1 a 120 caracteres.' });
        if (!apiKey) return json(503, { error: 'Configura YOUTUBE_API_KEY en el servidor para activar las búsquedas.' });
        return json(200, { items: await search(query) });
      }
      if (url.pathname === '/' || url.pathname === '/rutina_completa_3dias_movil-v5.html') {
        const html = await readFile(page);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(html);
      }
      json(404, { error: 'Página no encontrada.' });
    } catch (error) {
      json(error.status || 500, { error: error.message && error.status ? error.message : 'No se pudo completar la solicitud.' });
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const port = Number(process.env.PORT || 8080);
  const host = process.env.HOST || '127.0.0.1';
  createApp().listen(port, host, () => console.log(`Rutina disponible en http://${host}:${port}`));
}
