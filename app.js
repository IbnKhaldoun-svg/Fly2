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

const state = {
  trip: 'roundtrip',
  mode: 'precise',
  origin: null,
  destination: null,
  anywhere: false,
  flexKinds: { out: 'plusminus', in: 'plusminus' },
  passengers: { adults: 1, children: 0, infantsSeat: 0, infantsLap: 0 },
  airlineInclude: [],
  airlineExclude: []
};

const typeLabels = { city: 'Città', airport: 'Aeroporto', country: 'Paese' };
const typeIcons = { city: '●', airport: '✈', country: '◒' };

function init() {
  setDefaultDates();
  bind();
  renderPassengerRows();
  setFlexKind('out', 'plusminus');
  setFlexKind('in', 'plusminus');
  renderAirlineTags('include');
  renderAirlineTags('exclude');
}

function bind() {
  $$('.segment').forEach(button => button.addEventListener('click', () => setTrip(button.dataset.trip)));
  $$('.chip').forEach(button => button.addEventListener('click', () => setMode(button.dataset.mode)));

  bindLocation('origin', 'originSuggestions');
  bindLocation('destination', 'destinationSuggestions');

  $('#anywhereToggle').addEventListener('change', handleAnywhere);

  $('#swap').addEventListener('click', () => {
    if (state.anywhere) return;
    const origin = state.origin;
    const destination = state.destination;
    state.origin = destination;
    state.destination = origin;
    $('#origin').value = destination?.name || '';
    $('#destination').value = origin?.name || '';
  });

  $$('[data-clear]').forEach(button => button.addEventListener('click', () => {
    const id = button.dataset.clear;
    if (id === 'destination' && state.anywhere) {
      $('#anywhereToggle').checked = false;
      handleAnywhere();
      return;
    }
    $('#' + id).value = '';
    state[id] = null;
    $('#' + id + 'Suggestions')?.classList.add('hidden');
  }));

  $('#advancedToggle').addEventListener('click', () => {
    const panel = $('#advancedPanel');
    const hidden = panel.classList.toggle('hidden');
    $('#advancedToggle').setAttribute('aria-expanded', String(!hidden));
    $('.advanced-entry-arrow').textContent = hidden ? '›' : '⌄';
  });

  $('#passengerButton').addEventListener('click', openPassengers);
  $('#closePassengers').addEventListener('click', closePassengers);
  $('#passengerDone').addEventListener('click', closePassengers);
  $('#sheetBackdrop').addEventListener('click', closePassengers);

  $('#searchButton').addEventListener('click', runSearch);
  $('#openHelp').addEventListener('click', () => $('#helpModal').classList.remove('hidden'));
  $$('[data-close-modal]').forEach(button => button.addEventListener('click', () => $('#helpModal').classList.add('hidden')));
  $('#helpModal').addEventListener('click', event => {
    if (event.target.id === 'helpModal') event.currentTarget.classList.add('hidden');
  });

  $('#departureDate').addEventListener('change', () => {
    if ($('#returnDate').value < $('#departureDate').value) $('#returnDate').value = $('#departureDate').value;
    $('#returnDate').min = $('#departureDate').value;
  });

  $$('[data-flex-kind]').forEach(button => button.addEventListener('click', () => {
    setFlexKind(button.dataset.flexLeg, button.dataset.flexKind);
  }));

  bindRange('flexOutFrom', 'flexOutTo');
  bindRange('flexInFrom', 'flexInTo');
  bindAirlineInput('airlineIncludeInput', 'airlineIncludeSuggestions', 'include');
  bindAirlineInput('airlineExcludeInput', 'airlineExcludeSuggestions', 'exclude');

  document.addEventListener('click', event => {
    if (!event.target.closest('.location-field')) $$('.suggestions').forEach(el => el.classList.add('hidden'));
    if (!event.target.closest('.tag-input-wrap')) $$('.airline-suggestions').forEach(el => el.classList.add('hidden'));
  });
}

function setDefaultDates() {
  const today = new Date();
  const departure = addDays(today, 7);
  const returnDate = addDays(departure, 3);

  $('#departureDate').value = dateInput(departure);
  $('#departureDate').min = dateInput(today);
  $('#returnDate').value = dateInput(returnDate);
  $('#returnDate').min = dateInput(departure);

  const dateValues = {
    flexOutExact: departure,
    flexOutBase: departure,
    flexOutFrom: departure,
    flexOutTo: addDays(departure, 10),
    flexInExact: returnDate,
    flexInBase: returnDate,
    flexInFrom: returnDate,
    flexInTo: addDays(returnDate, 10)
  };

  Object.entries(dateValues).forEach(([id, date]) => {
    $('#' + id).value = dateInput(date);
    $('#' + id).min = dateInput(today);
  });
}

function setTrip(value) {
  state.trip = value;
  $$('.segment').forEach(button => button.classList.toggle('active', button.dataset.trip === value));
  $$('.return-control').forEach(el => el.classList.toggle('hidden', value === 'oneway'));
  $$('.roundtrip-only').forEach(el => el.classList.toggle('hidden', value === 'oneway'));
}

function setMode(value) {
  state.mode = value;
  $$('.chip').forEach(button => button.classList.toggle('active', button.dataset.mode === value));
  ['precise', 'flexible', 'cheapest', 'weekend'].forEach(mode => {
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
  const clear = $('[data-clear="destination"]');
  input.disabled = checked;
  clear.disabled = checked;
  $('#destinationWrap').classList.toggle('disabled', checked);
  $('#swap').disabled = checked;
  $('#swap').classList.toggle('disabled', checked);
  $('#destinationSuggestions').classList.add('hidden');
  input.value = checked ? 'Ovunque' : '';
}

function bindLocation(id, suggestionsId) {
  const input = $('#' + id);
  const box = $('#' + suggestionsId);

  input.addEventListener('input', () => {
    state[id] = null;
    const query = norm(input.value);
    if (!query) {
      box.classList.add('hidden');
      return;
    }

    const matches = places
      .filter(place => norm([place.name, place.country, place.iata, place.airport, place.city].filter(Boolean).join(' ')).includes(query))
      .slice(0, 8);

    box.innerHTML = matches.length
      ? matches.map((place, index) => `
        <button class="suggestion" type="button" data-i="${index}">
          <span class="type-icon">${typeIcons[place.type]}</span>
          <span><strong>${esc(place.name)}${place.iata ? ` · ${esc(place.iata)}` : ''}</strong><small>${typeLabels[place.type]}${place.country ? ` · ${esc(place.country)}` : ''}${place.airport && place.type === 'city' ? ` · ${esc(place.airport)}` : ''}</small></span>
        </button>`).join('')
      : '<div class="suggestion empty-suggestion"><span><strong>Nessun suggerimento locale</strong><small>Il dataset globale verrà aggiunto insieme alla sorgente dati reale.</small></span></div>';

    box.classList.remove('hidden');
    $$('.suggestion[data-i]', box).forEach(button => button.addEventListener('click', () => {
      const place = matches[Number(button.dataset.i)];
      state[id] = place;
      input.value = place.name;
      box.classList.add('hidden');
    }));
  });

  input.addEventListener('focus', () => {
    if (input.value) input.dispatchEvent(new Event('input'));
  });
}

function bindRange(fromId, toId) {
  const from = $('#' + fromId);
  const to = $('#' + toId);
  from.addEventListener('change', () => {
    to.min = from.value;
    if (to.value && to.value < from.value) to.value = from.value;
  });
}

function bindAirlineInput(inputId, suggestionsId, key) {
  const input = $('#' + inputId);
  const suggestions = $('#' + suggestionsId);

  const updateSuggestions = () => {
    const query = norm(input.value);
    if (!query) {
      suggestions.classList.add('hidden');
      return [];
    }

    const selected = key === 'include' ? state.airlineInclude : state.airlineExclude;
    const matches = airlines.filter(name => norm(name).includes(query) && !selected.includes(name)).slice(0, 7);
    suggestions.innerHTML = matches.length
      ? matches.map((name, index) => `<button type="button" data-airline-i="${index}">${esc(name)}</button>`).join('')
      : '<div class="airline-empty">Nessuna compagnia trovata</div>';
    suggestions.classList.remove('hidden');

    $$('[data-airline-i]', suggestions).forEach(button => button.addEventListener('click', () => {
      addAirline(key, matches[Number(button.dataset.airlineI)]);
      input.value = '';
      suggestions.classList.add('hidden');
    }));
    return matches;
  };

  input.addEventListener('input', updateSuggestions);
  input.addEventListener('focus', updateSuggestions);
  input.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    const matches = updateSuggestions();
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
  const conflictIndex = other.indexOf(name);
  if (conflictIndex >= 0) other.splice(conflictIndex, 1);
  renderAirlineTags('include');
  renderAirlineTags('exclude');
}

function renderAirlineTags(key) {
  const list = key === 'include' ? state.airlineInclude : state.airlineExclude;
  const container = $('#' + (key === 'include' ? 'airlineIncludeChips' : 'airlineExcludeChips'));
  container.innerHTML = list.map((name, index) => `<span class="tag"><span>${esc(name)}</span><button type="button" data-remove-airline="${key}" data-index="${index}" aria-label="Rimuovi ${esc(name)}">×</button></span>`).join('');
  $$('[data-remove-airline]', container).forEach(button => button.addEventListener('click', () => {
    const target = button.dataset.removeAirline === 'include' ? state.airlineInclude : state.airlineExclude;
    target.splice(Number(button.dataset.index), 1);
    renderAirlineTags(button.dataset.removeAirline);
  }));
}

function openPassengers() {
  $('#sheetBackdrop').classList.remove('hidden');
  $('#passengerSheet').classList.remove('hidden');
}

function closePassengers() {
  $('#sheetBackdrop').classList.add('hidden');
  $('#passengerSheet').classList.add('hidden');
  updatePassengerSummary();
}

function renderPassengerRows() {
  const rows = [
    ['adults', 'Adulti', '12+ anni'],
    ['children', 'Bambini', '2–11 anni'],
    ['infantsSeat', 'Neonati con posto', 'Meno di 2 anni'],
    ['infantsLap', 'Neonati in braccio', 'Meno di 2 anni']
  ];

  $('#passengerRows').innerHTML = rows.map(([key, label, sub]) => `
    <div class="counter-row">
      <div><strong>${label}</strong><small>${sub}</small></div>
      <div class="counter"><button type="button" data-k="${key}" data-d="-1">−</button><strong id="count-${key}">${state.passengers[key]}</strong><button type="button" data-k="${key}" data-d="1">+</button></div>
    </div>`).join('');

  $$('.counter button').forEach(button => button.addEventListener('click', () => {
    const key = button.dataset.k;
    const delta = Number(button.dataset.d);
    const minimum = key === 'adults' ? 1 : 0;
    state.passengers[key] = Math.max(minimum, state.passengers[key] + delta);
    $('#count-' + key).textContent = state.passengers[key];
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

  if (!origin || !destination) {
    showResult('Manca una località', state.anywhere ? 'Scegli la partenza dai suggerimenti.' : 'Scegli partenza e destinazione dai suggerimenti per evitare ambiguità.');
    return;
  }
  if (destination.type !== 'anywhere' && origin.name === destination.name) {
    showResult('Controlla la rotta', 'Partenza e destinazione devono essere diverse.');
    return;
  }

  state.origin = origin;
  state.destination = destination;
  const detail = [];

  if (state.mode === 'precise') {
    detail.push(`Andata: ${prettyDate($('#departureDate').value)}`);
    if (state.trip === 'roundtrip') detail.push(`Ritorno: ${prettyDate($('#returnDate').value)}`);
  }

  if (state.mode === 'flexible') {
    detail.push(`Andata: ${flexSummary('out')}`);
    if (state.trip === 'roundtrip') detail.push(`Ritorno: ${flexSummary('in')}`);
  }

  if (state.mode === 'cheapest') detail.push(`${$('#nights').value} notti · entro ${$('#horizon').selectedOptions[0].textContent}`);
  if (state.mode === 'weekend') detail.push(`${$('#weekendOut').value} dopo le ${$('#weekendOutTime').value}${state.trip === 'roundtrip' ? ` · ritorno ${$('#weekendBack').value.toLowerCase()} verso le ${$('#weekendBackTime').value}` : ''}`);

  detail.push($('#stops').selectedOptions[0].textContent);
  detail.push($('#passengerSummary').textContent);

  const strategy = $('input[name="airlineStrategy"]:checked')?.value || 'any';
  if (state.trip === 'roundtrip' && strategy === 'same') detail.push('Stessa compagnia A/R');
  if (state.trip === 'roundtrip' && strategy === 'different') detail.push('Compagnie diverse consentite');
  if (state.airlineInclude.length) detail.push(`Preferite: ${state.airlineInclude.join(', ')}`);
  if (state.airlineExclude.length) detail.push(`Escluse: ${state.airlineExclude.join(', ')}`);
  if ($('#avoidCountries').value.trim()) detail.push(`Evita scali in: ${$('#avoidCountries').value.trim()}`);

  const countryNote = destination.type === 'country'
    ? `Prima dei voli, Fly2 dovrà individuare le città realmente raggiungibili in ${esc(destination.name)} nelle condizioni selezionate.`
    : '';
  const anywhereNote = destination.type === 'anywhere'
    ? 'Con “Ovunque”, Fly2 dovrà confrontare soltanto destinazioni realmente disponibili nelle condizioni selezionate.'
    : '';

  $('#resultTitle').textContent = `${origin.name} → ${destination.name}`;
  $('#resultSortWrap').classList.add('hidden');
  $('#resultContent').innerHTML = `
    <article class="result-card">
      <div class="summary-route">
        <div><strong>${esc(origin.name)} → ${esc(destination.name)}</strong><span>${state.trip === 'roundtrip' ? 'Andata e ritorno' : 'Solo andata'} · ${labelMode(state.mode)}</span></div>
        <span>${origin.iata || ''}${origin.iata && destination.iata ? ' → ' : ''}${destination.iata || ''}</span>
      </div>
      <div class="selection-list">${detail.map(item => `<span>${esc(item)}</span>`).join('')}</div>
      ${countryNote || anywhereNote ? `<div class="notice">${countryNote || anywhereNote}</div>` : ''}
      <div class="notice"><strong>Nessun prezzo mostrato.</strong><br>La ricerca è configurata, ma non è ancora collegata una sorgente gratuita affidabile per prezzi e disponibilità reali. L'ordinamento comparirà qui, sopra i risultati, quando esisterà una lista reale da ordinare.</div>
    </article>`;

  $('#resultSection').classList.remove('hidden');
  $('#resultSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function flexSummary(leg) {
  const kind = state.flexKinds[leg];
  const prefix = leg === 'out' ? 'flexOut' : 'flexIn';
  if (kind === 'exact') return prettyDate($('#' + prefix + 'Exact').value);
  if (kind === 'plusminus') return `${prettyDate($('#' + prefix + 'Base').value)} ± ${$('#' + prefix + 'Days').value} giorni`;
  return `dal ${prettyDate($('#' + prefix + 'From').value)} al ${prettyDate($('#' + prefix + 'To').value)}`;
}

function showResult(title, message) {
  $('#resultTitle').textContent = title;
  $('#resultSortWrap').classList.add('hidden');
  $('#resultContent').innerHTML = `<article class="result-card"><div class="notice">${esc(message)}</div></article>`;
  $('#resultSection').classList.remove('hidden');
  $('#resultSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function findTyped(value) {
  const query = norm(value);
  return places.find(place => norm(place.name) === query || norm(place.iata || '') === query) || null;
}

function labelMode(mode) {
  if (mode === 'precise') return 'Date precise';
  if (mode === 'flexible') return 'Date flessibili';
  if (mode === 'cheapest') return 'Periodo più economico';
  return 'Weekend';
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function dateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
