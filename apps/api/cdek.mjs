// CDEK pickup points and prices for the checkout map (owner, 2026-11-17; docs/ORDERS.md). The CDEK widget in the
// browser (@cdek-it/widget) asks this server, and only this server holds the CDEK keys — the same three requests as
// CDEK's own service.php: the list of pickup points, the points in the map's area and the price of the tariffs.
// Keys: CDEK_CLIENT_ID and CDEK_CLIENT_SECRET, YANDEX_MAPS_KEY for the map; CDEK_API_BASE is https://api.cdek.ru/v2 (production) unless set —
// for local work CDEK's public test account on https://api.edu.cdek.ru/v2 (see docs/DEVELOPMENT.md). Without keys
// the route answers 503 and the checkout shows that the map is not connected yet.

const ACTIONS = { offices: ['GET', 'deliverypoints'], byCoordinate: ['GET', 'deliverypoints/byPolygons'], calculate: ['POST', 'calculator/tarifflist'] };
const WINDOW_MS = 60_000, LIMIT = 120;

export function createCdek({ clientId = process.env.CDEK_CLIENT_ID, clientSecret = process.env.CDEK_CLIENT_SECRET, base = process.env.CDEK_API_BASE || 'https://api.cdek.ru/v2', yandexKey = process.env.YANDEX_MAPS_KEY || '', fetchImpl = fetch } = {}) {
  // The map needs both: CDEK's keys (here, secret) and a Yandex Maps key (public, limited to the site's address by
  // Yandex, handed to the browser by action=config).
  const enabled = Boolean(clientId && clientSecret && yandexKey);
  let token = null, expires = 0;
  const hits = new Map();
  async function auth() {
    if (token && Date.now() < expires) return token;
    const r = await fetchImpl(`${base}/oauth/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }) });
    const body = await r.json().catch(() => ({}));
    if (!body.access_token) throw new Error('CDEK did not authorise the shop');
    token = body.access_token; expires = Date.now() + Math.max(60, (Number(body.expires_in) || 3600) - 60) * 1000;
    return token;
  }
  const limited = ip => { const now = Date.now(); const list = (hits.get(ip) || []).filter(t => now - t < WINDOW_MS); list.push(now); hits.set(ip, list); return list.length > LIMIT; };
  async function handle(req, res, url) {
    const send = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Service-Version': '4.0.0' }); res.end(typeof body === 'string' ? body : JSON.stringify(body)); };
    if (url.searchParams.get('action') === 'config') return send(200, { enabled, yandexKey: enabled ? yandexKey : '' });
    if (!enabled) return send(503, { message: 'Карта СДЭК пока не подключена' });
    const clientIp=String(req.headers?.['x-forwarded-for']||'').split(',')[0].trim()||req.socket?.remoteAddress||'local';
    if (limited(clientIp)) return send(429, { message: 'Слишком много запросов, попробуйте через минуту' });
    const query = Object.fromEntries(url.searchParams);
    let body = {};
    if (req.method === 'POST') { const chunks = []; let size = 0; for await (const c of req) { size += c.length; if (size > 64_000) return send(413, { message: 'Слишком большой запрос' }); chunks.push(c); } try { body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { body = {}; } }
    const data = { ...query, ...body };
    const action = ACTIONS[data.action];
    if (!action) return send(400, { message: 'Unknown action' });
    delete data.action;
    try {
      const [method, path] = action;
      const headers = { Accept: 'application/json', Authorization: `Bearer ${await auth()}`, 'X-App-Name': 'widget_pvz', 'X-App-Version': '4.0.0' };
      const target = method === 'GET' ? `${base}/${path}?${new URLSearchParams(data)}` : `${base}/${path}`;
      const r = await fetchImpl(target, method === 'GET' ? { headers } : { method, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const text = await r.text();
      // The widget reads the total count of points from CDEK's own headers.
      for (const [k, v] of r.headers) if (/^x-/i.test(k)) res.setHeader(k, v);
      send(r.status, text);
    } catch { send(502, { message: 'СДЭК сейчас не отвечает, попробуйте позже' }); }
  }
  return { enabled, handle };
}
