const KIWI_MCP_URL = 'https://mcp.kiwi.com';
const ALLOWED_ORIGINS = new Set([
  'https://ibnkhaldoun-svg.github.io',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
]);

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const cors = corsHeaders(request);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    if (url.pathname === '/health' && request.method === 'GET') {
      return json({ ok: true, service: 'Fly2 API', provider: 'Kiwi.com MCP', upstream: KIWI_MCP_URL, mode: 'live-v2' }, 200, cors);
    }

    if (url.pathname === '/tools' && request.method === 'GET') {
      try {
        const client = await createMcpClient();
        return json({ ok: true, tools: await client.listTools() }, 200, cors);
      } catch (error) {
        return json({ ok: false, error: safeError(error) }, 502, cors);
      }
    }

    if (url.pathname === '/demo' && request.method === 'GET') {
      const departure = addDays(new Date(), 14);
      const back = addDays(departure, 3);
      return searchFlights({ origin: 'Bologna', destination: 'Barcelona', departureDate: isoDate(departure), returnDate: isoDate(back), adults: 1, maxStopovers: 1 }, cors);
    }

    if (url.pathname === '/search' && request.method === 'POST') {
      try {
        enforceAllowedOrigin(request);
        const input = await request.json();
        validateSearch(input);
        return await searchFlights(input, cors);
      } catch (error) {
        return json({ ok: false, error: safeError(error) }, 400, cors);
      }
    }

    return json({ ok: false, error: 'Endpoint non trovato.', endpoints: ['GET /health', 'GET /tools', 'GET /demo', 'POST /search'] }, 404, cors);
  }
};

async function searchFlights(input, cors) {
  try {
    const client = await createMcpClient();
    const tools = await client.listTools();
    const tool = tools.find(t => t.name === 'search-flight') || tools.find(t => /search.*flight|flight.*search/i.test(t.name));
    if (!tool) throw new Error('Il server Kiwi non espone uno strumento di ricerca voli compatibile.');
    const args = buildSearchArguments(tool.inputSchema || {}, input);
    const rawResult = await client.callTool(tool.name, args);
    const result = normalizeToolResult(rawResult);
    return json({ ok: true, provider: 'Kiwi.com MCP', tool: tool.name, request: input, result }, 200, cors);
  } catch (error) {
    return json({ ok: false, error: safeError(error) }, 502, cors);
  }
}

function buildSearchArguments(inputSchema, input) {
  const properties = inputSchema.properties || {};
  const args = {};
  const put = (key, value) => {
    if (Object.prototype.hasOwnProperty.call(properties, key) && value !== undefined && value !== null && value !== '') args[key] = value;
  };

  put('flyFrom', input.origin);
  put('flyTo', input.destination);
  put('departureDate', toDmy(input.departureDate));
  put('departureDateFlexDays', intOrNull(input.departureDateFlexDays));
  if (input.departureDateTo) put('departureDateTo', toDmy(input.departureDateTo));
  if (input.returnDate) put('returnDate', toDmy(input.returnDate));
  put('returnDateFlexDays', intOrNull(input.returnDateFlexDays));
  if (input.returnDateTo) put('returnDateTo', toDmy(input.returnDateTo));

  put('adults', clampInt(input.adults, 1, 9, 1));
  put('children', clampInt(input.children, 0, 8, 0));
  put('infants', clampInt(input.infants, 0, 4, 0));
  put('cabinClass', input.cabinClass || 'M');
  put('currency', input.currency || 'EUR');
  put('locale', input.locale || 'it');
  put('sort', input.sort || 'price');

  put('nights_in_dst_from', intOrNull(input.nightsFrom));
  put('nights_in_dst_to', intOrNull(input.nightsTo));
  put('one_for_city', Boolean(input.oneForCity));
  put('max_sector_stopovers', intOrNull(input.maxStopovers));
  put('max_fly_duration', intOrNull(input.maxFlyDurationHours));
  put('stopover_to', intOrNull(input.maxLayoverHours));
  put('stopover_from', intOrNull(input.minLayoverHours));

  put('select_airlines', csv(input.selectAirlines));
  put('exclude_airlines', csv(input.excludeAirlines));
  put('stopover_airports', csv(input.stopoverAirports));
  put('exclude_stopover_airports', csv(input.excludeStopoverAirports));
  put('stopover_countries', csv(input.stopoverCountries));
  put('exclude_stopover_countries', csv(input.excludeStopoverCountries));

  put('fly_days', csv(input.flyDays));
  put('ret_fly_days', csv(input.returnFlyDays));
  put('dtime_from', intOrNull(input.departureHourFrom));
  put('dtime_to', intOrNull(input.departureHourTo));
  put('ret_dtime_from', intOrNull(input.returnHourFrom));
  put('ret_dtime_to', intOrNull(input.returnHourTo));

  if (typeof input.allowSelfTransfer === 'boolean') put('allow_self_transfer', input.allowSelfTransfer);
  if (typeof input.allowOvernightStopovers === 'boolean') put('allow_overnight_stopovers', input.allowOvernightStopovers);
  if (typeof input.allowDifferentAirportConnection === 'boolean') put('allow_diff_airport_connection', input.allowDifferentAirportConnection);

  return args;
}

function validateSearch(input) {
  if (!input || typeof input !== 'object') throw new Error('Richiesta non valida.');
  if (!String(input.origin || '').trim() || !String(input.destination || '').trim()) throw new Error('Partenza e destinazione sono obbligatorie.');
  if (!isIsoDate(input.departureDate)) throw new Error('La data di partenza deve essere YYYY-MM-DD.');
  for (const key of ['departureDateTo', 'returnDate', 'returnDateTo']) {
    if (input[key] && !isIsoDate(input[key])) throw new Error(`${key} deve essere YYYY-MM-DD.`);
  }
  if (input.departureDateTo && input.departureDateTo < input.departureDate) throw new Error('La fine del range di partenza non può precedere l’inizio.');
  if (input.returnDate && input.returnDate < input.departureDate) throw new Error('Il ritorno non può precedere la partenza.');
  if (input.returnDate && input.returnDateTo && input.returnDateTo < input.returnDate) throw new Error('La fine del range di ritorno non può precedere l’inizio.');
}

function corsHeaders(request) {
  const origin = request.headers.get('Origin');
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://ibnkhaldoun-svg.github.io';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
    'Cache-Control': 'no-store'
  };
}

function enforceAllowedOrigin(request) {
  const origin = request.headers.get('Origin');
  if (origin && !ALLOWED_ORIGINS.has(origin)) throw new Error('Origine non autorizzata.');
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data, null, 2), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers } });
}

function isIsoDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')); }
function toDmy(iso) { const [y, m, d] = String(iso).split('-'); return `${d}/${m}/${y}`; }
function intOrNull(value) { if (value === undefined || value === null || value === '') return null; const n = Number.parseInt(value, 10); return Number.isFinite(n) ? n : null; }
function clampInt(value, min, max, fallback) { const n = Number.parseInt(value, 10); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback; }
function csv(value) { if (Array.isArray(value)) return value.filter(Boolean).join(',') || null; return String(value || '').trim() || null; }
function addDays(date, days) { const out = new Date(date); out.setDate(out.getDate() + days); return out; }
function isoDate(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }

async function createMcpClient() {
  let sessionId = null;
  let protocolVersion = '2025-03-26';
  let rpcId = 1;

  const post = async (body, notification = false) => {
    const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream', 'MCP-Protocol-Version': protocolVersion };
    if (sessionId) headers['Mcp-Session-Id'] = sessionId;
    const response = await fetch(KIWI_MCP_URL, { method: 'POST', headers, body: JSON.stringify(body) });
    const newSession = response.headers.get('Mcp-Session-Id');
    if (newSession) sessionId = newSession;
    if (notification && (response.status === 202 || response.status === 204)) return null;
    const payload = await parseMcpResponse(response);
    if (!response.ok) throw new Error(`Kiwi MCP HTTP ${response.status}: ${extractMessage(payload)}`);
    if (payload?.error) throw new Error(`Kiwi MCP: ${payload.error.message || 'errore JSON-RPC'}`);
    return payload;
  };

  const init = await post({ jsonrpc: '2.0', id: rpcId++, method: 'initialize', params: { protocolVersion, capabilities: {}, clientInfo: { name: 'Fly2', version: '0.2.0' } } });
  if (init?.result?.protocolVersion) protocolVersion = init.result.protocolVersion;
  await post({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }, true);

  return {
    async listTools() { const response = await post({ jsonrpc: '2.0', id: rpcId++, method: 'tools/list', params: {} }); return response?.result?.tools || []; },
    async callTool(name, args) { const response = await post({ jsonrpc: '2.0', id: rpcId++, method: 'tools/call', params: { name, arguments: args } }); return response?.result || response; }
  };
}

async function parseMcpResponse(response) {
  const text = await response.text();
  if (!text.trim()) return null;
  const contentType = response.headers.get('Content-Type') || '';
  if (contentType.includes('application/json')) return JSON.parse(text);
  if (contentType.includes('text/event-stream') || text.includes('\ndata:')) {
    const messages = [];
    for (const line of text.split(/\r?\n/)) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try { messages.push(JSON.parse(data)); } catch {}
    }
    if (messages.length) return messages[messages.length - 1];
  }
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

function normalizeToolResult(result) {
  if (!result) return null;
  if (result.structuredContent) return result.structuredContent;
  if (Array.isArray(result.content)) {
    const texts = result.content.filter(item => item?.type === 'text' && typeof item.text === 'string').map(item => item.text);
    if (texts.length === 1) { try { return JSON.parse(texts[0]); } catch { return texts[0]; } }
    if (texts.length) return texts;
  }
  return result;
}

function extractMessage(payload) {
  if (!payload) return 'nessuna risposta';
  if (payload.error?.message) return payload.error.message;
  if (payload.raw) return String(payload.raw).slice(0, 300);
  return JSON.stringify(payload).slice(0, 300);
}
function safeError(error) { return error instanceof Error ? error.message : String(error); }
