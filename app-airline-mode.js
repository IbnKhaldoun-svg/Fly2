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

  let mode = 'prefer';
  init();

  function init() {
    const input = $('#airlineIncludeInput');
    const group = input?.closest('.filter-group');
    const title = group?.querySelector('.filter-title');
    const tagWrap = input?.closest('.tag-input-wrap');
    if (!group || !title || !tagWrap) return;

    const modeWrap = document.createElement('div');
    modeWrap.className = 'airline-mode-control';
    modeWrap.innerHTML = `
      <button type="button" class="airline-mode-button active" data-airline-mode="prefer">
        <strong>Preferisci</strong><small>Priorità, senza escludere le altre</small>
      </button>
      <button type="button" class="airline-mode-button" data-airline-mode="only">
        <strong>Solo queste</strong><small>Accetta soltanto le compagnie selezionate</small>
      </button>`;

    title.insertAdjacentElement('afterend', modeWrap);
    title.querySelector('strong').textContent = 'Compagnie';
    const help = title.querySelector('small');
    if (help) help.textContent = 'Scegli se dare priorità alle compagnie selezionate oppure limitare la ricerca soltanto a loro.';

    $$('.airline-mode-button', modeWrap).forEach(button => {
      button.addEventListener('click', () => {
        mode = button.dataset.airlineMode || 'prefer';
        $$('.airline-mode-button', modeWrap).forEach(item => item.classList.toggle('active', item === button));
        group.classList.toggle('airline-only-mode', mode === 'only');
        input.placeholder = mode === 'only' ? 'Aggiungi una compagnia obbligatoria…' : 'Cerca una compagnia…';
      });
    });

    document.addEventListener('click', event => {
      if (!event.target.closest('#searchButton')) return;
      if (mode !== 'only') return;
      const selected = selectedAirlines();
      if (selected.length) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      showSelectionError();
    }, true);

    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (resource, init = {}) => {
      const url = typeof resource === 'string' ? resource : resource?.url;
      const method = String(init?.method || (resource instanceof Request ? resource.method : 'GET')).toUpperCase();
      if (mode === 'only' && url && String(url).startsWith(API_URL) && method === 'POST' && typeof init?.body === 'string') {
        try {
          const payload = JSON.parse(init.body);
          const codes = selectedAirlines().map(name => airlineCodes[name]).filter(Boolean);
          if (codes.length) {
            payload.selectAirlines = codes;
            init = { ...init, body: JSON.stringify(payload) };
          }
        } catch {}
      }
      return nativeFetch(resource, init);
    };

    window.fly2AirlineMode = {
      getMode: () => mode,
      getSelected: selectedAirlines
    };
  }

  function selectedAirlines() {
    const root = $('#airlineIncludeChips');
    return root ? $$('.tag > span', root).map(node => node.textContent.trim()).filter(Boolean) : [];
  }

  function showSelectionError() {
    const section = $('#resultSection');
    const title = $('#resultTitle');
    const content = $('#resultContent');
    const summary = $('#resultSearchSummary');
    if (!section || !title || !content) return;
    title.textContent = 'Scegli una compagnia';
    if (summary) summary.innerHTML = '';
    $('#resultSortWrap')?.classList.add('hidden');
    content.innerHTML = '<article class="result-card"><div class="notice"><strong>Filtro incompleto.</strong><br>Hai scelto “Solo queste”: aggiungi almeno una compagnia prima di cercare.</div></article>';
    section.classList.remove('hidden');
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
})();