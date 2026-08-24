(() => {
  const API_URL = 'https://fly2-api.fly2-search.workers.dev/search';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const airlineCodes = {
    'Ryanair': 'FR', 'easyJet': 'U2', 'Wizz Air': 'W6', 'Vueling': 'VY', 'Volotea': 'V7',
    'ITA Airways': 'AZ', 'Lufthansa': 'LH', 'Air France': 'AF', 'KLM': 'KL', 'Iberia': 'IB',
    'British Airways': 'BA', 'TAP Air Portugal': 'TP', 'Turkish Airlines': 'TK', 'Royal Air Maroc': 'AT',
    'Air Arabia Maroc': '3O', 'Transavia': 'HV', 'Eurowings': 'EW', 'SWISS': 'LX',
    'Austrian Airlines': 'OS', 'Norwegian': 'DY', 'Pegasus Airlines': 'PC', 'Brussels Airlines': 'SN'
  };

  const countryCodes = {
    'Albania':'AL','Austria':'AT','Belgio':'BE','Bulgaria':'BG','Cipro':'CY','Croazia':'HR','Danimarca':'DK','Egitto':'EG',
    'Emirati Arabi Uniti':'AE','Finlandia':'FI','Francia':'FR','Germania':'DE','Grecia':'GR','Irlanda':'IE','Islanda':'IS',
    'Italia':'IT','Marocco':'MA','Malta':'MT','Norvegia':'NO','Paesi Bassi':'NL','Polonia':'PL','Portogallo':'PT','Qatar':'QA',
    'Regno Unito':'GB','Repubblica Ceca':'CZ','Romania':'RO','Serbia':'RS','Spagna':'ES','Svezia':'SE','Svizzera':'CH',
    'Tunisia':'TN','Turchia':'TR','Ungheria':'HU'
  };

  let liveResults = [];
  let preferredCodes = [];

  const button = $('#searchButton');
  if (!button) return;
  button.addEventListener('click', handleSearch, { capture: true });
  $('#resultSort')?.addEventListener('change', renderSorted);

  async function handleSearch(event) {
    event.preventDefault();
    event.stopImmediatePropagation();

    try {
      const payload = buildPayload();
      showLoading(payload);
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || `Errore HTTP ${response.status}`);
      const result = data.result;
      if (!result || !Array.isArray(result.itineraries)) throw new Error('Kiwi non ha restituito un elenco di itinerari valido.');

      liveResults = applyLocalPolicies(result.itineraries.filter(item => !isHiddenCityItinerary(item)));
      if (!liveResults.length) {
        showMessage('Nessun volo compatibile', 'Kiwi ha risposto correttamente, ma nessun itinerario rispetta tutti i filtri selezionati.');
        return;
      }
      $('#resultTitle').textContent = result.query || `${payload.origin} → ${payload.destination}`;
      $('#resultSortWrap').classList.remove('hidden');
      $('#resultSort').value = 'Predefinito';
      renderSorted();
    } catch (error) {
      showMessage('Ricerca non riuscita', error instanceof Error ? error.message : String(error));
    }
  }

  function buildPayload() {
    const origin = $('#origin')?.value.trim();
    const anywhere = $('#anywhereToggle')?.checked;
    const destination = anywhere ? 'anywhere' : $('#destination')?.value.trim();
    if (!origin || !destination) throw new Error('Inserisci partenza e destinazione.');
    if (!anywhere && norm(origin) === norm(destination)) throw new Error('Partenza e destinazione devono essere diverse.');

    const trip = $('.segment.active')?.dataset.trip || 'roundtrip';
    const mode = $('.chip.active')?.dataset.mode || 'flexible';
    const payload = { origin, destination, ...readPassengers(), maxStopovers: Number($('#stops')?.value || 1), sort: 'price' };

    if (mode === 'flexible') applyFlexibleDates(payload, trip);
    if (mode === 'cheapest') applyCheapestDates(payload);
    if (mode === 'weekend') applyWeekendDates(payload);

    const layover = $('#layover')?.value;
    if (layover && layover !== 'none') payload.maxLayoverHours = Number(layover);

    const excluded = readTags('#airlineExcludeChips').map(name => airlineCodes[name]).filter(Boolean);
    if (excluded.length) payload.excludeAirlines = excluded;

    preferredCodes = readTags('#airlineIncludeChips').map(name => airlineCodes[name]).filter(Boolean);

    const avoid = readTags('#avoidCountryChips').map(name => countryCodes[name]).filter(Boolean);
    if (avoid.length) payload.excludeStopoverCountries = avoid;

    if (anywhere) payload.oneForCity = true;
    return payload;
  }

  function applyFlexibleDates(payload, trip) {
    const out = readFlexLeg('out');
    payload.departureDate = out.date;
    if (out.flexDays) payload.departureDateFlexDays = out.flexDays;
    if (out.to) payload.departureDateTo = out.to;

    if (trip === 'roundtrip') {
      const back = readFlexLeg('in');
      payload.returnDate = back.date;
      if (back.flexDays) payload.returnDateFlexDays = back.flexDays;
      if (back.to) payload.returnDateTo = back.to;
    }
  }

  function readFlexLeg(leg) {
    const prefix = leg === 'out' ? 'flexOut' : 'flexIn';
    const active = $(`[data-flex-leg="${leg}"].active`);
    const kind = active?.dataset.flexKind || 'exact';
    if (kind === 'exact') return { date: value(prefix + 'Exact') };
    if (kind === 'plusminus') return { date: value(prefix + 'Base'), flexDays: Number(value(prefix + 'Days') || 0) };
    return { date: value(prefix + 'From'), to: value(prefix + 'To') };
  }

  function applyCheapestDates(payload) {
    const start = tomorrow();
    const months = Number($('#horizon')?.value || 6);
    const end = new Date(start + 'T12:00:00');
    end.setMonth(end.getMonth() + months);
    const nights = Math.max(1, Math.min(15, Number($('#nights')?.value || 3)));
    payload.searchMode = 'cheapest';
    payload.searchHorizonMonths = months;
    payload.stayNights = nights;
    payload.departureDate = start;
    payload.departureDateTo = iso(end);
    payload.nightsFrom = nights;
    payload.nightsTo = nights;
  }

  function applyWeekendDates(payload) {
    const start = tomorrow();
    const end = new Date(start + 'T12:00:00');
    end.setMonth(end.getMonth() + 3);
    const outDay = $('#weekendOut')?.value === 'Sabato' ? 6 : 5;
    const backDay = $('#weekendBack')?.value === 'Lunedì' ? 1 : 0;
    const nights = (backDay - outDay + 7) % 7 || 7;
    payload.departureDate = start;
    payload.departureDateTo = iso(end);
    payload.flyDays = [outDay];
    payload.returnFlyDays = [backDay];
    payload.nightsFrom = nights;
    payload.nightsTo = nights;
    payload.departureHourFrom = hour($('#weekendOutTime')?.value);
    payload.returnHourFrom = hour($('#weekendBackTime')?.value);
  }

  function readPassengers() {
    const count = (id, fallback) => Number($('#count-' + id)?.textContent || fallback);
    return {
      adults: count('adults', 1),
      children: count('children', 0),
      infants: count('infantsSeat', 0) + count('infantsLap', 0)
    };
  }

  function isHiddenCityItinerary(item) {
    if (!item || typeof item !== 'object') return false;

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
          const normalizedKey = String(key).replace(/[\s_-]+/g, '').toLowerCase();
          if (normalizedKey.includes('hiddencity') &&
              (entry === true || entry === 1 || String(entry).toLowerCase() === 'true')) return true;
          return visit(entry, depth + 1);
        });
      }

      return false;
    };

    return visit(item);
  }

  function applyLocalPolicies(items) {
    const outSame = $('input[name="outSegmentCarrier"]:checked')?.value === 'same';
    const inSame = $('input[name="inSegmentCarrier"]:checked')?.value === 'same';
    const filtered = items.filter(item => {
      if (outSame && !sameCarrier(item.outbound?.segments)) return false;
      if (inSame && item.inbound && !sameCarrier(item.inbound?.segments)) return false;
      return true;
    });
    return filtered.sort(defaultCompare);
  }

  function sameCarrier(segments = []) {
    const codes = segments.map(s => s?.carrier).filter(Boolean);
    return codes.length < 2 || codes.every(code => code === codes[0]);
  }

  function effectivePrice(item) {
    const combined = window.fly2Pricing?.effectivePrice?.(item);
    return Number.isFinite(Number(combined)) ? Number(combined) : num(item?.price, Infinity);
  }

  function defaultCompare(a, b) {
    const scoreDiff = preferredScore(b) - preferredScore(a);
    return scoreDiff || effectivePrice(a) - effectivePrice(b);
  }

  function preferredScore(item) {
    if (!preferredCodes.length) return 0;
    return [...(item.outbound?.segments || []), ...(item.inbound?.segments || [])].reduce((score, segment) => score + (preferredCodes.includes(segment?.carrier) ? 1 : 0), 0);
  }

  function itineraryMergeKey(item) {
    return [...(item?.outbound?.segments || []), ...(item?.inbound?.segments || [])]
      .map(segment => {
        const from = String(segment?.from || '').trim().toUpperCase();
        const to = String(segment?.to || '').trim().toUpperCase();
        const departure = String(segment?.departureTime || '').slice(0, 16);
        return from && to && departure ? `${from}-${to}@${departure}` : '';
      })
      .filter(Boolean)
      .join('|');
  }

  function mergeExternalResults(items = []) {
    if (!Array.isArray(items) || !items.length) return;

    const incoming = items.filter(item => item && !isHiddenCityItinerary(item));
    if (!incoming.length) return;

    const byKey = new Map();
    [...liveResults, ...incoming].forEach(item => {
      const key = itineraryMergeKey(item) || JSON.stringify(item);
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, item);
        return;
      }

      const existingPrice = effectivePrice(existing);
      const incomingPrice = effectivePrice(item);
      if (incomingPrice < existingPrice) byKey.set(key, item);
    });

    liveResults = applyLocalPolicies([...byKey.values()]);
    renderSorted();
  }

  function renderSorted() {
    const mode = $('#resultSort')?.value || 'Predefinito';
    const items = [...liveResults];
    if (mode === 'Prezzo') items.sort((a,b) => effectivePrice(a) - effectivePrice(b));
    else if (mode === 'Durata') items.sort((a,b) => num(a.totalDurationSeconds, Infinity) - num(b.totalDurationSeconds, Infinity));
    else if (mode === 'Numero di scali') items.sort((a,b) => stops(a) - stops(b) || effectivePrice(a) - effectivePrice(b));
    else if (mode === 'Numero di notti') items.sort((a,b) => nights(a) - nights(b) || effectivePrice(a) - effectivePrice(b));
    else items.sort(defaultCompare);
    renderResults(items);
  }

  function renderResults(items) {
    const content = $('#resultContent');
    const hasDirect = items.some(item => item?.source && item.source !== 'Kiwi');
    const sourceText = hasDirect
      ? 'Risultati combinati da Kiwi.com e fonti dirette verificate.'
      : 'Prezzi e disponibilità ricevuti da Kiwi.com al momento della ricerca.';

    const cheapest = items.reduce((best, item) => {
      const price = effectivePrice(item);
      if (!Number.isFinite(price)) return best;
      return !best || price < best.price ? { item, price } : best;
    }, null);

    const cheapestSource = cheapest
      ? (window.fly2Pricing?.source?.(cheapest.item) || cheapest.item?.source || 'Kiwi')
      : '';
    const cheapestPrice = cheapest
      ? new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(cheapest.price)
      : '—';

    const minimumCard = cheapest ? `
      <div class="minimum-price-card" aria-label="Prezzo minimo trovato">
        <span class="minimum-price-label">Prezzo minimo trovato</span>
        <strong class="minimum-price-value">${esc(cheapestPrice)}</strong>
        <span class="minimum-price-source">${esc(cheapestSource)} · migliore tra ${items.length} itinerari</span>
      </div>` : '';

    content.innerHTML =
      `<div class="live-results-meta">
        <div class="live-results-count"><strong>${items.length} itinerari</strong><span>${sourceText}</span></div>
        ${minimumCard}
      </div>` +
      items.map((item, index) => renderItinerary(item, index)).join('');

    $('#resultSection').classList.remove('hidden');
    $('#resultSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderItinerary(item, index) {
    const baggage = item.baggage || {};
    const bagText = [
      baggage.personalItem ? `${baggage.personalItem} oggetto personale` : null,
      baggage.cabinBag ? `${baggage.cabinBag} bagaglio a mano` : null,
      baggage.checkedBag ? `${baggage.checkedBag} bagaglio in stiva` : null
    ].filter(Boolean).join(' · ') || 'Bagaglio incluso non indicato';
    return `<article class="flight-card">
      <div class="flight-card-head">
        <div><span class="flight-rank">${index === 0 ? 'Prima opzione' : `Opzione ${index + 1}`}</span><span class="flight-source">${esc(item.source || 'Kiwi')}</span><strong class="flight-price">${esc(item.priceFormatted || (item.price != null ? `${item.price} EUR` : 'Prezzo non disponibile'))}</strong></div>
        <div class="flight-total">Durata totale <strong>${duration(item.totalDurationSeconds)}</strong></div>
      </div>
      ${renderLeg('Andata', item.outbound)}
      ${item.inbound ? renderLeg('Ritorno', item.inbound) : ''}
      <div class="flight-foot"><span>${esc(bagText)}</span>${item.bookingUrl ? `<a class="book-link" href="${escAttr(item.bookingUrl)}" target="_blank" rel="noopener noreferrer">Vai alla prenotazione ↗</a>` : '<span class="book-link disabled">Link non disponibile</span>'}</div>
    </article>`;
  }

  function renderLeg(label, leg) {
    if (!leg) return '';
    const route = (leg.route || []).join(' → ');
    const segments = (leg.segments || []).map(renderSegment).join('');
    const stopsText = leg.stops === 0 ? 'Diretto' : `${leg.stops} ${leg.stops === 1 ? 'scalo' : 'scali'}`;
    return `<section class="flight-leg">
      <div class="flight-leg-title"><strong>${label}</strong><span>${esc(route)}</span><span>${esc(stopsText)} · ${duration(leg.durationSeconds)}</span></div>
      <div class="flight-times"><strong>${dateTime(leg.departureTime)}</strong><span>→</span><strong>${dateTime(leg.arrivalTime)}</strong></div>
      <div class="flight-segments">${segments}</div>
    </section>`;
  }

  function renderSegment(segment, index, all) {
    const layover = index < all.length - 1 ? layoverText(segment.arrivalTime, all[index + 1]?.departureTime, segment.to) : '';
    return `<div class="flight-segment"><div><strong>${esc(segment.carrierName || segment.carrier || 'Compagnia')}</strong><span>${esc(segment.flightNumber || '')}</span></div><div><span>${esc(segment.from || '')} ${shortTime(segment.departureTime)}</span><span>→</span><span>${esc(segment.to || '')} ${shortTime(segment.arrivalTime)}</span></div>${layover ? `<small>${esc(layover)}</small>` : ''}</div>`;
  }

  function showLoading(payload) {
    button.disabled = true;
    button.classList.add('is-loading');
    button.innerHTML = 'Cerco voli reali… <span>⌛</span>';
    $('#resultTitle').textContent = `${payload.origin} → ${payload.destination}`;
    $('#resultContent').innerHTML = '<article class="result-card"><div class="notice"><strong>Ricerca in corso…</strong><br>Fly2 sta interrogando Kiwi tramite il Worker Cloudflare.</div></article>';
    $('#resultSortWrap').classList.add('hidden');
    $('#resultSection').classList.remove('hidden');
    $('#resultSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => resetButton(), 15000);
  }

  function showMessage(title, message) {
    resetButton();
    $('#resultTitle').textContent = title;
    $('#resultContent').innerHTML = `<article class="result-card"><div class="notice">${esc(message)}</div></article>`;
    $('#resultSortWrap').classList.add('hidden');
    $('#resultSection').classList.remove('hidden');
  }

  window.fly2LiveResultsApi = {
    rerender() {
      if (!liveResults.length) return;
      renderSorted();
    },
    mergeExternalResults(items) {
      mergeExternalResults(items);
    },
    getResults() {
      return [...liveResults];
    }
  };

  const originalRender = renderResults;
  renderResults = function(items) { resetButton(); originalRender(items); };

  function resetButton() {
    button.disabled = false;
    button.classList.remove('is-loading');
    button.innerHTML = 'Cerca voli <span>→</span>';
  }

  function readTags(selector) { return $$('.tag > span', $(selector)).map(el => el.textContent.trim()).filter(Boolean); }
  function value(id) { const v = $('#' + id)?.value; if (!v) throw new Error('Completa le date della ricerca.'); return v; }
  function hour(v) { const n = Number(String(v || '').split(':')[0]); return Number.isFinite(n) ? n : null; }
  function tomorrow() { const d = new Date(); d.setDate(d.getDate() + 1); return iso(d); }
  function iso(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  function num(v, fallback = 0) { return Number.isFinite(Number(v)) ? Number(v) : fallback; }
  function stops(item) { return num(item.outbound?.stops) + num(item.inbound?.stops); }
  function nights(item) { if (!item.inbound?.departureTime || !item.outbound?.arrivalTime) return Infinity; return Math.max(0, Math.round((new Date(item.inbound.departureTime) - new Date(item.outbound.arrivalTime)) / 86400000)); }
  function duration(seconds) { if (!Number.isFinite(Number(seconds))) return '—'; const total = Math.round(Number(seconds)/60); const h = Math.floor(total/60); const m = total%60; return `${h}h ${String(m).padStart(2,'0')}m`; }
  function shortTime(v) { if (!v) return '—'; return new Intl.DateTimeFormat('it-IT',{hour:'2-digit',minute:'2-digit'}).format(new Date(v)); }
  function dateTime(v) { if (!v) return '—'; return new Intl.DateTimeFormat('it-IT',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(v)); }
  function layoverText(a, b, airport) { if (!a || !b) return ''; const mins = Math.round((new Date(b)-new Date(a))/60000); if (mins < 0) return ''; return `Scalo a ${airport || ''}: ${Math.floor(mins/60)}h ${String(mins%60).padStart(2,'0')}m`; }
  function norm(v) { return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim(); }
  function esc(v) { return String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function escAttr(v) { return esc(v); }
})();
