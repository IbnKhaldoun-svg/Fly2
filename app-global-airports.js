(() => {
  if (window.__fly2GlobalAirportsInstalled) return;
  window.__fly2GlobalAirportsInstalled = true;

  const DATA_URL = './data/airports-global.json?v=20260825';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const isAndroid = /Fly2Android\//i.test(navigator.userAgent);

  let airports = [];
  let ready = false;

  const norm = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const esc = value => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  function decorate(item) {
    return {
      ...item,
      _city: norm(item.c),
      _name: norm(item.n),
      _country: norm(item.co),
      _keywords: norm(item.k),
      _iata: String(item.i || '').toLowerCase()
    };
  }

  function score(item, query) {
    if (!query) return 0;
    if (item._iata === query) return 1000;
    if (item._city === query) return 950;
    if (item._city.startsWith(query)) return 850;
    if (item._name.startsWith(query)) return 780;
    if (item._iata.startsWith(query)) return 760;
    if (item._keywords.startsWith(query)) return 700;
    if (item._country === query) return 620;
    if (item._city.includes(query)) return 580;
    if (item._name.includes(query)) return 520;
    if (item._keywords.includes(query)) return 470;
    if (item._country.includes(query)) return 320;
    return 0;
  }

  function findMatches(rawQuery) {
    const query = norm(rawQuery);
    if (query.length < 2 || !ready) return [];
    const results = [];
    for (const airport of airports) {
      const value = score(airport, query);
      if (value) results.push([value, airport]);
    }
    results.sort((a, b) => b[0] - a[0] || a[1].c.localeCompare(b[1].c, 'it') || a[1].i.localeCompare(b[1].i));
    return results.slice(0, 10).map(entry => entry[1]);
  }

  function setAirport(input, airport) {
    input.value = airport.c || airport.n || airport.i;
    input.dataset.locationType = 'airport';
    input.dataset.locationIata = airport.i;
    input.dataset.locationCountry = airport.co || airport.cc || '';
    input.dataset.locationCountryCode = airport.cc || '';
    input.dataset.locationAirportName = airport.n || '';
    input.dispatchEvent(new CustomEvent('fly2:global-airport-selected', {
      bubbles: true,
      detail: {
        iata: airport.i,
        city: airport.c,
        country: airport.co,
        countryCode: airport.cc,
        name: airport.n
      }
    }));
  }

  function render(input, box) {
    if (!input || !box || input.disabled) return;
    const query = input.value.trim();
    if (norm(query).length < 2 || !ready) return;

    const matches = findMatches(query);
    if (!matches.length) {
      box.innerHTML = '<div class="suggestion empty-suggestion"><span><strong>Nessun aeroporto commerciale trovato</strong><small>Prova con città, nome aeroporto o codice IATA.</small></span></div>';
      box.classList.remove('hidden');
      return;
    }

    box.innerHTML = matches.map((airport, index) => `
      <button class="suggestion fly2-global-airport-suggestion" type="button" data-global-airport-i="${index}">
        <span class="type-icon">✈</span>
        <span>
          <strong>${esc(airport.c || airport.n)} · ${esc(airport.i)}</strong>
          <small>Aeroporto · ${esc(airport.co || airport.cc)} · ${esc(airport.n)}</small>
        </span>
      </button>
    `).join('');
    box.dataset.globalMatches = JSON.stringify(matches.map(a => a.i));
    box.classList.remove('hidden');
  }

  function bind(inputId, boxId) {
    const input = $('#' + inputId);
    const box = $('#' + boxId);
    if (!input || !box) return;

    const update = () => window.setTimeout(() => render(input, box), 0);
    input.addEventListener('input', update);
    input.addEventListener('focus', update);

    box.addEventListener('click', event => {
      const button = event.target.closest?.('[data-global-airport-i]');
      if (!button) return;
      const matches = findMatches(input.value);
      const airport = matches[Number(button.dataset.globalAirportI)];
      if (!airport) return;
      event.preventDefault();
      setAirport(input, airport);
      box.classList.add('hidden');
    }, true);
  }

  function copyLocationDataset(from, to) {
    const keys = Object.keys(from.dataset || {}).filter(key => /^location/i.test(key));
    keys.forEach(key => { to.dataset[key] = from.dataset[key]; });
  }

  function clearLocationDataset(input) {
    Object.keys(input.dataset || {}).forEach(key => {
      if (/^location/i.test(key)) delete input.dataset[key];
    });
  }

  function installWebSwapGuard() {
    if (isAndroid) return;
    const swap = $('#swap');
    const origin = $('#origin');
    const destination = $('#destination');
    if (!swap || !origin || !destination) return;

    swap.addEventListener('click', event => {
      if ($('#anywhereToggle')?.checked) return;
      if (!origin.dataset.locationIata && !destination.dataset.locationIata) return;
      event.preventDefault();
      event.stopImmediatePropagation();

      const oldOriginValue = origin.value;
      const oldDestinationValue = destination.value;
      const originData = Object.fromEntries(Object.entries(origin.dataset || {}).filter(([key]) => /^location/i.test(key)));
      const destinationData = Object.fromEntries(Object.entries(destination.dataset || {}).filter(([key]) => /^location/i.test(key)));

      origin.value = oldDestinationValue;
      destination.value = oldOriginValue;
      clearLocationDataset(origin);
      clearLocationDataset(destination);
      Object.entries(destinationData).forEach(([key, value]) => { origin.dataset[key] = value; });
      Object.entries(originData).forEach(([key, value]) => { destination.dataset[key] = value; });
    }, true);
  }

  async function load() {
    try {
      const response = await fetch(DATA_URL, { cache: 'force-cache' });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data?.airports)) throw new Error('Dataset aeroporti non disponibile');
      airports = data.airports
        .filter(item => /^[A-Z]{3}$/.test(String(item?.i || '')))
        .map(decorate);
      ready = airports.length > 0;
      if (ready) {
        document.documentElement.dataset.fly2GlobalAirports = String(airports.length);
        const focused = document.activeElement;
        if (focused?.id === 'origin') render(focused, $('#originSuggestions'));
        if (focused?.id === 'destination') render(focused, $('#destinationSuggestions'));
      }
    } catch (error) {
      console.warn('Fly2: indice aeroporti globale non disponibile.', error);
    }
  }

  function install() {
    bind('origin', 'originSuggestions');
    bind('destination', 'destinationSuggestions');
    installWebSwapGuard();
    load();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
