(() => {
  if (window.__fly2RyanairAnywhereInstalled) return;
  window.__fly2RyanairAnywhereInstalled = true;

  const KIWI_API = 'https://fly2-api.fly2-search.workers.dev/search';
  const RYANAIR_ANYWHERE_API = 'https://ryanair-flight-finder-v2.vercel.app/api/fly2-anywhere';
  const $ = (selector, root = document) => root.querySelector(selector);
  const nativeFetch = window.fetch.bind(window);
  let runSerial = 0;

  const style = document.createElement('style');
  style.textContent = `
    .fly2-ryanair-anywhere-status{margin:8px 0 12px;padding:9px 12px;border:1px solid rgba(13,102,95,.13);border-radius:14px;background:#edf7f4;color:#28534d;font-size:11px;font-weight:800}
    .fly2-ryanair-anywhere-status.hidden{display:none!important}
  `;
  document.head.appendChild(style);

  window.fetch = async (resource, init = {}) => {
    const url = typeof resource === 'string' ? resource : resource?.url;
    const response = await nativeFetch(resource, init);

    if (url && String(url).startsWith(KIWI_API) && String(init?.method || 'GET').toUpperCase() === 'POST') {
      let request = null;
      try { request = typeof init?.body === 'string' ? JSON.parse(init.body) : null; } catch {}

      if (isAnywhereRequest(request)) {
        const serial = ++runSerial;
        response.clone().json().then(data => {
          if (!data?.ok || !data?.result) return;
          window.setTimeout(() => supplementRyanairAnywhere(request, serial).catch(() => hideStatus()), 120);
        }).catch(() => {});
      }
    }

    return response;
  };

  function isAnywhereRequest(request) {
    if (!request || !request.departureDate) return false;
    return String(request.destination || '').trim().toLowerCase() === 'anywhere';
  }

  async function supplementRyanairAnywhere(request, serial) {
    const origins = selectedOrigins(request);
    if (!origins.length || serial !== runSerial) return;

    showStatus(origins.length > 1
      ? `Controllo anche Ryanair da ${origins.length} aeroporti…`
      : 'Controllo anche Ryanair per Ovunque…');

    let cursor = 0;
    let added = 0;
    let completed = 0;

    const worker = async () => {
      while (serial === runSerial) {
        const index = cursor++;
        if (index >= origins.length) return;
        const origin = origins[index];
        try {
          const payload = buildRyanairRequest(request, origin);
          const response = await nativeFetch(RYANAIR_ANYWHERE_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(payload)
          });
          const data = await response.json().catch(() => null);
          if (!response.ok || !Array.isArray(data?.itineraries)) continue;

          const external = data.itineraries
            .map(normalizeItinerary)
            .filter(Boolean);
          if (!external.length || serial !== runSerial) continue;

          added += external.length;
          window.fly2LiveResultsApi?.mergeExternalResults?.(external);
        } catch (_) {
        } finally {
          completed += 1;
          if (serial === runSerial && origins.length > 1) {
            showStatus(`Ryanair Ovunque · ${completed}/${origins.length} partenze controllate`);
          }
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(2, origins.length) }, () => worker()));
    if (serial !== runSerial) return;

    if (added) {
      showStatus(`✓ Ryanair aggiunto · ${added} itinerari trovati`);
      window.setTimeout(hideStatus, 3500);
    } else {
      showStatus('Ryanair controllato · nessun itinerario aggiuntivo con questi filtri');
      window.setTimeout(hideStatus, 3500);
    }
  }

  function selectedOrigins(request) {
    const multi = window.fly2MultiAirport?.getOrigins?.() || [];
    const codes = multi
      .map(item => String(item?.iata || '').trim().toUpperCase())
      .filter(code => /^[A-Z]{3}$/.test(code));
    if (codes.length) return [...new Set(codes)].slice(0, 4);

    const primary = String(request.originIata || '').trim().toUpperCase();
    if (/^[A-Z]{3}$/.test(primary)) return [primary];
    const fallback = String(request.origin || '').trim().toUpperCase();
    return /^[A-Z]{3}$/.test(fallback) ? [fallback] : [];
  }

  function buildRyanairRequest(request, origin) {
    const weekend = isWeekend(request);
    const cheapest = isCheapest(request);
    const start = request.departureDate || todayIso();
    const maxStops = Number(request.maxStopovers ?? 1);
    const connectionPreference = maxStops <= 0 ? 'direct' : maxStops === 1 ? 'one-stop' : 'any';
    const maxLayoverHours = request.maxLayoverHours == null ? null : Number(request.maxLayoverHours);
    const maxLayoverMinutes = maxLayoverHours == null ? null : (maxLayoverHours <= 8 ? 480 : 1440);

    const body = {
      origin,
      destination: 'ANY',
      connectionPreference,
      maxLayoverMinutes,
      excludedLayoverCountryCodes: Array.isArray(request.excludeStopoverCountries) ? request.excludeStopoverCountries : [],
      excludedLayoverAirportCodes: [],
      tripType: weekend || cheapest || Boolean(request.returnDate) ? 'round-trip' : 'one-way',
      outbound: dateSelection(start, request.departureDateTo, request.departureDateFlexDays),
      adults: Number(request.adults || 1),
      teens: 0,
      children: Number(request.children || 0),
      infants: Number(request.infants || 0),
      currency: 'EUR'
    };

    if (body.tripType === 'round-trip') {
      if (weekend || cheapest) {
        body.inbound = { mode: 'any', startDate: addIsoDays(start, 1), flexibilityDays: 0 };
      } else {
        body.inbound = dateSelection(request.returnDate, request.returnDateTo, request.returnDateFlexDays);
      }
    }

    if (weekend) {
      body.searchMode = 'weekend';
      body.searchHorizonMonths = 3;
      body.outbound = { mode: 'any', startDate: start, flexibilityDays: 0 };
      body.weekendOutboundDay = weekdayPreference(request.flyDays, 5, 6, 'friday', 'saturday');
      body.weekendInboundDay = weekdayPreference(request.returnFlyDays, 0, 1, 'sunday', 'monday');
      const outTime = toClock(request.departureHourFrom);
      const inTime = toClock(request.returnHourFrom);
      if (outTime) body.weekendOutboundMinTime = outTime;
      if (inTime) body.weekendInboundMinTime = inTime;
    } else if (cheapest) {
      body.searchMode = 'cheapest-stay';
      body.searchHorizonMonths = normalizeHorizon(request.searchHorizonMonths || 3);
      body.outbound = { mode: 'any', startDate: start, flexibilityDays: 0 };
      body.stayNights = clampInt(request.stayNights ?? request.nightsFrom, 1, 30, 3);
    } else {
      body.searchMode = 'selected-dates';
    }

    return body;
  }

  function isWeekend(request) {
    return (Array.isArray(request?.flyDays) && request.flyDays.length > 0) ||
      (Array.isArray(request?.returnFlyDays) && request.returnFlyDays.length > 0);
  }

  function isCheapest(request) {
    return request?.searchMode === 'cheapest' ||
      (!isWeekend(request) && request?.departureDateTo && request?.nightsFrom && request?.nightsTo);
  }

  function dateSelection(startDate, endDate, flexibilityDays) {
    const start = String(startDate || '').slice(0, 10);
    const flex = Number(flexibilityDays || 0);
    if (endDate) return { mode: 'range', startDate: start, endDate: String(endDate).slice(0, 10), flexibilityDays: 0 };
    if (flex > 0) return { mode: 'flexible', startDate: start, flexibilityDays: Math.max(0, Math.min(14, flex)) };
    return { mode: 'fixed', startDate: start, flexibilityDays: 0 };
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

  function normalizeHorizon(value) {
    const n = Number(value);
    return [3, 6, 12].includes(n) ? n : 3;
  }

  function normalizeItinerary(item) {
    const price = Number(item?.totalPrice);
    if (!Number.isFinite(price) || !item?.outbound) return null;
    const outbound = normalizeLeg(item.outbound);
    const inbound = item.inbound ? normalizeLeg(item.inbound) : null;
    if (!outbound) return null;

    return {
      source: 'Ryanair',
      price,
      priceFormatted: new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(price),
      totalDurationSeconds: Number(item.totalDurationMinutes || 0) * 60,
      baggage: {},
      bookingUrl: null,
      nights: item.nights == null ? null : Number(item.nights),
      outbound,
      inbound
    };
  }

  function normalizeLeg(leg) {
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
      stops: Number(leg.stops ?? Math.max(0, segments.length - 1)),
      durationSeconds: Number(leg.durationMinutes || 0) * 60,
      departureTime: String(leg.departureAt || segments[0].departureTime || '').trim(),
      arrivalTime: String(leg.arrivalAt || segments.at(-1).arrivalTime || '').trim(),
      segments
    };
  }

  function ensureStatus() {
    let node = $('#fly2RyanairAnywhereStatus');
    if (node) return node;
    const section = $('#resultSection');
    if (!section) return null;
    node = document.createElement('div');
    node.id = 'fly2RyanairAnywhereStatus';
    node.className = 'fly2-ryanair-anywhere-status hidden';
    const heading = section.querySelector('.results-heading');
    if (heading) heading.insertAdjacentElement('afterend', node);
    else section.prepend(node);
    return node;
  }

  function showStatus(text) {
    const node = ensureStatus();
    if (!node) return;
    node.textContent = text;
    node.classList.remove('hidden');
  }

  function hideStatus() {
    $('#fly2RyanairAnywhereStatus')?.classList.add('hidden');
  }

  function addIsoDays(value, days) {
    const date = new Date(`${String(value).slice(0, 10)}T12:00:00Z`);
    if (Number.isNaN(date.getTime())) return todayIso();
    date.setUTCDate(date.getUTCDate() + Number(days || 0));
    return date.toISOString().slice(0, 10);
  }

  function todayIso() {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function clampInt(value, min, max, fallback) {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  }
})();
