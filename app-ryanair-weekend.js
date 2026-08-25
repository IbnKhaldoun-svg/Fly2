(() => {
  if (window.__fly2RyanairWeekendInstalled) return;
  window.__fly2RyanairWeekendInstalled = true;

  const SEARCH_API = 'https://fly2-api.fly2-search.workers.dev/search';
  const COUNTRY_PAIR_API = 'https://fly2-api.fly2-search.workers.dev/country-pair-search';
  const COUNTRY_AIRPORTS_API = 'https://fly2-api.fly2-search.workers.dev/country-airports';
  const RYANAIR_API = 'https://ryanair-flight-finder-v2.vercel.app/api/fly2-anywhere';
  const originalFetch = window.fetch.bind(window);

  let countryAirportCacheReady = false;
  let countryRyanairAirports = new Set();

  window.fetch = async function(resource, init = {}) {
    const url = typeof resource === 'string' ? resource : resource?.url;
    const method = String(init?.method || 'GET').toUpperCase();

    if (method === 'GET' && url && String(url).startsWith(COUNTRY_AIRPORTS_API)) {
      const response = await originalFetch(resource, init);
      response.clone().json().then(data => {
        if (!data?.ok || !Array.isArray(data.airports)) return;
        countryRyanairAirports = new Set(
          data.airports
            .filter(airport => airport?.ryanair)
            .map(airport => String(airport?.iataCode || '').trim().toUpperCase())
            .filter(code => /^[A-Z]{3}$/.test(code))
        );
        countryAirportCacheReady = true;
      }).catch(() => {});
      return response;
    }

    const isSearch = method === 'POST' && url && (
      String(url).startsWith(SEARCH_API) || String(url).startsWith(COUNTRY_PAIR_API)
    );
    if (!isSearch || typeof init?.body !== 'string') return originalFetch(resource, init);

    let request = null;
    try { request = JSON.parse(init.body); } catch {}
    if (!shouldSupplement(request, String(url))) return originalFetch(resource, init);

    const kiwiPromise = originalFetch(resource, init);
    const ryanairPromise = fetchRyanairWeekend(request).catch(() => []);
    const [kiwiResponse, ryanairItems] = await Promise.all([kiwiPromise, ryanairPromise]);

    if (!ryanairItems.length) return kiwiResponse;

    const data = await kiwiResponse.clone().json().catch(() => null);
    if (kiwiResponse.ok && data?.ok && data?.result && Array.isArray(data.result.itineraries)) {
      data.result.itineraries = mergeItems([...data.result.itineraries, ...ryanairItems]);
      return jsonResponseLike(kiwiResponse, data, kiwiResponse.status);
    }

    return jsonResponseLike(kiwiResponse, {
      ok: true,
      result: {
        query: `${request.originIata || request.origin} → ${request.destinationIata || request.destination}`,
        itineraries: mergeItems(ryanairItems)
      }
    }, 200);
  };

  function shouldSupplement(request, url) {
    if (!request || !isWeekend(request)) return false;
    if (Array.isArray(request.excludeAirlines) && request.excludeAirlines.includes('FR')) return false;
    if (String(request.destination || '').trim().toLowerCase() === 'anywhere') return false;

    const origin = String(request.originIata || request.origin || '').trim().toUpperCase();
    const destination = String(request.destinationIata || request.destination || '').trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(origin) || !/^[A-Z]{3}$/.test(destination)) return false;

    if (url.startsWith(COUNTRY_PAIR_API) && countryAirportCacheReady && !countryRyanairAirports.has(destination)) {
      return false;
    }
    return true;
  }

  function isWeekend(request) {
    return (Array.isArray(request?.flyDays) && request.flyDays.length > 0) ||
      (Array.isArray(request?.returnFlyDays) && request.returnFlyDays.length > 0);
  }

  async function fetchRyanairWeekend(request) {
    const origin = String(request.originIata || request.origin || '').trim().toUpperCase();
    const destination = String(request.destinationIata || request.destination || '').trim().toUpperCase();
    const start = String(request.departureDate || '').slice(0, 10);
    const maxStops = Number(request.maxStopovers ?? 1);
    const maxLayoverHours = request.maxLayoverHours == null ? null : Number(request.maxLayoverHours);

    const body = {
      origin,
      destination,
      connectionPreference: maxStops <= 0 ? 'direct' : maxStops === 1 ? 'one-stop' : 'any',
      maxLayoverMinutes: maxLayoverHours == null ? null : (maxLayoverHours <= 8 ? 480 : 1440),
      excludedLayoverCountryCodes: Array.isArray(request.excludeStopoverCountries) ? request.excludeStopoverCountries : [],
      excludedLayoverAirportCodes: [],
      tripType: 'round-trip',
      searchMode: 'weekend',
      searchHorizonMonths: 3,
      weekendOutboundDay: weekdayPreference(request.flyDays, 5, 6, 'friday', 'saturday'),
      weekendInboundDay: weekdayPreference(request.returnFlyDays, 0, 1, 'sunday', 'monday'),
      outbound: { mode: 'any', startDate: start, flexibilityDays: 0 },
      inbound: { mode: 'any', startDate: addIsoDays(start, 1), flexibilityDays: 0 },
      adults: Number(request.adults || 1),
      teens: 0,
      children: Number(request.children || 0),
      infants: Number(request.infants || 0),
      currency: 'EUR'
    };

    const outTime = toClock(request.departureHourFrom);
    const inTime = toClock(request.returnHourFrom);
    if (outTime) body.weekendOutboundMinTime = outTime;
    if (inTime) body.weekendInboundMinTime = inTime;

    const response = await originalFetch(RYANAIR_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !Array.isArray(data?.itineraries)) return [];
    return data.itineraries.map(normalizeItinerary).filter(Boolean);
  }

  function normalizeItinerary(item) {
    const price = Number(item?.totalPrice);
    const outbound = normalizeLeg(item?.outbound);
    const inbound = normalizeLeg(item?.inbound);
    if (!Number.isFinite(price) || !outbound) return null;
    return {
      source: 'Ryanair',
      price,
      priceFormatted: new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(price),
      totalDurationSeconds: Number(item?.totalDurationMinutes || 0) * 60,
      baggage: {},
      bookingUrl: null,
      nights: item?.nights == null ? null : Number(item.nights),
      outbound,
      inbound
    };
  }

  function normalizeLeg(leg) {
    if (!leg) return null;
    const segments = (Array.isArray(leg?.segments) ? leg.segments : []).map(segment => ({
      carrier: 'FR',
      carrierName: 'Ryanair',
      flightNumber: String(segment?.flightNumber || '').trim(),
      from: String(segment?.origin?.iataCode || '').trim().toUpperCase(),
      to: String(segment?.destination?.iataCode || '').trim().toUpperCase(),
      fromCity: String(segment?.origin?.city || segment?.origin?.iataCode || '').trim(),
      toCity: String(segment?.destination?.city || segment?.destination?.iataCode || '').trim(),
      fromCountry: String(segment?.origin?.countryCode || '').trim().toUpperCase(),
      toCountry: String(segment?.destination?.countryCode || '').trim().toUpperCase(),
      fromName: String(segment?.origin?.name || '').trim(),
      toName: String(segment?.destination?.name || '').trim(),
      departureTime: String(segment?.departureAt || '').trim(),
      arrivalTime: String(segment?.arrivalAt || '').trim(),
      durationSeconds: Number(segment?.durationMinutes || 0) * 60
    })).filter(segment => /^[A-Z]{3}$/.test(segment.from) && /^[A-Z]{3}$/.test(segment.to));
    if (!segments.length) return null;
    return {
      route: [segments[0].from, ...segments.map(segment => segment.to)],
      stops: Number(leg?.stops ?? Math.max(0, segments.length - 1)),
      durationSeconds: Number(leg?.durationMinutes || 0) * 60,
      departureTime: String(leg?.departureAt || segments[0].departureTime || '').trim(),
      arrivalTime: String(leg?.arrivalAt || segments.at(-1).arrivalTime || '').trim(),
      segments
    };
  }

  function mergeItems(items) {
    const byKey = new Map();
    items.forEach(item => {
      if (!item) return;
      const key = itineraryKey(item);
      const current = byKey.get(key);
      if (!current || Number(item.price) < Number(current.price)) byKey.set(key, item);
    });
    return [...byKey.values()];
  }

  function itineraryKey(item) {
    const segments = [...(item?.outbound?.segments || []), ...(item?.inbound?.segments || [])];
    const flights = segments.map(segment => String(segment?.flightNumber || '').replace(/\s+/g, '').toUpperCase()).filter(Boolean);
    if (flights.length) return flights.join('|');
    return segments.map(segment => `${segment?.from || ''}-${segment?.to || ''}@${String(segment?.departureTime || '').slice(0,16)}`).join('|');
  }

  function jsonResponseLike(original, data, status) {
    const headers = new Headers(original.headers);
    headers.delete('content-length');
    headers.delete('content-encoding');
    headers.set('content-type', 'application/json; charset=utf-8');
    return new Response(JSON.stringify(data), { status, statusText: status === original.status ? original.statusText : 'OK', headers });
  }

  function weekdayPreference(values, firstDay, secondDay, firstName, secondName) {
    const days = (Array.isArray(values) ? values : []).map(Number);
    if (days.includes(firstDay) && !days.includes(secondDay)) return firstName;
    if (days.includes(secondDay) && !days.includes(firstDay)) return secondName;
    return 'either';
  }

  function toClock(value) {
    if (value == null || value === '') return '';
    const raw = String(value).trim();
    if (/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(raw)) return raw;
    const number = Number(raw);
    if (!Number.isFinite(number) || number < 0 || number > 23) return '';
    return `${String(Math.floor(number)).padStart(2, '0')}:00`;
  }

  function addIsoDays(value, days) {
    const date = new Date(`${String(value).slice(0, 10)}T12:00:00Z`);
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
    date.setUTCDate(date.getUTCDate() + Number(days || 0));
    return date.toISOString().slice(0, 10);
  }
})();
