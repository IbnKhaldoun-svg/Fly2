(() => {
  const API_URL = 'https://fly2-api.fly2-search.workers.dev/search';
  const COUNTRY_PAIR_API = 'https://fly2-api.fly2-search.workers.dev/country-pair-search';
  const COUNTRY_AIRPORTS_API = 'https://fly2-api.fly2-search.workers.dev/country-airports';
  const COMPARE_API = 'https://fly2-api.fly2-search.workers.dev/ryanair-compare';
  const COUNTRY_DIRECT_API = 'https://fly2-api.fly2-search.workers.dev/ryanair-country';
  const AIRPORT_META_API = 'https://fly2-api.fly2-search.workers.dev/airports';
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

  const officialAirlineSites = {
    // Low-cost / Europa
    FR: 'https://www.ryanair.com/',
    U2: 'https://www.easyjet.com/',
    W6: 'https://www.wizzair.com/', W4: 'https://www.wizzair.com/', W9: 'https://www.wizzair.com/',
    VY: 'https://www.vueling.com/', V7: 'https://www.volotea.com/',
    HV: 'https://www.transavia.com/', TO: 'https://www.transavia.com/',
    EW: 'https://www.eurowings.com/', DY: 'https://www.norwegian.com/',
    PC: 'https://www.flypgs.com/',
    TB: 'https://www.tuifly.be/en',
    X3: 'https://www.tui.com/flug/',
    BY: 'https://www.tui.nl/vliegtickets/',
    TOM: 'https://www.tui.co.uk/flight/',

    // Gruppi europei / network carrier
    AZ: 'https://www.ita-airways.com/',
    LH: 'https://www.lufthansa.com/', LX: 'https://www.swiss.com/', OS: 'https://www.austrian.com/',
    SN: 'https://www.brusselsairlines.com/',
    AF: 'https://www.airfrance.com/', KL: 'https://www.klm.com/',
    IB: 'https://www.iberia.com/', BA: 'https://www.britishairways.com/',
    TP: 'https://www.flytap.com/', TK: 'https://www.turkishairlines.com/',
    LO: 'https://www.lot.com/', AY: 'https://www.finnair.com/',
    SK: 'https://www.flysas.com/', A3: 'https://en.aegeanair.com/',
    JU: 'https://www.airserbia.com/', OU: 'https://www.croatiaairlines.com/',
    UX: 'https://www.aireuropa.com/', FI: 'https://www.icelandair.com/',

    // Marocco / Nord Africa
    AT: 'https://www.royalairmaroc.com/it-it/booking/book-a-flight',
    '3O': 'https://www.airarabia.com/it/home',
    G9: 'https://www.airarabia.com/it/home',
    E5: 'https://www.airarabia.com/it/home',
    TU: 'https://www.tunisair.com/',
    AH: 'https://airalgerie.dz/',

    // Medio Oriente
    QR: 'https://www.qatarairways.com/',
    EK: 'https://www.emirates.com/',
    EY: 'https://www.etihad.com/',
    SV: 'https://www.saudia.com/'
  };

  const officialAirlineSitesByName = {
    'air arabia maroc': 'https://www.airarabia.com/it/home',
    'air arabia': 'https://www.airarabia.com/it/home',
    'royal air maroc': 'https://www.royalairmaroc.com/it-it/booking/book-a-flight',
    'ryanair': 'https://www.ryanair.com/',
    'easyjet': 'https://www.easyjet.com/',
    'wizz air': 'https://www.wizzair.com/',
    'vueling': 'https://www.vueling.com/',
    'volotea': 'https://www.volotea.com/',
    'ita airways': 'https://www.ita-airways.com/',
    'lufthansa': 'https://www.lufthansa.com/',
    'air france': 'https://www.airfrance.com/',
    'klm': 'https://www.klm.com/',
    'iberia': 'https://www.iberia.com/',
    'british airways': 'https://www.britishairways.com/',
    'tap air portugal': 'https://www.flytap.com/',
    'turkish airlines': 'https://www.turkishairlines.com/',
    'transavia': 'https://www.transavia.com/',
    'eurowings': 'https://www.eurowings.com/',
    'swiss': 'https://www.swiss.com/',
    'austrian airlines': 'https://www.austrian.com/',
    'norwegian': 'https://www.norwegian.com/',
    'pegasus airlines': 'https://www.flypgs.com/',
    'brussels airlines': 'https://www.brusselsairlines.com/',
    'tui fly belgium': 'https://www.tuifly.be/en',
    'tui fly': 'https://www.tuifly.be/en'
  };

  let liveResults = [];
  let preferredCodes = [];
  let countrySearchContext = null;
  const bookingStore = new Map();
  const bookingModal = createUnifiedBookingModal();
  const detailsStore = new Map();
  const detailsModal = createFlightDetailsModal();
  const layoverStore = new Map();
  const airportMetaCache = new Map();
  const layoverModal = createLayoverModal();

  const button = $('#searchButton');
  if (!button) return;
  button.addEventListener('click', handleSearch, { capture: true });
  $('#resultSort')?.addEventListener('change', renderSorted);

  document.addEventListener('click', event => {
    const bookingButton = event.target.closest?.('.unified-booking-button[data-booking-key]');
    if (bookingButton) {
      event.preventDefault();
      const item = bookingStore.get(bookingButton.dataset.bookingKey);
      if (item) openUnifiedBookingModal(item);
      return;
    }

    const detailsButton = event.target.closest?.('.flight-details-button[data-details-key]');
    if (detailsButton) {
      event.preventDefault();
      const item = detailsStore.get(detailsButton.dataset.detailsKey);
      if (item) openFlightDetailsModal(item);
      return;
    }

    const countryChoice = event.target.closest?.('[data-country-choice]');
    if (countryChoice) {
      event.preventDefault();
      openCountryChoice(countryChoice.dataset.countryChoice);
      return;
    }

    const countryBack = event.target.closest?.('[data-country-back]');
    if (countryBack) {
      event.preventDefault();
      renderCountryChoices();
      return;
    }

    const layoverButton = event.target.closest?.('.long-layover-trigger[data-layover-key]');
    if (layoverButton) {
      event.preventDefault();
      const layover = layoverStore.get(layoverButton.dataset.layoverKey);
      if (layover) openLayoverModal(layover);
    }
  }, true);

  async function handleSearch(event) {
    event.preventDefault();
    event.stopImmediatePropagation();

    try {
      const payload = buildPayload();
      countrySearchContext = null;
      liveResults = [];
      showLoading(payload);

      if (payload.destinationType === 'country' && payload.originIata) {
        await searchCountryAirportByAirport(payload);
        return;
      }

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || `Errore HTTP ${response.status}`);
      const result = data.result;
      if (!result || !Array.isArray(result.itineraries)) throw new Error('Kiwi non ha restituito un elenco di itinerari valido.');

      const kiwiItems = normalizeKiwiItems(result.itineraries);
      liveResults = applyLocalPolicies(kiwiItems);
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

  function normalizeKiwiItems(items) {
    return (Array.isArray(items) ? items : [])
      .filter(item => !isHiddenCityItinerary(item))
      .map(item => ({
        ...item,
        source: item?.source || 'Kiwi',
        kiwiBookingUrl: item?.kiwiBookingUrl || item?.bookingUrl || null
      }));
  }

  async function searchCountryAirportByAirport(payload) {
    const countryInfo = await resolveCommercialCountryAirports(
      payload.destination,
      payload.destinationCountryCode
    );

    const airports = countryInfo.airports
      .filter(airport => airport.iataCode !== payload.originIata);

    if (!airports.length) {
      throw new Error('Non ho trovato aeroporti commerciali con codice IATA per il Paese selezionato.');
    }

    const groups = new Map();
    let cursor = 0;
    let completed = 0;
    let failed = 0;

    countrySearchContext = {
      payload,
      countryName: countryInfo.countryName || payload.destination,
      countryCode: countryInfo.countryCode || payload.destinationCountryCode || '',
      airportCount: airports.length,
      airportSource: countryInfo.source || 'OurAirports',
      groups,
      selectedKey: null,
      completed: 0,
      failed: 0,
      directAttempts: 0,
      directSuccesses: 0,
      directFailures: 0
    };

    renderCountryProgress(0, airports.length, 0);

    const worker = async () => {
      while (true) {
        const index = cursor++;
        if (index >= airports.length) return;
        const airport = airports[index];

        try {
          const result = await searchOneCountryAirport(payload, airport);
          if (result.directAttempted) {
            countrySearchContext.directAttempts += 1;
            if (result.directAvailable) countrySearchContext.directSuccesses += 1;
            else countrySearchContext.directFailures += 1;
          }
          if (result.items.length) {
            addCountryAirportResults(
              groups,
              airport.iataCode,
              result.items,
              airport
            );
          }
        } catch {
          failed += 1;
        } finally {
          completed += 1;
          countrySearchContext.completed = completed;
          countrySearchContext.failed = failed;
          renderCountryProgress(completed, airports.length, groups.size);
        }
      }
    };

    const workerCount = Math.min(2, Math.max(1, airports.length));
    await Promise.all(Array.from({ length: workerCount }, () => worker()));

    if (!groups.size) {
      showMessage(
        'Nessun volo compatibile',
        failed
          ? `Ricerca completata con alcune sorgenti non disponibili: nessuna combinazione compatibile trovata su ${airports.length} aeroporti commerciali.`
          : `Ho controllato ${airports.length} aeroporti commerciali, ma non ho trovato combinazioni compatibili con tutti i filtri selezionati.`
      );
      return;
    }

    renderCountryChoices();
  }

  async function resolveCommercialCountryAirports(countryName, countryCode) {
    const code = String(countryCode || '').trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) {
      throw new Error('Non riesco a determinare il codice del Paese selezionato.');
    }

    const url = new URL(COUNTRY_AIRPORTS_API);
    url.searchParams.set('country', code);
    url.searchParams.set('name', countryName);

    const response = await fetch(url.toString());
    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.ok || !Array.isArray(data.airports)) {
      throw new Error(data?.error || 'Non riesco a recuperare gli aeroporti commerciali del Paese.');
    }

    return {
      countryName: data.countryName || countryName,
      countryCode: data.countryCode || code,
      source: data.source || 'OurAirports',
      airports: data.airports
        .map(airport => ({
          iataCode: String(airport?.iataCode || '').trim().toUpperCase(),
          name: String(airport?.name || '').trim(),
          city: String(airport?.city || '').trim(),
          countryCode: String(airport?.countryCode || code).trim().toUpperCase(),
          type: String(airport?.type || '').trim(),
          scheduledService: airport?.scheduledService !== false,
          ryanair: Boolean(airport?.ryanair),
          latitude: Number.isFinite(Number(airport?.latitude)) ? Number(airport.latitude) : null,
          longitude: Number.isFinite(Number(airport?.longitude)) ? Number(airport.longitude) : null
        }))
        .filter(airport => /^[A-Z]{3}$/.test(airport.iataCode) && airport.scheduledService)
    };
  }

  async function searchOneCountryAirport(payload, airport) {
    const destinationIata = airport.iataCode;
    const pairPayload = {
      ...payload,
      origin: payload.originIata || payload.origin,
      destination: destinationIata,
      destinationType: 'airport',
      destinationIata,
      destinationCountryCode: ''
    };

    const kiwiPromise = fetch(COUNTRY_PAIR_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pairPayload)
    }).then(async response => {
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok || !Array.isArray(data?.result?.itineraries)) return [];
      return normalizeKiwiItems(data.result.itineraries);
    }).catch(() => []);

    const directAttempted = Boolean(airport.ryanair && canRunDirectPairSearch(pairPayload));
    const directPromise = directAttempted
      ? fetch(COMPARE_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildDirectPairPayload(pairPayload))
        }).then(async response => {
          const data = await response.json().catch(() => null);
          if (!response.ok || !data?.ok || !Array.isArray(data.itineraries)) {
            return { available: false, items: [] };
          }
          return {
            available: true,
            items: data.itineraries
              .map(item => item?.fly2Itinerary)
              .filter(item => item && Number.isFinite(Number(item.price)))
          };
        }).catch(() => ({ available: false, items: [] }))
      : Promise.resolve({ available: null, items: [] });

    const [kiwiItems, directResult] = await Promise.all([kiwiPromise, directPromise]);
    return {
      items: applyLocalPolicies(mergeItemsLocal([...kiwiItems, ...directResult.items])),
      directAttempted,
      directAvailable: directResult.available === true
    };
  }

  function canRunDirectPairSearch(payload) {
    if (Array.isArray(payload.excludeAirlines) && payload.excludeAirlines.includes('FR')) return false;
    if (payload.flyDays || payload.returnFlyDays) return false;
    return Boolean(payload.originIata && payload.destinationIata && payload.departureDate);
  }

  function buildDirectPairPayload(payload) {
    return {
      searchMode: payload.searchMode || undefined,
      originIata: payload.originIata,
      destinationIata: payload.destinationIata,
      departureDate: payload.departureDate,
      departureDateTo: payload.departureDateTo || null,
      departureDateFlexDays: payload.departureDateFlexDays || 0,
      returnDate: payload.returnDate || null,
      returnDateTo: payload.returnDateTo || null,
      returnDateFlexDays: payload.returnDateFlexDays || 0,
      searchHorizonMonths: payload.searchHorizonMonths || undefined,
      stayNights: payload.stayNights || payload.nightsFrom || undefined,
      adults: payload.adults || 1,
      children: payload.children || 0,
      infants: payload.infants || 0,
      maxStopovers: payload.maxStopovers ?? 1,
      maxLayoverHours: payload.maxLayoverHours ?? null,
      excludeStopoverCountries: payload.excludeStopoverCountries || []
    };
  }

  function mergeItemsLocal(items) {
    const byKey = new Map();
    for (const item of items) {
      if (!item || isHiddenCityItinerary(item)) continue;
      const key = itineraryMergeKey(item) || JSON.stringify(item);
      const normalized = {
        ...item,
        kiwiBookingUrl:
          item?.kiwiBookingUrl ||
          (item?.source === 'Kiwi' ? item?.bookingUrl : null) ||
          null
      };
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, normalized);
        continue;
      }
      const winner = rawItemPrice(normalized) < rawItemPrice(existing) ? normalized : existing;
      const kiwiBookingUrl =
        existing?.kiwiBookingUrl ||
        (existing?.source === 'Kiwi' ? existing?.bookingUrl : null) ||
        normalized?.kiwiBookingUrl ||
        (normalized?.source === 'Kiwi' ? normalized?.bookingUrl : null) ||
        null;
      byKey.set(key, { ...winner, kiwiBookingUrl });
    }
    return [...byKey.values()];
  }

  function rawItemPrice(item) {
    const value = Number(item?.price);
    return Number.isFinite(value) ? value : Infinity;
  }

  function addCountryAirportResults(groups, code, items, meta) {
    const city = String(meta?.city || code).trim();
    const key = norm(city || code);
    const current = groups.get(key) || {
      key,
      city: city || code,
      airportCodes: [],
      airportNames: [],
      items: [],
      minPrice: Infinity,
      hasDirect: false
    };

    if (!current.airportCodes.includes(code)) current.airportCodes.push(code);
    if (meta?.name && !current.airportNames.includes(meta.name)) current.airportNames.push(meta.name);

    current.items = mergeItemsLocal([...current.items, ...items]);
    current.minPrice = current.items.reduce((best, item) => Math.min(best, rawItemPrice(item)), Infinity);
    current.hasDirect = current.items.some(item => stops(item) === 0);
    groups.set(key, current);
  }

  function renderCountryProgress(completed, total, foundCities) {
    resetButton();
    button.disabled = true;
    button.classList.add('is-loading');
    button.innerHTML = 'Cerco in tutto il Paese… <span>⌛</span>';
    $('#resultSortWrap').classList.add('hidden');
    $('#resultContent').innerHTML = `
      <div class="country-progress-card">
        <strong>Ricerca aeroporto per aeroporto</strong>
        <span>${completed} / ${total} aeroporti commerciali controllati</span>
        <div class="country-progress-track"><span style="width:${total ? Math.round(completed / total * 100) : 0}%"></span></div>
        <small>${foundCities ? `${foundCities} destinazioni con risultati trovate finora.` : 'Confronto Kiwi e fonti dirette disponibili per ogni aeroporto commerciale.'}</small>
      </div>`;
    $('#resultSection').classList.remove('hidden');
  }

  function renderCountryChoices() {
    if (!countrySearchContext) return;
    resetButton();
    countrySearchContext.selectedKey = null;
    liveResults = [];

    const groups = [...countrySearchContext.groups.values()]
      .filter(group => Number.isFinite(group.minPrice))
      .sort((a, b) => a.minPrice - b.minPrice || a.city.localeCompare(b.city, 'it'));

    $('#resultTitle').textContent = `${countrySearchContext.payload.origin} → ${countrySearchContext.countryName}`;
    $('#resultSortWrap').classList.add('hidden');

    const searchedText = countrySearchContext.failed
      ? `${countrySearchContext.completed} aeroporti commerciali controllati · ${countrySearchContext.failed} ricerche non completate`
      : `${countrySearchContext.completed} aeroporti commerciali controllati`;

    const directStatus = countrySearchContext.directAttempts
      ? (
          countrySearchContext.directFailures === countrySearchContext.directAttempts
            ? 'Kiwi disponibile · Ryanair diretto non disponibile in questa ricerca'
            : countrySearchContext.directFailures
              ? `Kiwi + Ryanair diretto · ${countrySearchContext.directFailures} verifiche Ryanair non riuscite`
              : 'Kiwi + Ryanair diretto disponibili'
        )
      : 'Kiwi disponibile · nessuna verifica Ryanair diretta necessaria';

    $('#resultContent').innerHTML = `
      <div class="country-choice-head">
        <div>
          <strong>Scegli la città</strong>
          <span>${groups.length} destinazioni trovate · ${esc(searchedText)}</span>
        </div>
        <small>Prezzo minimo per città · aeroporti commerciali da ${esc(countrySearchContext.airportSource || 'fonte aeroportuale neutrale')} · ${esc(directStatus)}.</small>
      </div>
      <div class="country-choice-grid">
        ${groups.map(group => {
          const price = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(group.minPrice);
          return `
            <button type="button" class="country-choice-card" data-country-choice="${escAttr(group.key)}">
              <div class="country-choice-title"><strong>${esc(group.city)}</strong><span>→</span></div>
              <span class="country-choice-codes">${esc(group.airportCodes.join(' · '))}</span>
              <small>Biglietti da</small>
              <strong class="country-choice-price">${esc(price)}</strong>
              <span class="country-choice-count">${group.items.length} ${group.items.length === 1 ? 'combinazione' : 'combinazioni'}</span>
              ${group.hasDirect ? '<span class="country-direct-badge">Diretto disponibile</span>' : '<span class="country-connection-badge">Con scalo</span>'}
            </button>`;
        }).join('')}
      </div>`;

    $('#resultSection').classList.remove('hidden');
    $('#resultSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function openCountryChoice(key) {
    if (!countrySearchContext) return;
    const group = countrySearchContext.groups.get(key);
    if (!group) return;

    countrySearchContext.selectedKey = key;
    liveResults = applyLocalPolicies([...group.items]);
    $('#resultTitle').textContent = `${countrySearchContext.payload.origin} → ${group.city}`;
    $('#resultSortWrap').classList.remove('hidden');
    $('#resultSort').value = 'Prezzo';
    renderSorted();
  }


  function buildPayload() {
    const origin = $('#origin')?.value.trim();
    const anywhere = $('#anywhereToggle')?.checked;
    const destination = anywhere ? 'anywhere' : $('#destination')?.value.trim();
    if (!origin || !destination) throw new Error('Inserisci partenza e destinazione.');
    if (!anywhere && norm(origin) === norm(destination)) throw new Error('Partenza e destinazione devono essere diverse.');

    const trip = $('.segment.active')?.dataset.trip || 'roundtrip';
    const mode = $('.chip.active')?.dataset.mode || 'flexible';
    const originInput = $('#origin');
    const destinationInput = $('#destination');
    const destinationType =
      destinationInput?.dataset.locationType ||
      (countryCodes[destination] ? 'country' : '');
    const payload = {
      origin,
      destination,
      originType: originInput?.dataset.locationType || '',
      originIata: originInput?.dataset.locationIata || '',
      destinationType,
      destinationIata: destinationInput?.dataset.locationIata || '',
      destinationCountryCode: destinationType === 'country' ? (countryCodes[destination] || '') : '',
      ...readPassengers(),
      maxStopovers: Number($('#stops')?.value || 1),
      sort: 'price'
    };

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
    const excludedStopoverCountries = new Set(
      readTags('#avoidCountryChips')
        .map(name => normalizePolicyCountryCode(countryCodes[name] || name))
        .filter(Boolean)
    );

    const filtered = items.filter(item => {
      if (outSame && !sameCarrier(item.outbound?.segments)) return false;
      if (inSame && item.inbound && !sameCarrier(item.inbound?.segments)) return false;
      if (excludedStopoverCountries.size && itineraryUsesExcludedStopoverCountry(item, excludedStopoverCountries)) return false;
      return true;
    });
    return filtered.sort(defaultCompare);
  }

  function normalizePolicyCountryCode(value) {
    const code = String(value || '').trim().toUpperCase();
    if (code === 'UK') return 'GB';
    return /^[A-Z]{2}$/.test(code) ? code : '';
  }

  function segmentDestinationCountryCode(segment) {
    return normalizePolicyCountryCode(
      segment?.toCountry ||
      segment?.destinationCountryCode ||
      segment?.destination?.countryCode ||
      segment?.destination?.country?.code ||
      segment?.to?.countryCode ||
      segment?.to?.country?.code
    );
  }

  function legUsesExcludedStopoverCountry(leg, excludedCountries) {
    const segments = Array.isArray(leg?.segments) ? leg.segments : [];
    if (segments.length <= 1) return false;

    return segments.slice(0, -1).some(segment => {
      const countryCode = segmentDestinationCountryCode(segment);
      return countryCode && excludedCountries.has(countryCode);
    });
  }

  function itineraryUsesExcludedStopoverCountry(item, excludedCountries) {
    return legUsesExcludedStopoverCountry(item?.outbound, excludedCountries) ||
      legUsesExcludedStopoverCountry(item?.inbound, excludedCountries);
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

  async function mergeCountryDirectResults(payload) {
    const request = {
      originIata: payload.originIata,
      destinationCountryName: payload.destination,
      destinationCountryCode: payload.destinationCountryCode || '',
      departureDate: payload.departureDate,
      departureDateTo: payload.departureDateTo || null,
      departureDateFlexDays: payload.departureDateFlexDays || 0,
      returnDate: payload.returnDate || null,
      returnDateTo: payload.returnDateTo || null,
      returnDateFlexDays: payload.returnDateFlexDays || 0,
      adults: payload.adults || 1,
      children: payload.children || 0,
      infants: payload.infants || 0,
      maxStopovers: payload.maxStopovers ?? 1,
      maxLayoverHours: payload.maxLayoverHours ?? null,
      excludeStopoverCountries: payload.excludeStopoverCountries || []
    };

    try {
      const response = await fetch(COUNTRY_DIRECT_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok || !Array.isArray(data.itineraries)) return;

      const external = data.itineraries
        .map(item => item?.fly2Itinerary)
        .filter(item => item && Number.isFinite(Number(item.price)));

      if (!external.length) return;
      mergeExternalResults(external);
    } catch {
      // Kiwi results remain usable if the direct country scan is temporarily unavailable.
    }
  }

  function mergeExternalResults(items = []) {
    if (!Array.isArray(items) || !items.length) return;

    const incoming = items.filter(item => item && !isHiddenCityItinerary(item));
    if (!incoming.length) return;

    const byKey = new Map();
    [...liveResults, ...incoming].forEach(item => {
      const key = itineraryMergeKey(item) || JSON.stringify(item);
      const normalized = {
        ...item,
        kiwiBookingUrl:
          item?.kiwiBookingUrl ||
          (item?.source === 'Kiwi' ? item?.bookingUrl : null) ||
          null
      };
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, normalized);
        return;
      }

      const existingPrice = effectivePrice(existing);
      const incomingPrice = effectivePrice(normalized);
      const winner = incomingPrice < existingPrice ? normalized : existing;
      const kiwiBookingUrl =
        existing?.kiwiBookingUrl ||
        (existing?.source === 'Kiwi' ? existing?.bookingUrl : null) ||
        normalized?.kiwiBookingUrl ||
        (normalized?.source === 'Kiwi' ? normalized?.bookingUrl : null) ||
        null;

      byKey.set(key, { ...winner, kiwiBookingUrl });
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
      ? (cheapest.item?.source || window.fly2Pricing?.source?.(cheapest.item) || 'Kiwi')
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

    const countryBack = countrySearchContext?.selectedKey
      ? `<div class="country-selected-bar">
          <button type="button" data-country-back>← Tutte le città</button>
          <span>Confronto completo per la città selezionata</span>
        </div>`
      : '';

    content.innerHTML =
      countryBack +
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

    const bookingKey = itineraryMergeKey(item) || `booking-${index}-${Date.now()}`;
    const detailsKey = `details|${bookingKey}`;
    bookingStore.set(bookingKey, item);
    detailsStore.set(detailsKey, item);

    return `<article class="flight-card compact-flight-card" data-itinerary-key="${escAttr(bookingKey)}">
      <div class="flight-card-head compact-flight-head">
        <div>
          <span class="flight-rank">${index === 0 ? 'Prima opzione' : `Opzione ${index + 1}`}</span>
          <span class="flight-source">${esc(item.source || 'Kiwi')}</span>
          <strong class="flight-price">${esc(item.priceFormatted || (item.price != null ? `${item.price} EUR` : 'Prezzo non disponibile'))}</strong>
        </div>
        <div class="flight-total">Durata totale <strong>${duration(item.totalDurationSeconds)}</strong></div>
      </div>

      <div class="flight-compact-summary">
        ${renderLegSummary('Andata', item.outbound)}
        ${item.inbound ? renderLegSummary('Ritorno', item.inbound) : ''}
      </div>

      <div class="flight-foot compact-flight-foot">
        <span>${esc(bagText)}</span>
        <div class="flight-card-actions">
          <button type="button" class="flight-details-button" data-details-key="${escAttr(detailsKey)}">Dettagli volo</button>
          <button type="button" class="unified-booking-button" data-booking-key="${escAttr(bookingKey)}">Prenota <span aria-hidden="true">↗</span></button>
        </div>
      </div>
    </article>`;
  }

  function renderLegSummary(label, leg) {
    if (!leg) return '';
    const segments = Array.isArray(leg.segments) ? leg.segments : [];
    const route = segments.length
      ? [segments[0]?.from, ...segments.map(segment => segment?.to)].filter(Boolean).join(' → ')
      : (leg.route || []).join(' → ');
    const stopsText = leg.stops === 0 ? 'Diretto' : `${leg.stops} ${leg.stops === 1 ? 'scalo' : 'scali'}`;
    const longLayovers = renderLongLayoverChips(leg);

    return `
      <section class="flight-compact-leg">
        <div class="flight-compact-leg-main">
          <strong class="flight-compact-label">${esc(label)}</strong>
          <span class="flight-compact-route">${esc(route)}</span>
          <span class="flight-compact-meta">${esc(stopsText)} · ${duration(leg.durationSeconds)}</span>
        </div>
        <div class="flight-compact-times">
          <strong>${dateTime(leg.departureTime)}</strong>
          <span>→</span>
          <strong>${dateTime(leg.arrivalTime)}</strong>
        </div>
        ${longLayovers ? `<div class="flight-compact-layovers">${longLayovers}</div>` : ''}
      </section>`;
  }

  function renderLongLayoverChips(leg) {
    const segments = Array.isArray(leg?.segments) ? leg.segments : [];
    if (segments.length < 2) return '';

    return segments.slice(0, -1).map((segment, index) => {
      const next = segments[index + 1];
      const minutes = layoverMinutes(segment?.arrivalTime, next?.departureTime);
      if (!Number.isFinite(minutes) || minutes < 360) return '';

      const code = String(segment?.to || next?.from || '').trim().toUpperCase();
      if (!code) return '';

      const key = `${code}|${String(segment?.arrivalTime || '')}|${String(next?.departureTime || '')}`;
      layoverStore.set(key, {
        code,
        minutes,
        arrivalTime: segment?.arrivalTime || '',
        departureTime: next?.departureTime || '',
        fallbackCity: segment?.toCity || next?.fromCity || '',
        fallbackAirport: segment?.toName || next?.fromName || '',
        fallbackCountry: segment?.toCountry || next?.fromCountry || ''
      });

      const city = segment?.toCity && norm(segment.toCity) !== norm(code) ? segment.toCity : code;
      return `<button type="button" class="compact-layover-chip long-layover-trigger" data-layover-key="${escAttr(key)}">Scalo lungo ${esc(city)} · ${esc(minutesToHuman(minutes))}</button>`;
    }).join('');
  }

  function renderLeg(label, leg) {
    if (!leg) return '';
    const route = formatLegRoute(leg);
    const segments = (leg.segments || []).map(renderSegment).join('');
    const longLayovers = renderLongLayovers(leg);
    const stopsText = leg.stops === 0 ? 'Diretto' : `${leg.stops} ${leg.stops === 1 ? 'scalo' : 'scali'}`;
    return `<section class="flight-leg">
      <div class="flight-leg-title"><strong>${label}</strong><span>${esc(route)}</span><span>${esc(stopsText)} · ${duration(leg.durationSeconds)}</span></div>
      <div class="flight-times"><strong>${dateTime(leg.departureTime)}</strong><span>→</span><strong>${dateTime(leg.arrivalTime)}</strong></div>
      <div class="flight-segments">${segments}</div>
      ${longLayovers}
    </section>`;
  }

  function renderSegment(segment, index, all) {
    const layover = index < all.length - 1 ? layoverText(segment.arrivalTime, all[index + 1]?.departureTime, segment.to) : '';
    const carrierName = segment.carrierName || segment.carrier || 'Compagnia';
    const rawFlight = String(segment.flightNumber || '').trim();
    const flightNumber = norm(rawFlight) === norm(carrierName) || norm(rawFlight) === norm(segment.carrier) ? '' : rawFlight;
    return `<div class="flight-segment"><div><strong>${esc(carrierName)}</strong>${flightNumber ? `<span>${esc(flightNumber)}</span>` : ''}</div><div><span>${esc(segment.from || '')} ${shortTime(segment.departureTime)}</span><span>→</span><span>${esc(segment.to || '')} ${shortTime(segment.arrivalTime)}</span></div>${layover ? `<small>${esc(layover)}</small>` : ''}</div>`;
  }

  function renderLongLayovers(leg) {
    const segments = Array.isArray(leg?.segments) ? leg.segments : [];
    if (segments.length < 2) return '';

    return segments.slice(0, -1).map((segment, index) => {
      const next = segments[index + 1];
      const minutes = layoverMinutes(segment?.arrivalTime, next?.departureTime);
      if (!Number.isFinite(minutes) || minutes < 360) return '';

      const code = String(segment?.to || next?.from || '').trim().toUpperCase();
      if (!code) return '';

      const key = `${code}|${String(segment?.arrivalTime || '')}|${String(next?.departureTime || '')}`;
      layoverStore.set(key, {
        code,
        minutes,
        arrivalTime: segment?.arrivalTime || '',
        departureTime: next?.departureTime || '',
        fallbackCity: segment?.toCity || next?.fromCity || '',
        fallbackAirport: segment?.toName || next?.fromName || '',
        fallbackCountry: segment?.toCountry || next?.fromCountry || ''
      });

      const label = segment?.toCity && norm(segment.toCity) !== norm(code)
        ? segment.toCity
        : code;

      return `
        <div class="long-layover-compact">
          <div>
            <span>Scalo lungo</span>
            <strong>${esc(label)}${label !== code ? ` (${esc(code)})` : ''} · ${esc(minutesToHuman(minutes))}</strong>
          </div>
          <button type="button" class="long-layover-trigger" data-layover-key="${escAttr(key)}">Esplora lo scalo ↗</button>
        </div>`;
    }).join('');
  }

  function layoverMinutes(arrival, departure) {
    if (!arrival || !departure) return NaN;
    const a = new Date(arrival);
    const b = new Date(departure);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return NaN;
    return Math.round((b - a) / 60000);
  }

  function minutesToHuman(minutes) {
    const h = Math.floor(minutes / 60);
    const m = Math.max(0, minutes % 60);
    return m ? `${h}h ${String(m).padStart(2, '0')}m` : `${h}h`;
  }

  function createLayoverModal() {
    const modal = document.createElement('div');
    modal.className = 'layover-modal hidden';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <div class="layover-backdrop" data-layover-close></div>
      <section class="layover-dialog" role="dialog" aria-modal="true" aria-labelledby="layoverTitle">
        <div class="layover-dialog-head">
          <div>
            <span class="layover-kicker">Scalo lungo</span>
            <h2 id="layoverTitle">Esplora lo scalo</h2>
          </div>
          <button type="button" class="layover-close" data-layover-close aria-label="Chiudi">×</button>
        </div>
        <div class="layover-modal-content"></div>
      </section>`;
    document.body.appendChild(modal);

    modal.addEventListener('click', event => {
      if (event.target.closest('[data-layover-close]')) closeLayoverModal();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !modal.classList.contains('hidden')) closeLayoverModal();
    });
    return modal;
  }

  async function openLayoverModal(layover) {
    const content = $('.layover-modal-content', layoverModal);
    if (!content) return;

    layoverModal.classList.remove('hidden');
    layoverModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('layover-modal-open');
    content.innerHTML = '<div class="layover-loading">Recupero città e aeroporto dello scalo…</div>';

    const meta = await getAirportMeta(layover.code, layover);
    renderLayoverModal(content, layover, meta);
    $('.layover-close', layoverModal)?.focus();
  }

  function closeLayoverModal() {
    layoverModal.classList.add('hidden');
    layoverModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('layover-modal-open');
  }

  async function getAirportMeta(code, fallback) {
    if (airportMetaCache.has(code)) return airportMetaCache.get(code);

    try {
      const response = await fetch(`${AIRPORT_META_API}?codes=${encodeURIComponent(code)}`);
      const data = await response.json().catch(() => null);
      const airport = response.ok && data?.ok && Array.isArray(data.airports)
        ? data.airports.find(item => String(item?.iataCode || '').toUpperCase() === code)
        : null;
      if (airport) {
        airportMetaCache.set(code, airport);
        return airport;
      }
    } catch {}

    const fallbackMeta = {
      iataCode: code,
      name: fallback?.fallbackAirport || `Aeroporto ${code}`,
      city: fallback?.fallbackCity || '',
      countryCode: shortCountry(fallback?.fallbackCountry || '')
    };
    airportMetaCache.set(code, fallbackMeta);
    return fallbackMeta;
  }

  function renderLayoverModal(content, layover, airport) {
    const code = airport?.iataCode || layover.code;
    const city = airport?.city && norm(airport.city) !== norm(code)
      ? airport.city
      : (layover.fallbackCity && norm(layover.fallbackCity) !== norm(code) ? layover.fallbackCity : '');
    const airportName = airport?.name || layover.fallbackAirport || `Aeroporto ${code}`;
    const countryCode = String(airport?.countryCode || shortCountry(layover.fallbackCountry || '') || '').toUpperCase();
    const countryName = displayCountry(countryCode);

    const locationSuffix = [city, countryName].filter(Boolean).join(', ');
    const airportQuery = [airportName, `(${code})`, locationSuffix].filter(Boolean).join(' ');
    const centerQuery = city
      ? `Centro di ${city}${countryName ? `, ${countryName}` : ''}`
      : `Centro città vicino a ${airportName} ${code}`;

    const recommendedDeparture = addWallClockHours(layover.arrivalTime, 1);
    const directionsUrl = googleMapsDirectionsAtTime(
      airportQuery,
      centerQuery,
      recommendedDeparture?.iso || ''
    );
    const thingsUrl = googleMapsSearch(
      city
        ? `attrazioni turistiche a ${city}${countryName ? `, ${countryName}` : ''}`
        : `attrazioni turistiche vicino a ${airportName}, ${code}`
    );
    const foodCenterUrl = googleMapsSearch(
      city
        ? `ristoranti a ${city}${countryName ? `, ${countryName}` : ''}`
        : `ristoranti in città vicino a ${airportName}`
    );
    const foodAirportUrl = googleMapsSearch(
      `ristoranti vicino a ${airportName}${city ? `, ${city}` : ''}${countryName ? `, ${countryName}` : ''}`
    );

    const recommendedText = recommendedDeparture
      ? `${recommendedDeparture.date} alle ${recommendedDeparture.time}`
      : '';

    content.innerHTML = `
      <div class="layover-place">
        <span>${esc(minutesToHuman(layover.minutes))} di scalo · ${esc(shortTime(layover.arrivalTime))} → ${esc(shortTime(layover.departureTime))}</span>
        <h3>${esc(city || code)}${city ? ` (${esc(code)})` : ''}</h3>
        <p>${esc(airportName)}${countryName ? ` · ${esc(countryName)}` : ''}</p>
        ${recommendedText ? `<div class="layover-recommended-time"><strong>Partenza consigliata verso il centro:</strong> ${esc(recommendedText)} <span>(1h dopo l'arrivo del volo)</span></div>` : ''}
      </div>

      <div class="layover-safety">
        Prima di uscire verifica requisiti di ingresso/transito e conserva margine sufficiente per rientrare in aeroporto, rifare i controlli e raggiungere il gate.
      </div>

      <div class="layover-guide-grid">
        <a href="${escAttr(directionsUrl)}" target="_blank" rel="noopener noreferrer">
          <strong>Raggiungi il centro</strong>
          <span>${esc(airportName)} → ${esc(city ? `centro di ${city}` : 'centro città')}${recommendedText ? ` · partenza ${esc(recommendedText)}` : ''}</span>
        </a>
        <a href="${escAttr(thingsUrl)}" target="_blank" rel="noopener noreferrer">
          <strong>Cosa vedere e fare</strong>
          <span>${esc(city ? `Attrazioni a ${city}` : 'Attrazioni vicino all’aeroporto')}</span>
        </a>
        <a href="${escAttr(foodCenterUrl)}" target="_blank" rel="noopener noreferrer">
          <strong>Mangiare in città</strong>
          <span>${esc(city ? `Ristoranti a ${city}` : 'Ristoranti in città')}</span>
        </a>
        <a href="${escAttr(foodAirportUrl)}" target="_blank" rel="noopener noreferrer">
          <strong>Mangiare vicino all’aeroporto</strong>
          <span>${esc(airportName)}${city ? ` · ${esc(city)}` : ''}</span>
        </a>
      </div>`;
  }

  function addWallClockHours(value, hours) {
    const text = String(value || '');
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!match) return null;

    const date = new Date(Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]),
      Number(match[5])
    ));
    date.setUTCHours(date.getUTCHours() + Number(hours || 0));

    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
    const hh = String(date.getUTCHours()).padStart(2, '0');
    const min = String(date.getUTCMinutes()).padStart(2, '0');

    return {
      iso: `${yyyy}-${mm}-${dd}T${hh}:${min}`,
      date: `${dd}/${mm}/${yyyy}`,
      time: `${hh}:${min}`
    };
  }

  function googleMapsDirectionsAtTime(origin, destination, localDateTime) {
    const stamp = mapsLocalWallClockStamp(localDateTime);
    if (!stamp) {
      const params = new URLSearchParams({
        api: '1',
        origin,
        destination,
        travelmode: 'transit'
      });
      return `https://www.google.com/maps/dir/?${params.toString()}`;
    }

    const from = encodeURIComponent(origin);
    const to = encodeURIComponent(destination);

    // Formato interno usato dalla UI di Google Maps:
    // !6e0 = parti alle, !7e2 = interpreta l'orario come locale,
    // !8j = data/ora, !3e3 = trasporto pubblico.
    return `https://www.google.com/maps/dir/${from}/${to}/data=!4m6!4m5!2m3!6e0!7e2!8j${stamp}!3e3`;
  }

  function mapsLocalWallClockStamp(value) {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!match) return null;

    return Math.floor(Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
      0
    ) / 1000);
  }

  function googleMapsSearch(query) {
    const params = new URLSearchParams({ api: '1', query });
    return `https://www.google.com/maps/search/?${params.toString()}`;
  }

  function displayCountry(code) {
    if (!code) return '';
    try {
      return new Intl.DisplayNames('it-IT', { type: 'region' }).of(code) || code;
    } catch {
      return code;
    }
  }

  function formatLegRoute(leg) {
    const segments = Array.isArray(leg?.segments) ? leg.segments : [];
    if (!segments.length) return (leg?.route || []).join(' → ');

    const points = segments.map(segment => ({
      city: segment?.fromCity || segment?.from,
      code: segment?.from,
      country: shortCountry(segment?.fromCountry)
    }));
    const last = segments[segments.length - 1];
    points.push({
      city: last?.toCity || last?.to,
      code: last?.to,
      country: shortCountry(last?.toCountry)
    });

    return points.map(point => {
      const city = point.city || point.code || '—';
      const code = point.code && point.code !== city ? ` (${point.code})` : '';
      const country = point.country ? `, ${point.country}` : '';
      return `${city}${code}${country}`;
    }).join(' → ');
  }

  function shortCountry(value) {
    const text = String(value || '').trim();
    if (/^[A-Z]{2}$/i.test(text)) return text.toUpperCase();
    const map = {
      Italy: 'IT', Italia: 'IT', Spain: 'ES', Spagna: 'ES', France: 'FR', Francia: 'FR',
      Morocco: 'MA', Marocco: 'MA', Poland: 'PL', Polonia: 'PL', Germany: 'DE', Germania: 'DE',
      'United Kingdom': 'GB', 'Regno Unito': 'GB', Portugal: 'PT', Portogallo: 'PT',
      Austria: 'AT', Switzerland: 'CH', Svizzera: 'CH', Netherlands: 'NL', 'Paesi Bassi': 'NL',
      Belgium: 'BE', Belgio: 'BE', Greece: 'GR', Grecia: 'GR', Turkey: 'TR', Turchia: 'TR'
    };
    return map[text] || '';
  }

  function createFlightDetailsModal() {
    const modal = document.createElement('div');
    modal.className = 'flight-details-modal hidden';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <div class="flight-details-backdrop" data-flight-details-close></div>
      <section class="flight-details-dialog" role="dialog" aria-modal="true" aria-labelledby="flightDetailsTitle">
        <div class="flight-details-modal-head">
          <div>
            <span class="flight-details-kicker">Itinerario completo</span>
            <h2 id="flightDetailsTitle">Dettagli volo</h2>
          </div>
          <button type="button" class="flight-details-close" data-flight-details-close aria-label="Chiudi">×</button>
        </div>
        <div class="flight-details-modal-content"></div>
      </section>`;
    document.body.appendChild(modal);

    modal.addEventListener('click', event => {
      if (event.target.closest('[data-flight-details-close]')) closeFlightDetailsModal();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !modal.classList.contains('hidden')) closeFlightDetailsModal();
    });

    return modal;
  }

  function openFlightDetailsModal(item) {
    const content = $('.flight-details-modal-content', detailsModal);
    if (!content) return;

    const baggage = item?.baggage || {};
    const bagText = [
      baggage.personalItem ? `${baggage.personalItem} oggetto personale` : null,
      baggage.cabinBag ? `${baggage.cabinBag} bagaglio a mano` : null,
      baggage.checkedBag ? `${baggage.checkedBag} bagaglio in stiva` : null
    ].filter(Boolean).join(' · ') || 'Bagaglio incluso non indicato';

    content.innerHTML = `
      <div class="flight-details-price-row">
        <div>
          <span>${esc(item?.source || 'Kiwi')}</span>
          <strong>${esc(item?.priceFormatted || (item?.price != null ? `${item.price} EUR` : 'Prezzo non disponibile'))}</strong>
        </div>
        <div>
          <span>Durata totale</span>
          <strong>${duration(item?.totalDurationSeconds)}</strong>
        </div>
      </div>
      <div class="flight-details-modal-legs">
        ${renderLeg('Andata', item?.outbound)}
        ${item?.inbound ? renderLeg('Ritorno', item.inbound) : ''}
      </div>
      <div class="flight-details-baggage">${esc(bagText)}</div>`;

    detailsModal.classList.remove('hidden');
    detailsModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('flight-details-modal-open');
    $('.flight-details-close', detailsModal)?.focus();
  }

  function closeFlightDetailsModal() {
    detailsModal.classList.add('hidden');
    detailsModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('flight-details-modal-open');
  }

  function createUnifiedBookingModal() {
    const modal = document.createElement('div');
    modal.className = 'unified-booking-modal hidden';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <div class="unified-booking-backdrop" data-unified-close></div>
      <section class="unified-booking-dialog" role="dialog" aria-modal="true" aria-labelledby="unifiedBookingTitle">
        <div class="unified-booking-head">
          <div>
            <span class="unified-booking-kicker">Prenotazione</span>
            <h2 id="unifiedBookingTitle">Scegli dove prenotare</h2>
          </div>
          <button type="button" class="unified-booking-close" data-unified-close aria-label="Chiudi">×</button>
        </div>
        <p class="unified-booking-intro">Per ogni tratta puoi aprire il sito ufficiale della compagnia oppure Kiwi. Quando Fly2 dispone di un deep-link verificato, rotta, data e passeggeri vengono già impostati.</p>
        <div class="unified-booking-list"></div>
      </section>`;
    document.body.appendChild(modal);

    modal.addEventListener('click', event => {
      if (event.target.closest('[data-unified-close]')) closeUnifiedBookingModal();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !modal.classList.contains('hidden')) closeUnifiedBookingModal();
    });
    return modal;
  }

  function openUnifiedBookingModal(item) {
    const list = $('.unified-booking-list', bookingModal);
    if (!list) return;

    const passengers = readPassengers();
    const outbound = item?.outbound?.segments || [];
    const inbound = item?.inbound?.segments || [];
    const segments = [...outbound, ...inbound];
    const kiwiUrl =
      item?.kiwiBookingUrl ||
      (item?.source === 'Kiwi' ? item?.bookingUrl : null) ||
      null;

    list.innerHTML = segments.map((segment, index) => {
      const carrier = String(segment?.carrier || '').trim().toUpperCase();
      const airline = segment?.carrierName || carrier || 'Compagnia';
      const mappedOfficialHome =
        officialAirlineSites[carrier] ||
        officialAirlineSitesByName[norm(airline)] ||
        null;
      const officialPrefilled = carrier === 'FR';
      const officialIsDirect = officialPrefilled || Boolean(mappedOfficialHome);
      const officialUrl = officialPrefilled
        ? buildRyanairBookingUrl(segment, passengers)
        : mappedOfficialHome || buildOfficialSiteSearchUrl(airline, carrier);
      const direction = index < outbound.length ? 'Andata' : 'Ritorno';
      const fromCity = segment?.fromCity || segment?.from || '';
      const toCity = segment?.toCity || segment?.to || '';
      const route = `${fromCity} (${segment?.from || ''}) → ${toCity} (${segment?.to || ''})`;
      const when = formatBookingDateTime(segment?.departureTime);
      const rawFlight = String(segment?.flightNumber || '').trim();
      const flight = norm(rawFlight) === norm(airline) ? '' : rawFlight;

      return `
        <article class="unified-booking-row">
          <div class="unified-booking-step">${index + 1}</div>
          <div class="unified-booking-route">
            <span class="unified-booking-direction">${esc(direction)} · ${esc(airline)}</span>
            <strong>${esc(route)}</strong>
            <span>${flight ? esc(flight) + ' · ' : ''}${esc(when)}</span>
          </div>
          <div class="unified-booking-actions">
            ${officialUrl
              ? `<a class="unified-booking-action official" href="${escAttr(officialUrl)}" target="_blank" rel="noopener noreferrer">${officialPrefilled ? 'Compagnia · già impostato' : officialIsDirect ? 'Sito compagnia' : 'Trova sito ufficiale'} ↗</a>`
              : '<span class="unified-booking-action disabled">Sito ufficiale non trovato</span>'}
            ${kiwiUrl
              ? `<a class="unified-booking-action kiwi" href="${escAttr(kiwiUrl)}" target="_blank" rel="noopener noreferrer">Kiwi ↗</a>`
              : '<span class="unified-booking-action disabled">Kiwi non disponibile</span>'}
          </div>
        </article>`;
    }).join('');

    bookingModal.classList.remove('hidden');
    bookingModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('unified-modal-open');
    $('.unified-booking-close', bookingModal)?.focus();
  }

  function closeUnifiedBookingModal() {
    bookingModal.classList.add('hidden');
    bookingModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('unified-modal-open');
  }

  function buildRyanairBookingUrl(segment, passengers) {
    const dateOut = String(segment?.departureTime || '').slice(0, 10);
    const adults = String(passengers.adults || 1);
    const children = String(passengers.children || 0);
    const infants = String(passengers.infants || 0);
    const teens = '0';
    const params = new URLSearchParams({
      adults, teens, children, infants,
      dateOut,
      dateIn: '',
      isConnectedFlight: 'false',
      discount: '0',
      promoCode: '',
      originIata: segment?.from || '',
      destinationIata: segment?.to || '',
      tpAdults: adults,
      tpTeens: teens,
      tpChildren: children,
      tpInfants: infants,
      tpStartDate: dateOut,
      tpEndDate: '',
      tpDiscount: '0',
      tpPromoCode: '',
      tpOriginIata: segment?.from || '',
      tpDestinationIata: segment?.to || ''
    });
    return `https://www.ryanair.com/it/it/trip/flights/select?${params.toString()}`;
  }

  function buildOfficialSiteSearchUrl(airline, carrier) {
    const query = [String(airline || '').trim(), String(carrier || '').trim(), 'official airline website']
      .filter(Boolean)
      .join(' ');
    return query
      ? `https://www.google.com/search?q=${encodeURIComponent(query)}`
      : null;
  }

  function formatBookingDateTime(value) {
    const text = String(value || '');
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})/);
    return match ? `${match[3]}/${match[2]}/${match[1]} · ${match[4]}` : text.slice(0, 16);
  }

  function showLoading(payload) {
    button.disabled = true;
    button.classList.add('is-loading');
    button.innerHTML = 'Cerco voli reali… <span>⌛</span>';
    $('#resultTitle').textContent = `${payload.origin} → ${payload.destination}`;
    $('#resultContent').innerHTML = payload.destinationType === 'country'
      ? '<article class="result-card"><div class="notice"><strong>Preparo gli aeroporti del Paese…</strong><br>Fly2 cercherà separatamente ogni aeroporto e confronterà le fonti disponibili.</div></article>'
      : '<article class="result-card"><div class="notice"><strong>Ricerca in corso…</strong><br>Fly2 sta interrogando Kiwi tramite il Worker Cloudflare.</div></article>';
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
