(() => {
  if (!/Fly2Android\//i.test(navigator.userAgent) || window.__fly2AndroidAirportSearch) return;
  window.__fly2AndroidAirportSearch = true;

  const DATA_URL = './data/airports-global.json?v=20260825-4';
  const AIRPORT_API = 'https://fly2-api.fly2-search.workers.dev/airports';
  const $ = (selector, root = document) => root.querySelector(selector);

  const emergency = [
    { i:'VRN', c:'Verona', n:'Aeroporto Valerio Catullo', cc:'IT', co:'Italia', k:'Villafranca Verona' },
    { i:'FEZ', c:'Fez', n:'Aeroporto di Fès-Saïss', cc:'MA', co:'Marocco', k:'Fes Fès Saiss' },
    { i:'TRS', c:'Trieste', n:'Aeroporto di Trieste', cc:'IT', co:'Italia', k:'Ronchi dei Legionari' },
    { i:'GOA', c:'Genova', n:'Aeroporto Cristoforo Colombo', cc:'IT', co:'Italia', k:'Genova Sestri' },
    { i:'FLR', c:'Firenze', n:'Aeroporto Amerigo Vespucci', cc:'IT', co:'Italia', k:'Peretola' },
    { i:'AOI', c:'Ancona', n:'Aeroporto delle Marche', cc:'IT', co:'Italia', k:'Falconara' },
    { i:'PSR', c:'Pescara', n:'Aeroporto d’Abruzzo', cc:'IT', co:'Italia', k:'Abruzzo' },
    { i:'SUF', c:'Lamezia Terme', n:'Aeroporto Internazionale di Lamezia Terme', cc:'IT', co:'Italia', k:'Calabria' },
    { i:'TPS', c:'Trapani', n:'Aeroporto Vincenzo Florio', cc:'IT', co:'Italia', k:'Birgi' },
    { i:'RMI', c:'Rimini', n:'Aeroporto Federico Fellini', cc:'IT', co:'Italia', k:'Rimini San Marino' },
    { i:'TNG', c:'Tangeri', n:'Aeroporto Ibn Battouta', cc:'MA', co:'Marocco', k:'Tangier Tanger' },
    { i:'RBA', c:'Rabat', n:'Aeroporto di Rabat-Salé', cc:'MA', co:'Marocco', k:'Sale Salé' },
    { i:'OUD', c:'Oujda', n:'Aeroporto di Oujda-Angads', cc:'MA', co:'Marocco', k:'Angads' },
    { i:'NDR', c:'Nador', n:'Aeroporto di Nador-El Aroui', cc:'MA', co:'Marocco', k:'El Aroui' },
    { i:'TTU', c:'Tetouan', n:"Aeroporto di Tétouan-Sania R'mel", cc:'MA', co:'Marocco', k:'Tétouan Tetouan Sania Rmel' }
  ];

  const norm = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const esc = value => String(value || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

  const countryName = code => {
    try { return new Intl.DisplayNames(['it'], { type: 'region' }).of(code) || code; }
    catch (_) { return code || ''; }
  };

  const decorate = item => {
    const iata = String(item?.i || item?.iataCode || item?.iata || '').trim().toUpperCase();
    const city = String(item?.c || item?.city || '').trim();
    const name = String(item?.n || item?.name || item?.airportName || '').trim();
    const cc = String(item?.cc || item?.countryCode || '').trim().toUpperCase();
    const country = String(item?.co || item?.country || countryName(cc) || '').trim();
    const keywords = String(item?.k || item?.keywords || '').trim();
    return {
      i: iata, c: city || name || iata, n: name || city || iata, cc, co: country, k: keywords,
      _iata: norm(iata), _city: norm(city), _name: norm(name), _country: norm(country), _keywords: norm(keywords)
    };
  };

  let localAirports = emergency.map(decorate);
  let dataReady = false;
  const remoteCache = new Map();
  const timers = new WeakMap();
  const serials = new WeakMap();

  function score(item, query) {
    if (item._iata === query) return 1200;
    if (item._city === query) return 1150;
    if (item._city.startsWith(query)) return 1050;
    if (item._iata.startsWith(query)) return 1000;
    if (item._name.startsWith(query)) return 900;
    if (item._keywords.startsWith(query)) return 840;
    if (item._city.includes(query)) return 760;
    if (item._name.includes(query)) return 690;
    if (item._keywords.includes(query)) return 620;
    if (item._country === query) return 300;
    return 0;
  }

  function localMatches(rawQuery) {
    const query = norm(rawQuery);
    if (query.length < 2) return [];
    const ranked = [];
    for (const airport of localAirports) {
      const value = score(airport, query);
      if (value) ranked.push([value, airport]);
    }
    ranked.sort((a, b) => b[0] - a[0] || a[1].c.localeCompare(b[1].c, 'it') || a[1].i.localeCompare(b[1].i));
    return ranked.slice(0, 14).map(item => item[1]);
  }

  async function remoteMatches(rawQuery) {
    const query = norm(rawQuery);
    if (query.length < 2) return [];
    if (remoteCache.has(query)) return remoteCache.get(query);
    const pending = (async () => {
      try {
        const url = new URL(AIRPORT_API);
        url.searchParams.set('q', rawQuery.trim());
        const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data) return [];
        return (Array.isArray(data.airports) ? data.airports : [])
          .map(decorate)
          .filter(item => /^[A-Z]{3}$/.test(item.i));
      } catch (_) {
        return [];
      }
    })();
    remoteCache.set(query, pending);
    return pending;
  }

  function mergeMatches(primary, secondary) {
    const byIata = new Map();
    [...primary, ...secondary].forEach(item => {
      if (item && /^[A-Z]{3}$/.test(item.i) && !byIata.has(item.i)) byIata.set(item.i, item);
    });
    return [...byIata.values()].slice(0, 12);
  }

  function render(input, box, matches) {
    if (!input || !box || input.disabled) return;
    if (!matches.length) {
      box.innerHTML = '<div class="suggestion empty-suggestion"><span><strong>Nessun aeroporto trovato</strong><small>Prova con città, aeroporto o codice IATA.</small></span></div>';
      box.classList.remove('hidden');
      return;
    }

    box.innerHTML = matches.map((airport, index) => `
      <button class="suggestion fly2-android-airport-suggestion" type="button" data-android-airport-i="${index}">
        <span class="type-icon">✈</span>
        <span><strong>${esc(airport.c)} · ${esc(airport.i)}</strong><small>Aeroporto · ${esc(airport.co || airport.cc)} · ${esc(airport.n)}</small></span>
      </button>`).join('');
    box._fly2AndroidAirportMatches = matches;
    box.classList.remove('hidden');
  }

  async function update(input, box) {
    const raw = input.value.trim();
    const query = norm(raw);
    if (query.length < 2 || input.disabled) return;

    const serial = (serials.get(input) || 0) + 1;
    serials.set(input, serial);

    const first = localMatches(raw);
    if (first.length) render(input, box, first);

    const remote = await remoteMatches(raw);
    if (serials.get(input) !== serial || norm(input.value) !== query) return;
    const combined = mergeMatches(first, remote);
    render(input, box, combined);
  }

  function schedule(input, box) {
    const old = timers.get(input);
    if (old) clearTimeout(old);
    const timer = setTimeout(() => update(input, box), 90);
    timers.set(input, timer);
  }

  function selectAirport(input, box, airport) {
    input.value = airport.c || airport.n || airport.i;
    input.dataset.locationType = 'airport';
    input.dataset.locationIata = airport.i;
    input.dataset.locationCountry = airport.co || airport.cc || '';
    input.dataset.locationCountryCode = airport.cc || '';
    input.dataset.locationAirportName = airport.n || '';
    box.classList.add('hidden');
    input.dispatchEvent(new CustomEvent('fly2:global-airport-selected', { bubbles: true, detail: airport }));
  }

  function bind(inputId, boxId) {
    const input = $('#' + inputId);
    const box = $('#' + boxId);
    if (!input || !box) return;
    input.addEventListener('input', () => schedule(input, box));
    input.addEventListener('focus', () => schedule(input, box));
    box.addEventListener('click', event => {
      const button = event.target.closest?.('[data-android-airport-i]');
      if (!button) return;
      const matches = box._fly2AndroidAirportMatches || [];
      const airport = matches[Number(button.dataset.androidAirportI)];
      if (!airport) return;
      event.preventDefault();
      event.stopPropagation();
      selectAirport(input, box, airport);
    }, true);
  }

  async function loadData() {
    try {
      const response = await fetch(DATA_URL, { cache: 'force-cache' });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data?.airports)) return;
      const merged = new Map();
      [...data.airports.map(decorate), ...emergency.map(decorate)].forEach(item => {
        if (/^[A-Z]{3}$/.test(item.i)) merged.set(item.i, item);
      });
      localAirports = [...merged.values()];
      dataReady = true;
      document.documentElement.dataset.fly2AndroidAirports = String(localAirports.length);
      const focused = document.activeElement;
      if (focused?.id === 'origin') schedule(focused, $('#originSuggestions'));
      if (focused?.id === 'destination') schedule(focused, $('#destinationSuggestions'));
    } catch (_) {
      dataReady = false;
    }
  }

  function install() {
    bind('origin', 'originSuggestions');
    bind('destination', 'destinationSuggestions');
    loadData();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
