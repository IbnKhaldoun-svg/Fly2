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

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (url.pathname === '/health' && request.method === 'GET') {
      return json({
        ok: true,
        service: 'Fly2 API',
        provider: 'Kiwi.com MCP',
        upstream: KIWI_MCP_URL,
        mode: 'test'
      }, 200, cors);
    }

    if (url.pathname === '/tools' && request.method === 'GET') {
      try {
        const client = await createMcpClient();
        const tools = await client.listTools();
        return json({ ok: true, tools }, 200, cors);
      } catch (error) {
        return json({ ok: false, error: safeError(error) }, 502, cors);
      }
    }

    if (url.pathname === '/search' && request.method === 'POST') {
      try {
        enforceAllowedOrigin(request);
        const input = await request.json();
        validateSearch(input);

        const client = await createMcpClient();
        const tools = await client.listTools();
        const tool = tools.find(t => t.name === 'search-flight') || tools.find(t => /search.*flight|flight.*search/i.test(t.name));
        if (!tool) throw new Error('Il server Kiwi non espone uno strumento di ricerca voli compatibile.');

        const args = buildSearchArguments(tool.inputSchema || {}, input);
        const rawResult = await client.callTool(tool.name, args);
        const result = normalizeToolResult(rawResult);

        return json({
          ok: true,
          provider: 'Kiwi.com MCP',
          tool: tool.name,
          request: {
            origin: input.origin,
            destination: input.destination,
            departureDate: input.departureDate,
            returnDate: input.returnDate || null,
            passengers: normalizePassengers(input.passengers)
          },
          result
        }, 200, cors);
      } catch (error) {
        return json({ ok: false, error: safeError(error) }, 400, cors);
      }
    }

    return json({
      ok: false,
      error: 'Endpoint non trovato.',
      endpoints: ['GET /health', 'GET /tools', 'POST /search']
    }, 404, cors);
  }
};

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
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    throw new Error('Origine non autorizzata.');
  }
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders }
  });
}

function validateSearch(input) {
  if (!input || typeof input !== 'object') throw new Error('Richiesta non valida.');
  if (!input.origin || !input.destination) throw new Error('Partenza e destinazione sono obbligatorie.');
  if (!isIsoDate(input.departureDate)) throw new Error('La data di andata deve essere YYYY-MM-DD.');
  if (input.returnDate && !isIsoDate(input.returnDate)) throw new Error('La data di ritorno deve essere YYYY-MM-DD.');
  if (input.returnDate && input.returnDate < input.departureDate) throw new Error('Il ritorno non può precedere l’andata.');
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function normalizePassengers(value = {}) {
  return {
    adults: clampInt(value.adults, 1, 9, 1),
    children: clampInt(value.children, 0, 9, 0),
    infants: clampInt(value.infants, 0, 9, 0)
  };
}

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function buildSearchArguments(inputSchema, input) {
  const properties = inputSchema.properties || {};
  const passengers = normalizePassengers(input.passengers);
  const args = {};

  const setFirst = (names, value) => {
    const key = names.find(name => Object.prototype.hasOwnProperty.call(properties, name));
    if (key && value !== undefined && value !== null && value !== '') args[key] = value;
  };

  setFirst(['flyFrom', 'origin', 'from'], input.origin);
  setFirst(['flyTo', 'destination', 'to'], input.destination);
  setFirst(['departureDate', 'dateFrom', 'departure'], toDmy(input.departureDate));
  if (input.returnDate) setFirst(['returnDate', 'dateTo', 'return'], toDmy(input.returnDate));
  setFirst(['cabinClass', 'cabin_class', 'travelClass'], 'M');
  setFirst(['curr', 'currency', 'currencyCode'], 'EUR');
  setFirst(['sort', 'orderBy'], 'price');

  const passengerKey = ['passengers', 'travellers', 'travelers'].find(name => Object.prototype.hasOwnProperty.call(properties, name));
  if (passengerKey) {
    const schema = properties[passengerKey] || {};
    if (schema.type === 'number' || schema.type === 'integer') {
      args[passengerKey] = passengers.adults + passengers.children + passengers.infants;
    } else if (schema.type === 'string') {
      args[passengerKey] = `${passengers.adults} adulti, ${passengers.children} bambini, ${passengers.infants} neonati`;
    } else {
      args[passengerKey] = buildPassengerObject(schema, passengers);
    }
  } else {
    setFirst(['adults'], passengers.adults);
    setFirst(['children'], passengers.children);
    setFirst(['infants'], passengers.infants);
  }

  // Fallback per la versione pubblicamente documentata del tool Kiwi.
  if (!Object.keys(args).length || !hasRoute(args)) {
    return {
      flyFrom: input.origin,
      flyTo: input.destination,
      departureDate: toDmy(input.departureDate),
      ...(input.returnDate ? { returnDate: toDmy(input.returnDate) } : {}),
      cabinClass: 'M',
      curr: 'EUR',
      sort: 'price',
      passengers
    };
  }

  return args;
}

function buildPassengerObject(schema, passengers) {
  const props = schema.properties || {};
  if (!Object.keys(props).length) return passengers;
  const out = {};
  for (const [key, value] of Object.entries(passengers)) {
    if (Object.prototype.hasOwnProperty.call(props, key)) out[key] = value;
  }
  return Object.keys(out).length ? out : passengers;
}

function hasRoute(args) {
  const keys = Object.keys(args).map(k => k.toLowerCase());
  const hasFrom = keys.some(k => k === 'flyfrom' || k === 'origin' || k === 'from');
  const hasTo = keys.some(k => k === 'flyto' || k === 'destination' || k === 'to');
  return hasFrom && hasTo;
}

function toDmy(iso) {
  const [y, m, d] = String(iso).split('-');
  return `${d}/${m}/${y}`;
}

async function createMcpClient() {
  let sessionId = null;
  let protocolVersion = '2025-03-26';
  let rpcId = 1;

  const post = async (body, isNotification = false) => {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'MCP-Protocol-Version': protocolVersion
    };
    if (sessionId) headers['Mcp-Session-Id'] = sessionId;

    const response = await fetch(KIWI_MCP_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    const newSession = response.headers.get('Mcp-Session-Id');
    if (newSession) sessionId = newSession;

    if (isNotification && (response.status === 202 || response.status === 204)) return null;
    const payload = await parseMcpResponse(response);
    if (!response.ok) throw new Error(`Kiwi MCP HTTP ${response.status}: ${extractMessage(payload)}`);
    if (payload?.error) throw new Error(`Kiwi MCP: ${payload.error.message || 'errore JSON-RPC'}`);
    return payload;
  };

  const init = await post({
    jsonrpc: '2.0',
    id: rpcId++,
    method: 'initialize',
    params: {
      protocolVersion,
      capabilities: {},
      clientInfo: { name: 'Fly2', version: '0.1.0' }
    }
  });

  if (init?.result?.protocolVersion) protocolVersion = init.result.protocolVersion;

  await post({
    jsonrpc: '2.0',
    method: 'notifications/initialized',
    params: {}
  }, true);

  return {
    async listTools() {
      const response = await post({ jsonrpc: '2.0', id: rpcId++, method: 'tools/list', params: {} });
      return response?.result?.tools || [];
    },
    async callTool(name, args) {
      const response = await post({
        jsonrpc: '2.0',
        id: rpcId++,
        method: 'tools/call',
        params: { name, arguments: args }
      });
      return response?.result || response;
    }
  };
}

async function parseMcpResponse(response) {
  const text = await response.text();
  if (!text.trim()) return null;

  const contentType = response.headers.get('Content-Type') || '';
  if (contentType.includes('application/json')) return JSON.parse(text);

  // Streamable HTTP può rispondere tramite SSE.
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
    if (texts.length === 1) {
      try { return JSON.parse(texts[0]); } catch { return texts[0]; }
    }
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

function safeError(error) {
  return error instanceof Error ? error.message : String(error);
}
