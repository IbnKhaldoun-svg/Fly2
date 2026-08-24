const KIWI_MCP_URL = 'https://mcp.kiwi.com';
const RYANAIR_FINDER_URL = 'https://ryanair-flight-finder-v2.vercel.app/api/search';
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
      return json({ ok: true, service: 'Fly2 API', providers: ['Kiwi.com MCP', 'Ryanair direct fare finder'], upstream: KIWI_MCP_URL, mode: 'live-v3' }, 200, cors);
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

    if (url.pathname === '/ryanair-compare' && request.method === 'POST') {
      try {
        enforceAllowedOrigin(request);
        const input = await request.json();
        validateRyanairCompare(input);
        return await compareRyanair(input, cors);
      } catch (error) {
        return json({ ok: false, error: safeError(error) }, 400, cors);
      }
    }

    return json({ ok: false, error: 'Endpoint non trovato.', endpoints: ['GET /health', 'GET /tools', 'GET /demo', 'POST /search', 'POST /ryanair-compare'] }, 404, cors);
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
    const sanitized = removeHiddenCityItineraries(result);
    return json({ ok: true, provider: 'Kiwi.com MCP', tool: tool.name, request: input, result: sanitized }, 200, cors);
  } catch (error) {
    return json({ ok: false, error: safeError(error) }, 502, cors);
  }
}


async function compareRyanair(input, cors) {
  const payload = buildRyanairFinderPayload(input);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000);

  try {
    const response = await fetch(RYANAIR_FINDER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch {}

    if (!response.ok) {
      const message = data?.error?.message || `Ryanair Finder HTTP ${response.status}`;
      throw new Error(message);
    }

    const itineraries = Array.isArray(data?.itineraries) ? data.itineraries.map(item => normalizeRyanairItinerary(item, payload)).filter(Boolean) : [];
    itineraries.sort((a, b) => a.totalPrice - b.totalPrice);

    return json({
      ok: true,
      provider: 'Ryanair direct fare finder',
      source: 'ryanair-flight-finder-v2',
      itineraries,
      statistics: data?.statistics || null,
      meta: {
        count: itineraries.length,
        partialResults: Boolean(data?.meta?.partialResults),
        durationMs: data?.meta?.durationMs ?? null
      }
    }, 200, cors);
  } catch (error) {
    const message = error instanceof Error && error.name === 'AbortError'
      ? 'Il confronto diretto Ryanair ha impiegato troppo tempo.'
      : safeError(error);
    return json({ ok: false, error: message }, 502, cors);
  } finally {
    clearTimeout(timeout);
  }
}

function buildRyanairFinderPayload(input) {
  const maxStopovers = clampInt(input.maxStopovers, 0, 2, 1);
  const connectionPreference = maxStopovers === 0 ? 'direct' : maxStopovers === 1 ? 'one-stop' : 'any';
  const maxLayoverHours = input.maxLayoverHours === null || input.maxLayoverHours === undefined
    ? null
    : Number(input.maxLayoverHours);
  const maxLayoverMinutes = maxLayoverHours === null
    ? null
    : maxLayoverHours <= 8 ? 480 : 1440;

  return {
    origin: String(input.originIata).toUpperCase(),
    destination: String(input.destinationIata).toUpperCase(),
    connectionPreference,
    maxLayoverMinutes,
    excludedLayoverCountryCodes: Array.isArray(input.excludeStopoverCountries) ? input.excludeStopoverCountries : [],
    excludedLayoverAirportCodes: [],
    tripType: input.returnDate ? 'round-trip' : 'one-way',
    searchMode: 'selected-dates',
    outbound: {
      mode: 'fixed',
      startDate: input.departureDate,
      flexibilityDays: 0
    },
    inbound: input.returnDate ? {
      mode: 'fixed',
      startDate: input.returnDate,
      flexibilityDays: 0
    } : undefined,
    adults: clampInt(input.adults, 1, 9, 1),
    teens: 0,
    children: clampInt(input.children, 0, 8, 0),
    infants: clampInt(input.infants, 0, 4, 0),
    currency: 'EUR'
  };
}

function normalizeRyanairItinerary(item, passengers) {
  if (!item || !item.outbound) return null;
  const outbound = normalizeRyanairLeg(item.outbound);
  const inbound = item.inbound ? normalizeRyanairLeg(item.inbound) : null;
  if (!outbound) return null;

  const segments = [...outbound.segments, ...(inbound?.segments || [])];
  const signature = segments.map(segment => routeTimePart(segment)).filter(Boolean).join('|');
  if (!signature) return null;

  return {
    signature,
    totalPrice: Number(item.totalPrice),
    currency: item.currency || 'EUR',
    selfTransfer: Boolean(item.outbound?.selfTransfer || item.inbound?.selfTransfer),
    outbound,
    inbound,
    bookingLinks: segments.map(segment => ({
      label: `${segment.from} → ${segment.to}`,
      flightNumber: segment.flightNumber,
      departureAt: segment.departureAt,
      url: ryanairBookingUrl(segment.from, segment.to, segment.departureAt, passengers)
    }))
  };
}

function normalizeRyanairLeg(leg) {
  if (!leg || !Array.isArray(leg.segments)) return null;
  return {
    selfTransfer: Boolean(leg.selfTransfer),
    stops: Number(leg.stops || 0),
    segments: leg.segments.map(segment => ({
      flightNumber: String(segment.flightNumber || '').trim(),
      from: segment.origin?.iataCode || '',
      to: segment.destination?.iataCode || '',
      departureAt: segment.departureAt || '',
      arrivalAt: segment.arrivalAt || '',
      price: Number(segment.price)
    }))
  };
}

function ryanairBookingUrl(origin, destination, departureAt, passengers = {}) {
  const dateOut = String(departureAt || '').slice(0, 10);
  const adults = String(passengers.adults ?? 1);
  const teens = String(passengers.teens ?? 0);
  const children = String(passengers.children ?? 0);
  const infants = String(passengers.infants ?? 0);
  const params = new URLSearchParams({
    adults,
    teens,
    children,
    infants,
    dateOut,
    dateIn: '',
    isConnectedFlight: 'false',
    discount: '0',
    promoCode: '',
    originIata: origin,
    destinationIata: destination,
    tpAdults: adults,
    tpTeens: teens,
    tpChildren: children,
    tpInfants: infants,
    tpStartDate: dateOut,
    tpEndDate: '',
    tpDiscount: '0',
    tpPromoCode: '',
    tpOriginIata: origin,
    tpDestinationIata: destination
  });
  return `https://www.ryanair.com/it/it/trip/flights/select?${params.toString()}`;
}

function routeTimePart(segment) {
  const from = String(segment?.from || '').trim().toUpperCase();
  const to = String(segment?.to || '').trim().toUpperCase();
  const departure = wallClockMinute(segment?.departureAt);
  return from && to && departure ? `${from}-${to}@${departure}` : '';
}

function wallClockMinute(value) {
  const text = String(value || '').trim();
  const match = text.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  return match ? `${match[1]}T${match[2]}` : text.slice(0, 16);
}

function validateRyanairCompare(input) {
  if (!input || typeof input !== 'object') throw new Error('Richiesta Ryanair non valida.');
  if (!/^[A-Z]{3}$/i.test(String(input.originIata || '')) || !/^[A-Z]{3}$/i.test(String(input.destinationIata || ''))) {
    throw new Error('Per il confronto Ryanair servono codici IATA validi.');
  }
  if (!isIsoDate(input.departureDate)) throw new Error('Data di partenza Ryanair non valida.');
  if (input.returnDate && !isIsoDate(input.returnDate)) throw new Error('Data di ritorno Ryanair non valida.');
  if (input.returnDate && input.returnDate < input.departureDate) throw new Error('Il ritorno Ryanair non può precedere la partenza.');
}


function removeHiddenCityItineraries(result) {
  if (!result || typeof result !== 'object' || !Array.isArray(result.itineraries)) return result;

  const clean = result.itineraries.filter(item => !isHiddenCityItinerary(item));
  if (clean.length === result.itineraries.length) return result;

  return {
    ...result,
    itineraries: clean,
    hiddenCityExcluded: result.itineraries.length - clean.length
  };
}

function isHiddenCityItinerary(item) {
  if (!item || typeof item !== 'object') return false;

  const explicitKeys = new Set([
    'hiddencity', 'hidden_city', 'hidden-city', 'ishiddencity', 'is_hidden_city',
    'hiddenCity', 'hiddenCityTicket', 'hidden_city_ticket', 'throwawayticketing'
  ]);

  const visit = (value, depth = 0) => {
    if (depth > 8 || value === null || value === undefined) return false;

    if (typeof value === 'string') {
      const text = value.toLowerCase();
      return text.includes('hidden city') ||
        text.includes('hidden-city') ||
        text.includes('città nascosta') ||
        text.includes('citta nascosta') ||
        text.includes('throwaway ticket');
    }

    if (Array.isArray(value)) return value.some(entry => visit(entry, depth + 1));

    if (typeof value === 'object') {
      return Object.entries(value).some(([key, entry]) => {
        const normalizedKey = String(key).replace(/\s+/g, '').toLowerCase();
        const directFlag =
          explicitKeys.has(key) ||
          explicitKeys.has(normalizedKey) ||
          normalizedKey.includes('hiddencity') ||
          normalizedKey.includes('hidden_city');

        if (directFlag && (entry === true || entry === 1 || String(entry).toLowerCase() === 'true')) return true;
        return visit(entry, depth + 1);
      });
    }

    return false;
  };

  return visit(item);
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
