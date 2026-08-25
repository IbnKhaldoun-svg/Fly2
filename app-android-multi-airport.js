(() => {
  if (!/Fly2Android\//i.test(navigator.userAgent) || window.__fly2MultiAirportInstalled) return;
  window.__fly2MultiAirportInstalled = true;

  const API_URL = 'https://fly2-api.fly2-search.workers.dev/search';
  const $ = (selector, root = document) => root.querySelector(selector);

  const style = document.createElement('style');
  style.id = 'fly2-multi-airport-style';
  style.textContent = `
    html.fly2-native-app .fly2-multi-airport-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:5px 5px 1px;min-height:26px}
    html.fly2-native-app .fly2-multi-airport-row.is-empty{justify-content:flex-end}
    html.fly2-native-app .fly2-multi-airport-chip{appearance:none;border:1px solid rgba(13,102,95,.17);background:#eef7f4;color:#174a44;border-radius:999px;min-height:27px;padding:4px 8px;display:inline-flex;align-items:center;gap:5px;font:inherit;font-size:10px;font-weight:850;box-shadow:0 2px 8px rgba(18,61,56,.05)}
    html.fly2-native-app .fly2-multi-airport-chip b{font-size:10.5px;color:#075e57}
    html.fly2-native-app .fly2-multi-airport-chip span{max-width:88px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    html.fly2-native-app .fly2-multi-airport-chip i{font-style:normal;font-size:14px;line-height:1;color:#66807a}
    html.fly2-native-app .fly2-multi-airport-add{appearance:none;border:1px dashed rgba(13,102,95,.3);background:rgba(255,255,255,.75);color:#0d665f;border-radius:999px;min-height:27px;padding:4px 9px;font:inherit;font-size:10px;font-weight:900;white-space:nowrap}
    html.fly2-native-app .fly2-multi-airport-add:disabled{opacity:.45}
    html.fly2-native-app .fly2-multi-airport-hint{width:100%;font-size:9.5px;color:#6b7d78;padding:1px 3px 0}
    html.fly2-native-app .fly2-multi-progress{margin:5px 10px 8px;padding:8px 11px;border-radius:12px;background:#edf7f4;color:#24514b;font-size:10px;font-weight:800;border:1px solid rgba(13,102,95,.12)}
    html.fly2-native-app .fly2-multi-progress.hidden{display:none!important}
    html.fly2-native-app .route-grid.fly2-has-multi-airports{gap:5px!important}
    @media(max-width:380px){html.fly2-native-app .fly2-multi-airport-chip span{max-width:68px}}
  `;
  document.head.appendChild(style);

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  }

  ready(() => {
    const origin = $('#origin');
    const destination = $('#destination');
    const originBox = $('#originSuggestions');
    const destinationBox = $('#destinationSuggestions');
    const searchButton = $('#searchButton');
    const swapButton = $('#swap');
    const anywhere = $('#anywhereToggle');
    if (!origin || !destination || !originBox || !destinationBox || !searchButton) return;

    const states = {
      origin: { input: origin, box: originBox, items: [], adding: false, snapshot: null },
      destination: { input: destination, box: destinationBox, items: [], adding: false, snapshot: null }
    };

    const networkFetch = window.fetch.bind(window);
    let searchArmed = false;
    let runSerial = 0;

    function datasetCopy(input) {
      return Object.fromEntries(Object.entries(input.dataset || {}));
    }

    function clearLocationDataset(input) {
      Object.keys(input.dataset || {}).forEach(key => {
        if (/^location/i.test(key)) delete input.dataset[key];
      });
    }

    function airportFromInput(input) {
      const iata = String(input.dataset.locationIata || '').trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(iata)) return null;
      return { iata, label: input.value.trim() || iata, dataset: datasetCopy(input) };
    }

    function shortName(item) {
      const raw = String(item?.label || item?.iata || '').trim();
      return raw.split(',')[0].replace(/\s*·\s*[A-Z]{3}\s*$/i, '').trim() || item.iata;
    }

    function setInputFromItem(state, item) {
      clearLocationDataset(state.input);
      if (!item) {
        state.input.value = '';
        return;
      }
      state.input.value = item.label;
      Object.entries(item.dataset || {}).forEach(([key, value]) => { state.input.dataset[key] = value; });
      state.input.dataset.locationIata = item.iata;
      if (!state.input.dataset.locationType) state.input.dataset.locationType = 'airport';
    }

    function ensurePrimary(state) {
      if (state.items.length) return;
      const current = airportFromInput(state.input);
      if (current) state.items = [current];
    }

    function restorePrimary(state) {
      setInputFromItem(state, state.items[0] || state.snapshot);
      state.snapshot = null;
      state.adding = false;
      renderState(state);
    }

    function beginAdd(state) {
      ensurePrimary(state);
      if (state.items.length >= 4) return;
      state.snapshot = state.items[0] || airportFromInput(state.input);
      state.adding = true;
      clearLocationDataset(state.input);
      state.input.value = '';
      state.input.placeholder = `Aggiungi aeroporto ${state.items.length + 1} di 4…`;
      state.input.focus();
      state.input.dispatchEvent(new Event('input', { bubbles: true }));
      renderState(state);
    }

    function removeItem(state, iata) {
      state.items = state.items.filter(item => item.iata !== iata);
      setInputFromItem(state, state.items[0] || null);
      state.adding = false;
      state.snapshot = null;
      renderState(state);
    }

    function makeRow(which) {
      const state = states[which];
      const field = state.input.closest('.location-field');
      if (!field) return;
      const row = document.createElement('div');
      row.className = 'fly2-multi-airport-row is-empty';
      row.dataset.multiAirport = which;
      field.appendChild(row);
      state.row = row;
      renderState(state);
    }

    function renderState(state) {
      if (!state.row) return;
      state.row.innerHTML = '';
      state.row.classList.toggle('is-empty', !state.items.length);

      state.items.forEach(item => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'fly2-multi-airport-chip';
        chip.setAttribute('aria-label', `Rimuovi ${shortName(item)} ${item.iata}`);
        chip.innerHTML = `<b>${item.iata}</b><span>${escapeHtml(shortName(item))}</span><i>×</i>`;
        chip.addEventListener('click', () => removeItem(state, item.iata));
        state.row.appendChild(chip);
      });

      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'fly2-multi-airport-add';
      add.disabled = state.items.length >= 4 || (state === states.destination && anywhere?.checked);
      add.textContent = state.adding ? 'Seleziona un aeroporto…' : state.items.length ? `+ Aggiungi · ${state.items.length}/4` : '+ Più aeroporti';
      add.addEventListener('click', () => beginAdd(state));
      state.row.appendChild(add);

      if (state.adding) {
        const hint = document.createElement('div');
        hint.className = 'fly2-multi-airport-hint';
        hint.textContent = 'Cerca e tocca un aeroporto nei suggerimenti. Massimo 4.';
        state.row.appendChild(hint);
      }
    }

    function captureSuggestion(which) {
      const state = states[which];
      window.setTimeout(() => {
        const selected = airportFromInput(state.input);
        if (!selected) {
          if (state.adding) restorePrimary(state);
          else {
            state.items = [];
            renderState(state);
          }
          return;
        }

        if (state.adding) {
          if (!state.items.some(item => item.iata === selected.iata)) state.items.push(selected);
          restorePrimary(state);
        } else {
          state.items = [selected];
          renderState(state);
        }
      }, 30);
    }

    makeRow('origin');
    makeRow('destination');
    $('.route-grid')?.classList.add('fly2-has-multi-airports');

    document.addEventListener('click', event => {
      if (event.target.closest?.('#originSuggestions')) captureSuggestion('origin');
      if (event.target.closest?.('#destinationSuggestions')) captureSuggestion('destination');

      const clear = event.target.closest?.('[data-clear="origin"],[data-clear="destination"]');
      if (clear) {
        const which = clear.dataset.clear;
        const state = states[which];
        if (state) {
          window.setTimeout(() => {
            state.items = [];
            state.adding = false;
            state.snapshot = null;
            renderState(state);
          }, 0);
        }
      }

      if (event.target.closest?.('#searchButton')) {
        [states.origin, states.destination].forEach(state => {
          if (state.adding) restorePrimary(state);
          ensurePrimary(state);
        });
        if (states.origin.items[0]) setInputFromItem(states.origin, states.origin.items[0]);
        if (states.destination.items[0]) setInputFromItem(states.destination, states.destination.items[0]);
        searchArmed = combinationCount() > 1;
        runSerial += 1;
      }
    }, true);

    anywhere?.addEventListener('change', () => {
      if (anywhere.checked) {
        states.destination.items = [];
        states.destination.adding = false;
        states.destination.snapshot = null;
      }
      renderState(states.destination);
    });

    swapButton?.addEventListener('click', () => {
      window.setTimeout(() => {
        ensurePrimary(states.origin);
        ensurePrimary(states.destination);
        const oldOrigin = states.origin.items;
        states.origin.items = states.destination.items;
        states.destination.items = oldOrigin;
        setInputFromItem(states.origin, states.origin.items[0] || null);
        setInputFromItem(states.destination, states.destination.items[0] || null);
        renderState(states.origin);
        renderState(states.destination);
      }, 0);
    });

    function combinationCount() {
      if (anywhere?.checked) return 1;
      const origins = states.origin.items.length || (airportFromInput(origin) ? 1 : 0);
      const destinations = states.destination.items.length || (airportFromInput(destination) ? 1 : 0);
      return Math.max(1, origins * destinations);
    }

    function pairList() {
      ensurePrimary(states.origin);
      ensurePrimary(states.destination);
      if (anywhere?.checked || !states.origin.items.length || !states.destination.items.length) return [];
      const pairs = [];
      states.origin.items.forEach(o => states.destination.items.forEach(d => {
        if (o.iata !== d.iata) pairs.push({ origin: o, destination: d });
      }));
      return pairs;
    }

    function isSearchRequest(resource, init) {
      const url = typeof resource === 'string' ? resource : resource?.url;
      return Boolean(url && String(url).startsWith(API_URL) && String(init?.method || 'GET').toUpperCase() === 'POST');
    }

    window.fetch = function(resource, init) {
      if (!searchArmed || !isSearchRequest(resource, init)) return networkFetch(resource, init);
      searchArmed = false;
      const serial = runSerial;
      let basePayload = null;
      try { basePayload = JSON.parse(init?.body || '{}'); } catch (_) {}
      const primaryPromise = networkFetch(resource, init);
      if (basePayload) {
        primaryPromise.then(() => window.setTimeout(() => runSupplementalPairs(basePayload, serial), 350))
          .catch(() => window.setTimeout(() => runSupplementalPairs(basePayload, serial), 180));
      }
      return primaryPromise;
    };

    async function runSupplementalPairs(basePayload, serial) {
      if (serial !== runSerial) return;
      const pairs = pairList();
      if (pairs.length <= 1) return;

      const primaryOrigin = states.origin.items[0]?.iata;
      const primaryDestination = states.destination.items[0]?.iata;
      const remaining = pairs.filter(pair => !(pair.origin.iata === primaryOrigin && pair.destination.iata === primaryDestination));
      if (!remaining.length) return;

      let completed = 1;
      const total = pairs.length;
      showProgress(completed, total);
      updateTitle();
      let cursor = 0;

      const worker = async () => {
        while (serial === runSerial) {
          const index = cursor++;
          if (index >= remaining.length) return;
          const pair = remaining[index];
          const payload = {
            ...basePayload,
            origin: pair.origin.iata,
            originType: 'airport',
            originIata: pair.origin.iata,
            destination: pair.destination.iata,
            destinationType: 'airport',
            destinationIata: pair.destination.iata,
            destinationCountryCode: ''
          };

          try {
            const response = await networkFetch(API_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            const data = await response.json().catch(() => null);
            const items = data?.ok && Array.isArray(data?.result?.itineraries)
              ? data.result.itineraries.map(item => ({
                  ...item,
                  source: item?.source || 'Kiwi',
                  kiwiBookingUrl: item?.kiwiBookingUrl || item?.bookingUrl || null
                }))
              : [];
            if (items.length && serial === runSerial) {
              window.fly2LiveResultsApi?.mergeExternalResults?.(items);
              updateTitle();
            }
          } catch (_) {
          } finally {
            completed += 1;
            showProgress(completed, total);
          }
        }
      };

      await Promise.all([worker(), worker()]);
      if (serial === runSerial) {
        updateTitle();
        showProgress(total, total, true);
      }
    }

    function routeLabel(items) {
      if (!items.length) return '';
      if (items.length === 1) return shortName(items[0]);
      if (items.length === 2) return `${shortName(items[0])} + ${shortName(items[1])}`;
      return `${shortName(items[0])} +${items.length - 1}`;
    }

    function updateTitle() {
      const title = $('#resultTitle');
      if (!title) return;
      const left = routeLabel(states.origin.items);
      const right = routeLabel(states.destination.items);
      if (left && right) title.textContent = `${left} → ${right}`;
    }

    function ensureProgress() {
      let node = $('#fly2MultiProgress');
      if (node) return node;
      const section = $('#resultSection');
      if (!section) return null;
      node = document.createElement('div');
      node.id = 'fly2MultiProgress';
      node.className = 'fly2-multi-progress hidden';
      const heading = section.querySelector('.results-heading');
      if (heading) heading.insertAdjacentElement('afterend', node);
      else section.prepend(node);
      return node;
    }

    function showProgress(done, total, finished) {
      const node = ensureProgress();
      if (!node) return;
      node.classList.remove('hidden');
      node.textContent = finished
        ? `✓ Controllate ${total} combinazioni di aeroporti`
        : `Cerco tutte le combinazioni · ${done}/${total}`;
      if (finished) window.setTimeout(() => node.classList.add('hidden'), 2600);
    }

    function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
    }

    window.fly2MultiAirport = {
      getOrigins: () => states.origin.items.map(item => ({ ...item })),
      getDestinations: () => states.destination.items.map(item => ({ ...item }))
    };
  });
})();