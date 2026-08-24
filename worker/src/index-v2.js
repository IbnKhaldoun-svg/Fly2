const KIWI_MCP_URL = 'https://mcp.kiwi.com';
const RYANAIR_FINDER_URL = 'https://ryanair-flight-finder-v2.vercel.app/api/search';
const RYANAIR_AIRPORTS_URL = 'https://ryanair-flight-finder-v2.vercel.app/api/airports';
const OURAIRPORTS_COUNTRY_BASE = 'https://ourairports.com/countries';
const WFP_AIRPORTS_QUERY = 'https://gis.wfp.org/arcgis/rest/services/GLOBAL/GlobalAirports/FeatureServer/0/query';
const DUFFEL_OFFER_REQUESTS_URL = 'https://api.duffel.com/air/offer_requests';
const ALLOWED_ORIGINS = new Set([
  'https://ibnkhaldoun-svg.github.io',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    if (url.pathname === '/health' && request.method === 'GET') {
      const duffelConfigured = Boolean(String(env?.DUFFEL_ACCESS_TOKEN || '').trim());
      return json({
        ok: true,
        service: 'Fly2 API',
        providers: [
          { id: 'kiwi', name: 'Kiwi.com', configured: true },
          { id: 'ryanair', name: 'Ryanair', configured: true },
          { id: 'duffel', name: 'Duffel', configured: duffelConfigured }
        ],
        upstream: KIWI_MCP_URL,
        mode: 'live-v4'
      }, 200, cors);
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

    if ((url.pathname === '/search' || url.pathname === '/country-pair-search') && request.method === 'POST') {
      try {
        enforceAllowedOrigin(request);
        const input = await request.json();
        validateSearch(input);
        return await searchFlights(input, cors);
      } catch (error) {
        return json({ ok: false, error: safeError(error) }, 400, cors);
      }
    }

    if (url.pathname === '/country-airports' && request.method === 'GET') {
      try {
        enforceAllowedOrigin(request);
        const countryCode = String(url.searchParams.get('country') || '').trim().toUpperCase();
        const countryName = String(url.searchParams.get('name') || '').trim();
        if (!/^[A-Z]{2}$/.test(countryCode)) {
          throw new Error('Codice Paese non valido.');
        }

        const data = await getCommercialCountryAirports(countryCode, countryName);
        return json({ ok: true, ...data }, 200, cors);
      } catch (error) {
        return json({ ok: false, error: safeError(error) }, 502, cors);
      }
    }

    if (url.pathname === '/airports' && request.method === 'GET') {
      try {
        enforceAllowedOrigin(request);
        const codes = (url.searchParams.get('codes') || '')
          .split(',')
          .map(code => code.trim().toUpperCase())
          .filter(code => /^[A-Z]{3}$/.test(code))
          .slice(0, 200);
        const query = String(url.searchParams.get('q') || '').trim();

        const upstream = new URL(RYANAIR_AIRPORTS_URL);
        if (codes.length) upstream.searchParams.set('codes', codes.join(','));
        else if (query.length >= 2) upstream.searchParams.set('q', query);
        else return json({ ok: true, airports: [], locations: [] }, 200, cors);

        const response = await fetch(upstream.toString(), {
          headers: { 'Accept': 'application/json' }
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data) {
          throw new Error(`Airport metadata HTTP ${response.status}`);
        }
        return json({
          ok: true,
          airports: Array.isArray(data.airports) ? data.airports : [],
          locations: Array.isArray(data.locations) ? data.locations : []
        }, 200, cors);
      } catch (error) {
        return json({ ok: false, error: safeError(error) }, 502, cors);
      }
    }

    if (url.pathname === '/ryanair-country' && request.method === 'POST') {
      try {
        enforceAllowedOrigin(request);
        const input = await request.json();
        validateRyanairCountry(input);
        return await searchRyanairCountry(input, cors);
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

    if (url.pathname === '/duffel-search' && request.method === 'POST') {
      try {
        enforceAllowedOrigin(request);
        const input = await request.json();
        validateDuffelSearch(input);
        return await searchDuffel(input, cors, env);
      } catch (error) {
        return json({ ok: false, error: safeError(error) }, 400, cors);
      }
    }

    return json({ ok: false, error: 'Endpoint non trovato.', endpoints: ['GET /health', 'GET /tools', 'GET /demo', 'GET /country-airports?country=MA&name=Marocco', 'GET /airports?codes=MAD,KRK', 'POST /search', 'POST /country-pair-search', 'POST /ryanair-country', 'POST /ryanair-compare', 'POST /duffel-search'] }, 404, cors);
  }
};

const ISO2_TO_ISO3 = {
  AL:'ALB', AT:'AUT', BE:'BEL', BG:'BGR', CY:'CYP', HR:'HRV', DK:'DNK',
  EG:'EGY', AE:'ARE', FI:'FIN', FR:'FRA', DE:'DEU', GR:'GRC', IE:'IRL',
  IS:'ISL', IT:'ITA', MA:'MAR', MT:'MLT', NO:'NOR', NL:'NLD', PL:'POL',
  PT:'PRT', QA:'QAT', GB:'GBR', CZ:'CZE', RO:'ROU', RS:'SRB', ES:'ESP',
  SE:'SWE', CH:'CHE', TN:'TUN', TR:'TUR', HU:'HUN'
};

async function getCommercialCountryAirports(countryCode, countryName = '') {
  const ryanairCodesPromise = fetchRyanairCountryAirportCodes(countryName || countryCode);

  // Primary source: the small country-specific OurAirports CSV.
  // Note: these country CSVs currently encode scheduled_service as 1/0,
  // while other OurAirports exports/documentation may use yes/no.
  let ourAirports = [];
  let ourAirportsError = null;
  try {
    ourAirports = await fetchOurAirportsCountryAirports(countryCode);
  } catch (error) {
    ourAirportsError = error;
  }

  const ryanairCodes = await ryanairCodesPromise;

  if (ourAirports.length) {
    const airports = ourAirports
      .map(item => ({
        ...item,
        ryanair: ryanairCodes.has(item.iataCode)
      }))
      .sort((a, b) => a.city.localeCompare(b.city, 'it') || a.iataCode.localeCompare(b.iataCode));

    return {
      countryCode,
      countryName: countryName || countryCode,
      source: 'OurAirports',
      airports
    };
  }

  // Fallback: WFP Global Airports, so a temporary OurAirports issue does not
  // break country searches completely.
  let wfpAirports = [];
  let wfpError = null;
  try {
    wfpAirports = await fetchWfpCountryAirports(countryCode, ryanairCodes);
  } catch (error) {
    wfpError = error;
  }

  if (wfpAirports.length) {
    return {
      countryCode,
      countryName: countryName || countryCode,
      source: 'WFP Global Airports (fallback)',
      airports: wfpAirports
    };
  }

  const details = [
    ourAirportsError ? `OurAirports: ${safeError(ourAirportsError)}` : 'OurAirports: 0 aeroporti compatibili',
    wfpError ? `WFP: ${safeError(wfpError)}` : 'WFP: 0 aeroporti compatibili'
  ].join(' · ');
  throw new Error(`Non ho trovato aeroporti commerciali con codice IATA per il Paese selezionato. ${details}`);
}

async function fetchOurAirportsCountryAirports(countryCode) {
  const csvUrl = `${OURAIRPORTS_COUNTRY_BASE}/${encodeURIComponent(countryCode)}/airports.csv`;
  const response = await fetch(csvUrl, { headers: { 'Accept': 'text/csv,*/*' } });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const csvText = await response.text();
  const rows = parseCsvObjects(csvText);

  return rows
    .map(row => {
      const iataCode = String(row.iata_code || '').trim().toUpperCase();
      const type = String(row.type || '').trim().toLowerCase();
      const name = String(row.name || '').trim();
      const city = String(row.municipality || '').trim();

      return {
        iataCode,
        name: name || `Aeroporto ${iataCode}`,
        city: city || name || iataCode,
        countryCode: String(row.iso_country || countryCode).trim().toUpperCase(),
        type,
        scheduledService: isScheduledService(row.scheduled_service),
        latitude: finiteOrNull(row.latitude_deg),
        longitude: finiteOrNull(row.longitude_deg)
      };
    })
    .filter(item =>
      /^[A-Z]{3}$/.test(item.iataCode) &&
      item.scheduledService &&
      !['closed', 'heliport', 'seaplane_base', 'balloonport'].includes(item.type)
    );
}

function isScheduledService(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === '1' || normalized === 'yes' || normalized === 'true' || normalized === 'y';
}

async function fetchWfpCountryAirports(countryCode, ryanairCodes) {
  const iso3 = ISO2_TO_ISO3[countryCode];
  if (!iso3) throw new Error('Paese non supportato dalla fonte WFP.');

  const queryUrl = new URL(WFP_AIRPORTS_QUERY);
  queryUrl.searchParams.set('where', `iso3='${iso3}' AND iata IS NOT NULL AND iata<>''`);
  queryUrl.searchParams.set('outFields', 'nameshort,namelong,city,iata,icao,apttype,aptclass,authority,status,iso3,country,latitude,longitude');
  queryUrl.searchParams.set('returnGeometry', 'false');
  queryUrl.searchParams.set('resultRecordCount', '2000');
  queryUrl.searchParams.set('f', 'json');

  const response = await fetch(queryUrl.toString(), { headers: { 'Accept': 'application/json' } });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data || !Array.isArray(data.features)) {
    throw new Error(`HTTP ${response.status}`);
  }

  const byIata = new Map();

  for (const feature of data.features) {
    const a = feature?.attributes || {};
    const iataCode = String(a.iata || '').trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(iataCode)) continue;

    const type = String(a.apttype || '').trim();
    if (!['Airport', 'Airfield', 'Airstrip'].includes(type)) continue;

    const city = String(a.city || '').trim();
    const name = String(a.namelong || a.nameshort || '').trim();

    byIata.set(iataCode, {
      iataCode,
      name: name || `Aeroporto ${iataCode}`,
      city: city || name || iataCode,
      countryCode,
      type: type || 'Airport',
      airportClass: String(a.aptclass || '').trim() || null,
      authority: String(a.authority || '').trim() || null,
      status: String(a.status || '').trim() || null,
      scheduledService: true,
      ryanair: ryanairCodes.has(iataCode),
      latitude: finiteOrNull(a.latitude),
      longitude: finiteOrNull(a.longitude)
    });
  }

  return [...byIata.values()]
    .sort((a, b) => a.city.localeCompare(b.city, 'it') || a.iataCode.localeCompare(b.iataCode));
}

function parseCsvObjects(text) {
  const rows = parseCsvRows(String(text || ''));
  if (!rows.length) return [];

  const headers = rows[0].map(value => String(value || '').replace(/^\uFEFF/, '').trim());
  return rows.slice(1)
    .filter(row => row.some(value => String(value || '').trim()))
    .map(row => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }

  return rows;
}

async function fetchRyanairCountryAirportCodes(query) {
  try {
    const url = new URL(RYANAIR_AIRPORTS_URL);
    url.searchParams.set('q', query);
    const response = await fetch(url.toString(), { headers: { 'Accept': 'application/json' } });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) return new Set();

    const locations = Array.isArray(data.locations) ? data.locations : [];
    const country = locations.find(item => item?.type === 'country');
    const codes = Array.isArray(country?.airportCodes) ? country.airportCodes : [];
    return new Set(codes.map(code => String(code || '').trim().toUpperCase()).filter(code => /^[A-Z]{3}$/.test(code)));
  } catch {
    return new Set();
  }
}

function finiteOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

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


async function searchDuffel(input, cors, env) {
  const token = String(env?.DUFFEL_ACCESS_TOKEN || '').trim();
  if (!token) {
    return json({
      ok: false,
      configured: false,
      provider: 'Duffel',
      error: 'Duffel non è ancora configurato su Fly2.'
    }, 503, cors);
  }

  const slices = [
    {
      origin: String(input.originIata || input.origin || '').trim().toUpperCase(),
      destination: String(input.destinationIata || input.destination || '').trim().toUpperCase(),
      departure_date: input.departureDate
    }
  ];

  if (input.returnDate) {
    slices.push({
      origin: slices[0].destination,
      destination: slices[0].origin,
      departure_date: input.returnDate
    });
  }

  const passengers = [];
  const adults = clampInt(input.adults, 1, 9, 1);
  const children = clampInt(input.children, 0, 8, 0);
  const infants = clampInt(input.infants, 0, adults, 0);
  for (let i = 0; i < adults; i += 1) passengers.push({ type: 'adult' });
  for (let i = 0; i < children; i += 1) passengers.push({ age: 8 });
  for (let i = 0; i < infants; i += 1) passengers.push({ age: 1 });

  const payload = {
    data: {
      slices,
      passengers,
      cabin_class: duffelCabinClass(input.cabinClass),
      max_connections: clampInt(input.maxStopovers, 0, 2, 1)
    }
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18_000);
  try {
    const response = await fetch(`${DUFFEL_OFFER_REQUESTS_URL}?return_offers=true&supplier_timeout=12000`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Accept-Encoding': 'gzip',
        'Duffel-Version': 'v2',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.data) {
      const message =
        data?.errors?.[0]?.message ||
        data?.errors?.[0]?.title ||
        data?.message ||
        `Duffel HTTP ${response.status}`;
      throw new Error(message);
    }

    const offers = Array.isArray(data.data.offers) ? data.data.offers : [];
    let itineraries = offers
      .map(normalizeDuffelOffer)
      .filter(Boolean)
      .filter(item => duffelMatchesPolicies(item, input));

    itineraries.sort((a, b) => Number(a.price) - Number(b.price));

    return json({
      ok: true,
      configured: true,
      provider: 'Duffel',
      liveMode: Boolean(data.data.live_mode),
      requestId: data.data.id || null,
      itineraries,
      meta: {
        count: itineraries.length,
        expiresAt: itineraries.reduce((latest, item) => latest || item.duffelExpiresAt || null, null)
      }
    }, 200, cors);
  } catch (error) {
    const message = error instanceof Error && error.name === 'AbortError'
      ? 'La ricerca Duffel ha impiegato troppo tempo.'
      : safeError(error);
    return json({ ok: false, configured: true, provider: 'Duffel', error: message }, 502, cors);
  } finally {
    clearTimeout(timeout);
  }
}

function validateDuffelSearch(input) {
  if (!input || typeof input !== 'object') throw new Error('Richiesta Duffel non valida.');
  const origin = String(input.originIata || input.origin || '').trim().toUpperCase();
  const destination = String(input.destinationIata || input.destination || '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(origin) || !/^[A-Z]{3}$/.test(destination)) {
    throw new Error('Duffel richiede aeroporti IATA precisi.');
  }
  if (!isIsoDate(input.departureDate)) throw new Error('Data di partenza Duffel non valida.');
  if (input.returnDate && !isIsoDate(input.returnDate)) throw new Error('Data di ritorno Duffel non valida.');
  if (input.departureDateTo || input.returnDateTo || Number(input.departureDateFlexDays || 0) || Number(input.returnDateFlexDays || 0)) {
    throw new Error('Per ora Duffel è attivo solo sulle date precise, per evitare ricerche multiple a pagamento.');
  }
}

function duffelCabinClass(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'business' || text === 'c') return 'business';
  if (text === 'premium_economy' || text === 'premium economy' || text === 'w') return 'premium_economy';
  if (text === 'first' || text === 'f') return 'first';
  return 'economy';
}

function normalizeDuffelOffer(offer) {
  if (!offer || !Array.isArray(offer.slices) || !offer.slices.length) return null;
  const price = Number(offer.total_amount);
  if (!Number.isFinite(price)) return null;

  const legs = offer.slices.map(normalizeDuffelSlice).filter(Boolean);
  if (!legs.length) return null;

  const outbound = legs[0];
  const inbound = legs[1] || null;
  const totalDurationSeconds = legs.reduce((sum, leg) => sum + Number(leg.durationSeconds || 0), 0);
  const currency = String(offer.total_currency || 'EUR').toUpperCase();
  const ownerName = String(offer.owner?.name || '').trim();

  return {
    source: 'Duffel',
    providerAirline: ownerName || null,
    price,
    priceFormatted: new Intl.NumberFormat('it-IT', { style: 'currency', currency }).format(price),
    totalDurationSeconds,
    baggage: {},
    bookingUrl: null,
    duffelOfferId: offer.id || null,
    duffelExpiresAt: offer.expires_at || null,
    outbound,
    inbound
  };
}

function normalizeDuffelSlice(slice) {
  const rawSegments = Array.isArray(slice?.segments) ? slice.segments : [];
  if (!rawSegments.length) return null;
  const segments = rawSegments.map(normalizeDuffelSegment).filter(Boolean);
  if (!segments.length) return null;

  const departureTime = segments[0].departureTime;
  const arrivalTime = segments[segments.length - 1].arrivalTime;
  const durationSeconds = secondsBetween(departureTime, arrivalTime);

  return {
    route: [segments[0].from, ...segments.map(segment => segment.to)],
    stops: Math.max(0, segments.length - 1),
    durationSeconds,
    departureTime,
    arrivalTime,
    segments
  };
}

function normalizeDuffelSegment(segment) {
  const from = String(segment?.origin?.iata_code || '').trim().toUpperCase();
  const to = String(segment?.destination?.iata_code || '').trim().toUpperCase();
  const departureTime = String(segment?.departing_at || '').trim();
  const arrivalTime = String(segment?.arriving_at || '').trim();
  if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to) || !departureTime || !arrivalTime) return null;

  const operating = segment?.operating_carrier || {};
  const marketing = segment?.marketing_carrier || {};
  const carrier = String(operating?.iata_code || marketing?.iata_code || '').trim().toUpperCase();
  const carrierName = String(operating?.name || marketing?.name || carrier || 'Compagnia').trim();
  const marketingCode = String(marketing?.iata_code || carrier || '').trim().toUpperCase();
  const number = String(segment?.marketing_carrier_flight_number || '').trim();
  const flightNumber = number
    ? `${marketingCode}${number}`
    : String(segment?.id || '').trim();

  return {
    carrier,
    carrierName,
    flightNumber,
    from,
    to,
    fromCity: String(segment?.origin?.city_name || segment?.origin?.name || from).trim(),
    toCity: String(segment?.destination?.city_name || segment?.destination?.name || to).trim(),
    fromCountry: normalizeCountryCodeForPolicy(segment?.origin?.iata_country_code || segment?.origin?.country_code),
    toCountry: normalizeCountryCodeForPolicy(segment?.destination?.iata_country_code || segment?.destination?.country_code),
    fromName: String(segment?.origin?.name || '').trim(),
    toName: String(segment?.destination?.name || '').trim(),
    departureTime,
    arrivalTime,
    durationSeconds: secondsBetween(departureTime, arrivalTime)
  };
}

function secondsBetween(from, to) {
  const start = new Date(String(from || '')).getTime();
  const end = new Date(String(to || '')).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return Math.round((end - start) / 1000);
}

function duffelMatchesPolicies(item, input) {
  const excludedAirlines = new Set(
    (Array.isArray(input.excludeAirlines) ? input.excludeAirlines : [])
      .map(code => String(code || '').trim().toUpperCase())
      .filter(Boolean)
  );
  const excludedCountries = new Set(
    (Array.isArray(input.excludeStopoverCountries) ? input.excludeStopoverCountries : [])
      .map(normalizeCountryCodeForPolicy)
      .filter(Boolean)
  );

  const allSegments = [
    ...(item?.outbound?.segments || []),
    ...(item?.inbound?.segments || [])
  ];
  if (excludedAirlines.size && allSegments.some(segment => excludedAirlines.has(String(segment?.carrier || '').trim().toUpperCase()))) {
    return false;
  }

  if (excludedCountries.size) {
    for (const leg of [item?.outbound, item?.inbound]) {
      const segments = Array.isArray(leg?.segments) ? leg.segments : [];
      if (segments.slice(0, -1).some(segment => excludedCountries.has(normalizeCountryCodeForPolicy(segment?.toCountry)))) {
        return false;
      }
    }
  }

  return true;
}


async function searchRyanairCountry(input, cors) {
  const query = String(input.destinationCountryName || input.destinationCountryCode || '').trim();
  const airportUrl = new URL(RYANAIR_AIRPORTS_URL);
  airportUrl.searchParams.set('q', query);

  const airportResponse = await fetch(airportUrl.toString(), {
    headers: { 'Accept': 'application/json' }
  });
  const airportData = await airportResponse.json().catch(() => null);
  if (!airportResponse.ok || !airportData) {
    throw new Error(`Elenco aeroporti Ryanair non disponibile (HTTP ${airportResponse.status}).`);
  }

  const requestedCountryCode = String(input.destinationCountryCode || '').trim().toUpperCase();
  const requestedCountryName = String(input.destinationCountryName || '').trim().toLowerCase();
  const locations = Array.isArray(airportData.locations) ? airportData.locations : [];
  const country = locations.find(item => {
    if (item?.type !== 'country') return false;
    if (requestedCountryCode && String(item.countryCode || '').toUpperCase() === requestedCountryCode) return true;
    return requestedCountryName && String(item.countryName || '').trim().toLowerCase() === requestedCountryName;
  });

  if (!country || !Array.isArray(country.airportCodes) || !country.airportCodes.length) {
    throw new Error('Non ho trovato gli aeroporti Ryanair del Paese selezionato.');
  }

  const origin = String(input.originIata || '').trim().toUpperCase();
  const airportCodes = [...new Set(country.airportCodes)]
    .map(code => String(code).toUpperCase())
    .filter(code => /^[A-Z]{3}$/.test(code) && code !== origin)
    .slice(0, 80);

  let cursor = 0;
  let completed = 0;
  let failed = 0;
  const itineraries = [];

  const worker = async () => {
    while (cursor < airportCodes.length) {
      const index = cursor++;
      const destinationIata = airportCodes[index];
      try {
        const payload = buildRyanairFinderPayload({ ...input, destinationIata });
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 50_000);
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
          if (!response.ok) throw new Error(data?.error?.message || `HTTP ${response.status}`);

          const normalized = Array.isArray(data?.itineraries)
            ? data.itineraries.map(item => normalizeRyanairItinerary(item, payload)).filter(Boolean)
            : [];
          itineraries.push(...normalized);
        } finally {
          clearTimeout(timeout);
        }
      } catch {
        failed += 1;
      } finally {
        completed += 1;
      }
    }
  };

  const workerCount = Math.min(2, Math.max(1, airportCodes.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  const unique = new Map();
  for (const item of itineraries) {
    const key = item.signature || JSON.stringify(item);
    const existing = unique.get(key);
    if (!existing || Number(item.totalPrice) < Number(existing.totalPrice)) unique.set(key, item);
  }

  let sorted = [...unique.values()];
  sorted = await enforceExcludedStopoverCountries(sorted, input.excludeStopoverCountries);
  sorted.sort((a, b) => Number(a.totalPrice) - Number(b.totalPrice));

  return json({
    ok: true,
    provider: 'Ryanair direct country search',
    source: 'ryanair-flight-finder-v2',
    country: {
      code: country.countryCode || requestedCountryCode,
      name: country.countryName || input.destinationCountryName,
      airportCount: airportCodes.length
    },
    checkedAirports: completed,
    failedAirports: failed,
    partialResults: failed > 0,
    itineraries: sorted
  }, 200, cors);
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

    let itineraries = Array.isArray(data?.itineraries) ? data.itineraries.map(item => normalizeRyanairItinerary(item, payload)).filter(Boolean) : [];
    itineraries = await enforceExcludedStopoverCountries(itineraries, input.excludeStopoverCountries);
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

async function enforceExcludedStopoverCountries(itineraries, excludedCountries) {
  const excluded = new Set(
    (Array.isArray(excludedCountries) ? excludedCountries : [])
      .map(normalizeCountryCodeForPolicy)
      .filter(Boolean)
  );
  if (!excluded.size || !Array.isArray(itineraries) || !itineraries.length) return itineraries;

  const stopCodes = new Set();
  for (const item of itineraries) {
    collectIntermediateAirportCodes(item?.outbound, stopCodes);
    collectIntermediateAirportCodes(item?.inbound, stopCodes);
  }

  const airportCountries = await fetchAirportCountryCodes([...stopCodes]);

  return itineraries.filter(item =>
    !legUsesExcludedCountry(item?.outbound, excluded, airportCountries) &&
    !legUsesExcludedCountry(item?.inbound, excluded, airportCountries)
  );
}

function normalizeCountryCodeForPolicy(value) {
  const code = String(value || '').trim().toUpperCase();
  if (code === 'UK') return 'GB';
  return /^[A-Z]{2}$/.test(code) ? code : '';
}

function collectIntermediateAirportCodes(leg, output) {
  const segments = Array.isArray(leg?.segments) ? leg.segments : [];
  for (const segment of segments.slice(0, -1)) {
    const code = String(segment?.to || '').trim().toUpperCase();
    if (/^[A-Z]{3}$/.test(code)) output.add(code);
  }
}

function legUsesExcludedCountry(leg, excluded, airportCountries) {
  const segments = Array.isArray(leg?.segments) ? leg.segments : [];
  if (segments.length <= 1) return false;

  return segments.slice(0, -1).some(segment => {
    const directCountry = normalizeCountryCodeForPolicy(segment?.toCountry);
    if (directCountry && excluded.has(directCountry)) return true;

    const code = String(segment?.to || '').trim().toUpperCase();
    const resolvedCountry = airportCountries.get(code) || '';
    return resolvedCountry && excluded.has(resolvedCountry);
  });
}

async function fetchAirportCountryCodes(codes) {
  const normalizedCodes = [...new Set(
    (Array.isArray(codes) ? codes : [])
      .map(code => String(code || '').trim().toUpperCase())
      .filter(code => /^[A-Z]{3}$/.test(code))
  )].slice(0, 200);

  const result = new Map();
  if (!normalizedCodes.length) return result;

  try {
    const url = new URL(RYANAIR_AIRPORTS_URL);
    url.searchParams.set('codes', normalizedCodes.join(','));

    const response = await fetch(url.toString(), { headers: { 'Accept': 'application/json' } });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data || !Array.isArray(data.airports)) return result;

    for (const airport of data.airports) {
      const code = String(airport?.iataCode || '').trim().toUpperCase();
      const country = normalizeCountryCodeForPolicy(airport?.countryCode);
      if (/^[A-Z]{3}$/.test(code) && country) result.set(code, country);
    }
  } catch {
    // The segment-level country code still provides a best-effort hard filter.
  }

  return result;
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

  const common = {
    origin: String(input.originIata).toUpperCase(),
    destination: String(input.destinationIata).toUpperCase(),
    connectionPreference,
    maxLayoverMinutes,
    excludedLayoverCountryCodes: Array.isArray(input.excludeStopoverCountries) ? input.excludeStopoverCountries : [],
    excludedLayoverAirportCodes: [],
    adults: clampInt(input.adults, 1, 9, 1),
    teens: 0,
    children: clampInt(input.children, 0, 8, 0),
    infants: clampInt(input.infants, 0, 4, 0),
    currency: 'EUR'
  };

  if (input.searchMode === 'cheapest') {
    const horizon = [3, 6, 12].includes(Number(input.searchHorizonMonths))
      ? Number(input.searchHorizonMonths)
      : 3;
    return {
      ...common,
      tripType: 'round-trip',
      searchMode: 'cheapest-stay',
      searchHorizonMonths: horizon,
      stayNights: clampInt(input.stayNights, 1, 15, 3),
      outbound: {
        mode: 'fixed',
        startDate: input.departureDate,
        flexibilityDays: 0
      },
      inbound: {
        mode: 'fixed',
        startDate: addIsoDays(input.departureDate, 1),
        flexibilityDays: 0
      }
    };
  }

  const outboundMode = input.departureDateTo
    ? 'range'
    : Number(input.departureDateFlexDays || 0) > 0
      ? 'flexible'
      : 'fixed';
  const inboundMode = input.returnDateTo
    ? 'range'
    : Number(input.returnDateFlexDays || 0) > 0
      ? 'flexible'
      : 'fixed';

  return {
    ...common,
    tripType: input.returnDate ? 'round-trip' : 'one-way',
    searchMode: 'selected-dates',
    outbound: {
      mode: outboundMode,
      startDate: input.departureDate,
      endDate: input.departureDateTo || undefined,
      flexibilityDays: outboundMode === 'flexible'
        ? clampInt(input.departureDateFlexDays, 0, 14, 0)
        : 0
    },
    inbound: input.returnDate ? {
      mode: inboundMode,
      startDate: input.returnDate,
      endDate: input.returnDateTo || undefined,
      flexibilityDays: inboundMode === 'flexible'
        ? clampInt(input.returnDateFlexDays, 0, 14, 0)
        : 0
    } : undefined
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

  const totalPrice = Number(item.totalPrice);
  const totalDurationSeconds = Number(item.totalDurationMinutes || 0) * 60;

  return {
    signature,
    totalPrice,
    currency: item.currency || 'EUR',
    totalDurationSeconds,
    totalStops: Number(item.totalStops || 0),
    nights: item.nights == null ? null : Number(item.nights),
    selfTransfer: Boolean(item.outbound?.selfTransfer || item.inbound?.selfTransfer),
    outbound,
    inbound,
    fly2Itinerary: {
      source: 'Ryanair',
      price: totalPrice,
      priceFormatted: new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(totalPrice),
      totalDurationSeconds,
      baggage: {},
      bookingUrl: null,
      outbound: toFly2Leg(outbound),
      inbound: inbound ? toFly2Leg(inbound) : null
    },
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
  const segments = leg.segments.map(segment => ({
    flightNumber: String(segment.flightNumber || '').trim(),
    from: segment.origin?.iataCode || '',
    to: segment.destination?.iataCode || '',
    fromCity: segment.origin?.city || segment.origin?.iataCode || '',
    toCity: segment.destination?.city || segment.destination?.iataCode || '',
    fromCountry: segment.origin?.countryCode || '',
    toCountry: segment.destination?.countryCode || '',
    fromName: segment.origin?.name || '',
    toName: segment.destination?.name || '',
    departureAt: segment.departureAt || '',
    arrivalAt: segment.arrivalAt || '',
    durationSeconds: Number(segment.durationMinutes || 0) * 60,
    price: Number(segment.price),
    carrier: 'FR',
    carrierName: 'Ryanair'
  }));

  return {
    selfTransfer: Boolean(leg.selfTransfer),
    stops: Number(leg.stops || 0),
    departureAt: leg.departureAt || segments[0]?.departureAt || '',
    arrivalAt: leg.arrivalAt || segments[segments.length - 1]?.arrivalAt || '',
    durationSeconds: Number(leg.durationMinutes || 0) * 60,
    segments
  };
}

function toFly2Leg(leg) {
  return {
    route: leg.segments.length
      ? [leg.segments[0].from, ...leg.segments.map(segment => segment.to)]
      : [],
    stops: leg.stops,
    durationSeconds: leg.durationSeconds,
    departureTime: leg.departureAt,
    arrivalTime: leg.arrivalAt,
    segments: leg.segments.map(segment => ({
      carrier: 'FR',
      carrierName: 'Ryanair',
      flightNumber: segment.flightNumber,
      from: segment.from,
      to: segment.to,
      fromCity: segment.fromCity,
      toCity: segment.toCity,
      fromCountry: segment.fromCountry,
      toCountry: segment.toCountry,
      fromName: segment.fromName,
      toName: segment.toName,
      departureTime: segment.departureAt,
      arrivalTime: segment.arrivalAt,
      durationSeconds: segment.durationSeconds
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

function validateRyanairCountry(input) {
  if (!input || typeof input !== 'object') throw new Error('Ricerca Paese Ryanair non valida.');
  if (!/^[A-Z]{3}$/i.test(String(input.originIata || ''))) {
    throw new Error('Per la ricerca Paese serve un aeroporto di partenza preciso.');
  }
  if (!String(input.destinationCountryName || input.destinationCountryCode || '').trim()) {
    throw new Error('Paese di destinazione non valido.');
  }
  if (!isIsoDate(input.departureDate)) throw new Error('Data di partenza non valida.');
  if (input.returnDate && !isIsoDate(input.returnDate)) throw new Error('Data di ritorno non valida.');
}

function validateRyanairCompare(input) {
  if (!input || typeof input !== 'object') throw new Error('Richiesta Ryanair non valida.');
  if (!/^[A-Z]{3}$/i.test(String(input.originIata || '')) || !/^[A-Z]{3}$/i.test(String(input.destinationIata || ''))) {
    throw new Error('Per il confronto Ryanair servono codici IATA validi.');
  }
  if (!isIsoDate(input.departureDate)) throw new Error('Data di partenza Ryanair non valida.');

  if (input.searchMode === 'cheapest') {
    if (!Number.isFinite(Number(input.stayNights))) throw new Error('Numero di notti Ryanair non valido.');
    return;
  }

  if (input.returnDate && !isIsoDate(input.returnDate)) throw new Error('Data di ritorno Ryanair non valida.');
  if (input.returnDate && input.returnDate < input.departureDate) throw new Error('Il ritorno Ryanair non può precedere la partenza.');
}

function addIsoDays(value, days) {
  const date = new Date(String(value) + 'T12:00:00Z');
  if (Number.isNaN(date.getTime())) return value;
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
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
