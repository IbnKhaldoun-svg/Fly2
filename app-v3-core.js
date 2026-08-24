const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const places = [
  { type: 'city', name: 'Bologna', country: 'Italia', iata: 'BLQ', airport: 'Aeroporto Guglielmo Marconi di Bologna' },
  { type: 'airport', name: 'Aeroporto di Bologna', country: 'Italia', iata: 'BLQ', city: 'Bologna' },
  { type: 'city', name: 'Milano', country: 'Italia', iata: 'MIL', airport: 'Milano (tutti gli aeroporti)' },
  { type: 'airport', name: 'Milano Malpensa', country: 'Italia', iata: 'MXP', city: 'Milano' },
  { type: 'airport', name: 'Milano Bergamo', country: 'Italia', iata: 'BGY', city: 'Milano / Bergamo' },
  { type: 'airport', name: 'Milano Linate', country: 'Italia', iata: 'LIN', city: 'Milano' },
  { type: 'city', name: 'Roma', country: 'Italia', iata: 'ROM', airport: 'Roma (tutti gli aeroporti)' },
  { type: 'airport', name: 'Roma Fiumicino', country: 'Italia', iata: 'FCO', city: 'Roma' },
  { type: 'city', name: 'Barcellona', country: 'Spagna', iata: 'BCN', airport: 'Aeroporto Josep Tarradellas Barcelona-El Prat' },
  { type: 'airport', name: 'Barcellona El Prat', country: 'Spagna', iata: 'BCN', city: 'Barcellona' },
  { type: 'city', name: 'Madrid', country: 'Spagna', iata: 'MAD', airport: 'Adolfo Suárez Madrid-Barajas' },
  { type: 'city', name: 'Agadir', country: 'Marocco', iata: 'AGA', airport: 'Aeroporto di Agadir-Al Massira' },
  { type: 'city', name: 'Marrakech', country: 'Marocco', iata: 'RAK', airport: 'Aeroporto di Marrakech-Menara' },
  { type: 'city', name: 'Casablanca', country: 'Marocco', iata: 'CMN', airport: 'Aeroporto Mohammed V' },
  { type: 'country', name: 'Marocco', country: 'Marocco' },
  { type: 'country', name: 'Spagna', country: 'Spagna' },
  { type: 'country', name: 'Italia', country: 'Italia' }
];

const airlines = [
  'Ryanair', 'easyJet', 'Wizz Air', 'Vueling', 'Volotea', 'ITA Airways', 'Lufthansa',
  'Air France', 'KLM', 'Iberia', 'British Airways', 'TAP Air Portugal', 'Turkish Airlines',
  'Royal Air Maroc', 'Air Arabia Maroc', 'Transavia', 'Eurowings', 'SWISS', 'Austrian Airlines',
  'Norwegian', 'Pegasus Airlines', 'Brussels Airlines'
];

const countries = [
  'Albania', 'Austria', 'Belgio', 'Bulgaria', 'Cipro', 'Croazia', 'Danimarca', 'Egitto',
  'Emirati Arabi Uniti', 'Finlandia', 'Francia', 'Germania', 'Grecia', 'Irlanda', 'Islanda',
  'Italia', 'Marocco', 'Malta', 'Norvegia', 'Paesi Bassi', 'Polonia', 'Portogallo', 'Qatar',
  'Regno Unito', 'Repubblica Ceca', 'Romania', 'Serbia', 'Spagna', 'Svezia', 'Svizzera',
  'Tunisia', 'Turchia', 'Ungheria'
];

const state = {
  trip: 'roundtrip',
  mode: 'flexible',
  origin: null,
  destination: null,
  anywhere: false,
  flexKinds: { out: 'exact', in: 'exact' },
  passengers: { adults: 1, children: 0, infantsSeat: 0, infantsLap: 0 },
  airlineInclude: [],
  airlineExclude: [],
  avoidCountries: []
};

let passengerDraft = null;

const typeLabels = { city: 'Città', airport: 'Aeroporto', country: 'Paese' };
const typeIcons = { city: '●', airport: '✈', country: '◒' };

function init() {
  setDefaultDates();
  bind();
  setFlexKind('out', 'exact');
  setFlexKind('in', 'exact');
  renderTags('include');
  renderTags('exclude');
  renderCountryTags();
  updatePassengerSummary();
  setTrip('roundtrip');
  setMode('flexible');
  updateSegmentCarrierVisibility();
}

function bind() {
  $$('.segment').forEach(button => button.addEventListener('click', () => setTrip(button.dataset.trip)));
  $$('.chip').forEach(button => button.addEventListener('click', () => setMode(button.dataset.mode)));
  bindLocation('origin', 'originSuggestions');
  bindLocation('destination', 'destinationSuggestions');

  $('#anywhereToggle').addEventListener('change', handleAnywhere);
  $('#swap').addEventListener('click', () => {
    if (state.anywhere) return;
    const oldOrigin = state.origin;
    state.origin = state.destination;
    state.destination = oldOrigin;
    $('#origin').value = state.origin?.name || '';
    $('#destination').value = state.destination?.name || '';
    syncLocationDataset($('#origin'), state.origin);
    syncLocationDataset($('#destination'), state.destination);
  });

  $$('[data-clear]').forEach(button => button.addEventListener('click', () => {
    const id = button.dataset.clear;
    const field = $('#' + id);
    field.value = '';
    delete field.dataset.locationType;
    delete field.dataset.locationIata;
    delete field.dataset.locationCountry;
    state[id] = null;
    $('#' + id + 'Suggestions')?.classList.add('hidden');
  }));

  $$('[data-flex-kind]').forEach(button => button.addEventListener('click', () => {
    setFlexKind(button.dataset.flexLeg, button.dataset.flexKind);
  }));
  bindRange('flexOutFrom', 'flexOutTo');
  bindRange('flexInFrom', 'flexInTo');

  $('#nights').addEventListener('change', clampNights);
  $('#nights').addEventListener('blur', clampNights);
  $('#stops').addEventListener('change', updateSegmentCarrierVisibility);

  $('#advancedToggle').addEventListener('click', () => {
    const panel = $('#advancedPanel');
    const hidden = panel.classList.toggle('hidden');
    $('#advancedToggle').setAttribute('aria-expanded', String(!hidden));
    $('.advanced-entry-arrow').textContent = hidden ? '›' : '⌄';
  });

  bindAirlineInput('airlineIncludeInput', 'airlineIncludeSuggestions', 'include');
  bindAirlineInput('airlineExcludeInput', 'airlineExcludeSuggestions', 'exclude');
  bindCountryInput();

  $('#passengerButton').addEventListener('click', openPassengers);
  $('#closePassengers').addEventListener('click', cancelPassengers);
  $('#passengerCancel').addEventListener('click', cancelPassengers);
  $('#passengerConfirm').addEventListener('click', confirmPassengers);
  $('#sheetBackdrop').addEventListener('click', cancelPassengers);

  $('#searchButton').addEventListener('click', runSearch);
  $('#openHelp').addEventListener('click', () => $('#helpModal').classList.remove('hidden'));
  $$('[data-close-modal]').forEach(button => button.addEventListener('click', () => $('#helpModal').classList.add('hidden')));
  $('#helpModal').addEventListener('click', event => {
    if (event.target.id === 'helpModal') event.currentTarget.classList.add('hidden');
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !$('#passengerSheet').classList.contains('hidden')) cancelPassengers();
  });

  document.addEventListener('click', event => {
    if (!event.target.closest('.location-field')) $$('.suggestions').forEach(el => el.classList.add('hidden'));
    if (!event.target.closest('.tag-input-wrap')) $$('.smart-suggestions').forEach(el => el.classList.add('hidden'));
  });
}

function setDefaultDates() {
  const today = new Date();
  const departure = addDays(today, 7);
  const returnDate = addDays(departure, 3);
  const values = {
    flexOutExact: departure,
    flexOutBase: departure,
    flexOutFrom: departure,
    flexOutTo: addDays(departure, 10),
    flexInExact: returnDate,
    flexInBase: returnDate,
    flexInFrom: returnDate,
    flexInTo: addDays(returnDate, 10)
  };

  Object.entries(values).forEach(([id, date]) => {
    $('#' + id).value = dateInput(date);
    $('#' + id).min = dateInput(today);
  });
}

function setTrip(value) {
  state.trip = value;
  $$('.segment').forEach(button => button.classList.toggle('active', button.dataset.trip === value));
  const oneWay = value === 'oneway';
  $$('.return-control').forEach(el => el.classList.toggle('hidden', oneWay));
  $$('.roundtrip-only').forEach(el => el.classList.toggle('hidden', oneWay));
  $$('.roundtrip-date-mode').forEach(el => el.classList.toggle('hidden', oneWay));
  $('#flexibleIntro').textContent = oneWay
    ? 'Scegli una data precisa, una data con tolleranza di alcuni giorni oppure un intervallo.'
    : 'Andata e ritorno possono avere regole diverse: data precisa, tolleranza di alcuni giorni oppure intervallo.';
  if (oneWay && state.mode !== 'flexible') setMode('flexible');
  updateSegmentCarrierVisibility();
}

function setMode(value) {
  if (state.trip === 'oneway' && value !== 'flexible') value = 'flexible';
  state.mode = value;
  $$('.chip').forEach(button => button.classList.toggle('active', button.dataset.mode === value));
  ['flexible', 'cheapest', 'weekend'].forEach(mode => {
    $('#' + mode + 'Panel').classList.toggle('hidden', mode !== value);
  });
}

function setFlexKind(leg, kind) {
  state.flexKinds[leg] = kind;
  $$(`[data-flex-leg="${leg}"]`).forEach(button => button.classList.toggle('active', button.dataset.flexKind === kind));
  ['exact', 'plusminus', 'range'].forEach(candidate => {
    $(`[data-flex-panel="${leg}-${candidate}"]`).classList.toggle('hidden', candidate !== kind);
  });
}

function handleAnywhere() {
  const checked = $('#anywhereToggle').checked;
  state.anywhere = checked;
  state.destination = checked ? { type: 'anywhere', name: 'Ovunque' } : null;
  const input = $('#destination');
  input.disabled = checked;
  $('[data-clear="destination"]').disabled = checked;
  $('#destinationWrap').classList.toggle('disabled', checked);
  $('#swap').disabled = checked;
  $('#swap').classList.toggle('disabled', checked);
  $('#destinationSuggestions').classList.add('hidden');
  input.value = checked ? 'Ovunque' : '';
}

function syncLocationDataset(input, place) {
  if (!input) return;
  if (!place) {
    delete input.dataset.locationType;
    delete input.dataset.locationIata;
    delete input.dataset.locationCountry;
    return;
  }
  input.dataset.locationType = place.type || '';
  if (place.iata) input.dataset.locationIata = place.iata;
  else delete input.dataset.locationIata;
  input.dataset.locationCountry = place.country || '';
}

function bindLocation(id, suggestionsId) {
  const input = $('#' + id);
  const box = $('#' + suggestionsId);
  const update = (event) => {
    if (event?.type === 'input') {
      state[id] = null;
      delete input.dataset.locationType;
      delete input.dataset.locationIata;
      delete input.dataset.locationCountry;
    }
    const query = norm(input.value);
    if (!query) {
      box.classList.add('hidden');
      return;
    }
    const matches = places
      .filter(place => norm([place.name, place.country, place.iata, place.airport, place.city].filter(Boolean).join(' ')).includes(query))
      .slice(0, 8);
    box.innerHTML = matches.length
      ? matches.map((place, index) => `<button class="suggestion" type="button" data-i="${index}"><span class="type-icon">${typeIcons[place.type]}</span><span><strong>${esc(place.name)}${place.iata ? ` · ${esc(place.iata)}` : ''}</strong><small>${typeLabels[place.type]}${place.country ? ` · ${esc(place.country)}` : ''}${place.airport && place.type === 'city' ? ` · ${esc(place.airport)}` : ''}</small></span></button>`).join('')
      : '<div class="suggestion empty-suggestion"><span><strong>Nessun suggerimento locale</strong><small>Il dataset globale verrà ampliato insieme alla sorgente voli reale.</small></span></div>';
    box.classList.remove('hidden');
    $$('.suggestion[data-i]', box).forEach(button => button.addEventListener('click', () => {
      const place = matches[Number(button.dataset.i)];
      state[id] = place;
      input.value = place.name;
      input.dataset.locationType = place.type || '';
      if (place.iata) input.dataset.locationIata = place.iata;
      else delete input.dataset.locationIata;
      input.dataset.locationCountry = place.country || '';
      box.classList.add('hidden');
    }));
  };
  input.addEventListener('input', update);
  input.addEventListener('focus', update);
}

function bindRange(fromId, toId) {
  const from = $('#' + fromId);
  const to = $('#' + toId);
  from.addEventListener('change', () => {
    to.min = from.value;
    if (to.value && to.value < from.value) to.value = from.value;
  });
}

function clampNights() {
  const input = $('#nights');
  let value = parseInt(input.value, 10);
  if (!Number.isFinite(value)) value = 1;
  input.value = String(Math.min(15, Math.max(1, value)));
}

function updateSegmentCarrierVisibility() {
  const hasStops = $('#stops')?.value !== '0';
  $('#segmentCarrierFilter')?.classList.toggle('hidden', !hasStops);
  $('#segmentCarrierDirectNote')?.classList.toggle('hidden', hasStops);
}

function bindAirlineInput(inputId, suggestionsId, key) {
  const input = $('#' + inputId);
  const suggestions = $('#' + suggestionsId);
  const update = () => {
    const query = norm(input.value);
    const selected = key === 'include' ? state.airlineInclude : state.airlineExclude;
    const matches = airlines.filter(name => (!query || norm(name).includes(query)) && !selected.includes(name)).slice(0, 8);
    suggestions.innerHTML = matches.length
      ? matches.map((name, index) => `<button type="button" data-smart-i="${index}">${esc(name)}</button>`).join('')
      : '<div class="suggestion-empty">Nessuna compagnia trovata</div>';
    suggestions.classList.remove('hidden');
    $$('[data-smart-i]', suggestions).forEach(button => button.addEventListener('click', () => {
      addAirline(key, matches[Number(button.dataset.smartI)]);
      input.value = '';
      suggestions.classList.add('hidden');
    }));
    return matches;
  };
  input.addEventListener('input', update);
  input.addEventListener('focus', update);
  input.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    const matches = update();
    if (!matches.length) return;
    event.preventDefault();
    addAirline(key, matches[0]);
    input.value = '';
    suggestions.classList.add('hidden');
  });
}

function addAirline(key, name) {
  const target = key === 'include' ? state.airlineInclude : state.airlineExclude;
  const other = key === 'include' ? state.airlineExclude : state.airlineInclude;
  if (!target.includes(name)) target.push(name);
  const conflict = other.indexOf(name);
  if (conflict >= 0) other.splice(conflict, 1);
  renderTags('include');
  renderTags('exclude');
}

function renderTags(key) {
  const list = key === 'include' ? state.airlineInclude : state.airlineExclude;
  const container = $('#' + (key === 'include' ? 'airlineIncludeChips' : 'airlineExcludeChips'));
  container.innerHTML = list.map((name, index) => `<span class="tag"><span>${esc(name)}</span><button type="button" data-remove-tag="${key}" data-index="${index}" aria-label="Rimuovi ${esc(name)}">×</button></span>`).join('');
  $$('[data-remove-tag]', container).forEach(button => button.addEventListener('click', () => {
    const target = button.dataset.removeTag === 'include' ? state.airlineInclude : state.airlineExclude;
    target.splice(Number(button.dataset.index), 1);
    renderTags(button.dataset.removeTag);
  }));
}

function bindCountryInput() {
  const input = $('#avoidCountriesInput');
  const suggestions = $('#avoidCountrySuggestions');
  const update = () => {
    const query = norm(input.value);
    const matches = countries.filter(name => (!query || norm(name).includes(query)) && !state.avoidCountries.includes(name)).slice(0, 8);
    suggestions.innerHTML = matches.length
      ? matches.map((name, index) => `<button type="button" data-country-i="${index}">${esc(name)}</button>`).join('')
      : '<div class="suggestion-empty">Nessun Paese trovato</div>';
    suggestions.classList.remove('hidden');
    $$('[data-country-i]', suggestions).forEach(button => button.addEventListener('click', () => {
      addCountry(matches[Number(button.dataset.countryI)]);
      input.value = '';
      suggestions.classList.add('hidden');
    }));
    return matches;
  };
  input.addEventListener('input', update);
  input.addEventListener('focus', update);
  input.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    const matches = update();
    if (!matches.length) return;
    event.preventDefault();
    addCountry(matches[0]);
    input.value = '';
    suggestions.classList.add('hidden');
  });
}

function addCountry(name) {
  if (!state.avoidCountries.includes(name)) state.avoidCountries.push(name);
  renderCountryTags();
}

function renderCountryTags() {
  const container = $('#avoidCountryChips');
  container.innerHTML = state.avoidCountries.map((name, index) => `<span class="tag"><span>${esc(name)}</span><button type="button" data-remove-country="${index}" aria-label="Rimuovi ${esc(name)}">×</button></span>`).join('');
  $$('[data-remove-country]', container).forEach(button => button.addEventListener('click', () => {
    state.avoidCountries.splice(Number(button.dataset.removeCountry), 1);
    renderCountryTags();
  }));
}

function openPassengers() {
  passengerDraft = { ...state.passengers };
  renderPassengerRows();
  $('#sheetBackdrop').classList.remove('hidden');
  $('#passengerSheet').classList.remove('hidden');
}

function hidePassengerSheet() {
  $('#sheetBackdrop').classList.add('hidden');
  $('#passengerSheet').classList.add('hidden');
}

function cancelPassengers() {
  passengerDraft = null;
  hidePassengerSheet();
}

function confirmPassengers() {
  if (passengerDraft) state.passengers = { ...passengerDraft };
  passengerDraft = null;
  updatePassengerSummary();
  hidePassengerSheet();
}

function renderPassengerRows() {
  const source = passengerDraft || state.passengers;
  const rows = [
    ['adults', 'Adulti', '12+ anni'],
    ['children', 'Bambini', '2–11 anni'],
    ['infantsSeat', 'Neonati con posto', 'Meno di 2 anni'],
    ['infantsLap', 'Neonati in braccio', 'Meno di 2 anni']
  ];
  $('#passengerRows').innerHTML = rows.map(([key, label, sub]) => `<div class="counter-row"><div><strong>${label}</strong><small>${sub}</small></div><div class="counter"><button type="button" data-k="${key}" data-d="-1" aria-label="Riduci ${label}">−</button><strong id="count-${key}">${source[key]}</strong><button type="button" data-k="${key}" data-d="1" aria-label="Aumenta ${label}">+</button></div></div>`).join('');
  $$('.counter button').forEach(button => button.addEventListener('click', () => {
    if (!passengerDraft) return;
    const key = button.dataset.k;
    const min = key === 'adults' ? 1 : 0;
    passengerDraft[key] = Math.max(min, passengerDraft[key] + Number(button.dataset.d));
    $('#count-' + key).textContent = passengerDraft[key];
  }));
}

function updatePassengerSummary() {
  const p = state.passengers;
  const total = p.adults + p.children + p.infantsSeat + p.infantsLap;
  $('#passengerSummary').textContent = total === 1 ? '1 adulto' : `${total} passeggeri`;
}

function runSearch() {
  const origin = state.origin || findTyped($('#origin').value);
  const destination = state.anywhere ? { type: 'anywhere', name: 'Ovunque' } : (state.destination || findTyped($('#destination').value));
  if (!origin || !destination) return showResult('Manca una località', 'Scegli partenza e destinazione dai suggerimenti per evitare ambiguità.');
  if (origin.name === destination.name) return showResult('Controlla la rotta', 'Partenza e destinazione devono essere diverse.');

  const detail = [];
  if (state.mode === 'flexible') {
    detail.push(`Andata: ${getFlexSummary('out')}`);
    if (state.trip === 'roundtrip') detail.push(`Ritorno: ${getFlexSummary('in')}`);
  } else if (state.mode === 'cheapest') {
    clampNights();
    detail.push(`${$('#nights').value} notti · entro ${$('#horizon').selectedOptions[0].textContent}`);
  } else {
    detail.push(`${$('#weekendOut').value} dopo le ${$('#weekendOutTime').value} · ritorno ${$('#weekendBack').value.toLowerCase()} verso le ${$('#weekendBackTime').value}`);
  }

  detail.push($('#stops').selectedOptions[0].textContent, $('#passengerSummary').textContent);

  if ($('#stops').value !== '0') {
    const outPolicy = document.querySelector('input[name="outSegmentCarrier"]:checked')?.value || 'any';
    const inPolicy = document.querySelector('input[name="inSegmentCarrier"]:checked')?.value || 'any';
    if (outPolicy === 'same') detail.push('Andata: stessa compagnia in tutti i segmenti');
    if (state.trip === 'roundtrip' && inPolicy === 'same') detail.push('Ritorno: stessa compagnia in tutti i segmenti');
  }

  if (state.airlineInclude.length) detail.push(`Compagnie preferite: ${state.airlineInclude.join(', ')}`);
  if (state.airlineExclude.length) detail.push(`Compagnie escluse: ${state.airlineExclude.join(', ')}`);
  if (state.avoidCountries.length) detail.push(`No scali: ${state.avoidCountries.join(', ')}`);

  $('#resultTitle').textContent = `${origin.name} → ${destination.name}`;
  const note = destination.type === 'country'
    ? `Prima di mostrare voli, Fly2 dovrà individuare le città realmente raggiungibili in ${esc(destination.name)} nelle condizioni selezionate.`
    : destination.type === 'anywhere'
      ? 'Con “Ovunque”, Fly2 confronterà soltanto destinazioni realmente disponibili quando sarà collegata la sorgente dati.'
      : '';

  $('#resultContent').innerHTML = `<article class="result-card"><div class="summary-route"><div><strong>${esc(origin.name)} → ${esc(destination.name)}</strong><span>${state.trip === 'roundtrip' ? 'Andata e ritorno' : 'Solo andata'} · ${labelMode(state.mode)}</span></div><span>${origin.iata || ''}${origin.iata && destination.iata ? ' → ' : ''}${destination.iata || ''}</span></div><div class="selection-list">${detail.map(item => `<span>${esc(item)}</span>`).join('')}</div>${note ? `<div class="notice">${note}</div>` : ''}<div class="notice"><strong>Nessun prezzo mostrato.</strong><br>La configurazione della ricerca è pronta, ma Fly2 non è ancora collegata a una sorgente gratuita affidabile per prezzi e disponibilità reali.</div></article>`;
  $('#resultSortWrap').classList.add('hidden');
  $('#resultSection').classList.remove('hidden');
  $('#resultSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function getFlexSummary(leg) {
  const kind = state.flexKinds[leg];
  const prefix = leg === 'out' ? 'flexOut' : 'flexIn';
  if (kind === 'exact') return prettyDate($('#' + prefix + 'Exact').value);
  if (kind === 'plusminus') return `${prettyDate($('#' + prefix + 'Base').value)} ± ${$('#' + prefix + 'Days').value} giorni`;
  return `${prettyDate($('#' + prefix + 'From').value)} – ${prettyDate($('#' + prefix + 'To').value)}`;
}

function showResult(title, message) {
  $('#resultTitle').textContent = title;
  $('#resultContent').innerHTML = `<article class="result-card"><div class="notice">${esc(message)}</div></article>`;
  $('#resultSortWrap').classList.add('hidden');
  $('#resultSection').classList.remove('hidden');
  $('#resultSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function findTyped(value) {
  const query = norm(value);
  return places.find(place => norm(place.name) === query || norm(place.iata || '') === query) || null;
}

function labelMode(mode) {
  return mode === 'flexible' ? 'Date flessibili' : mode === 'cheapest' ? 'Periodo più economico' : 'Weekend';
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function dateInput(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function prettyDate(value) {
  if (!value) return 'non scelta';
  return new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value + 'T12:00:00'));
}

function norm(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

init();