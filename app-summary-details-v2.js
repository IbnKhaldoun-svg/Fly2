(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const countryCodes = {
    'Albania':'AL','Austria':'AT','Belgio':'BE','Bulgaria':'BG','Cipro':'CY','Croazia':'HR','Danimarca':'DK','Egitto':'EG',
    'Emirati Arabi Uniti':'AE','Finlandia':'FI','Francia':'FR','Germania':'DE','Grecia':'GR','Irlanda':'IE','Islanda':'IS',
    'Italia':'IT','Macedonia del Nord':'MK','Marocco':'MA','Malta':'MT','Norvegia':'NO','Paesi Bassi':'NL','Polonia':'PL',
    'Portogallo':'PT','Qatar':'QA','Regno Unito':'GB','Repubblica Ceca':'CZ','Romania':'RO','Serbia':'RS','Spagna':'ES',
    'Svezia':'SE','Svizzera':'CH','Tunisia':'TN','Turchia':'TR','Ungheria':'HU'
  };

  let lastSearchAnywhere = false;
  let refreshQueued = false;

  init();

  function init() {
    document.addEventListener('click', event => {
      if (!event.target.closest('#searchButton')) return;
      lastSearchAnywhere = Boolean($('#anywhereToggle')?.checked);
      queueRefresh();
    }, true);

    const result = $('#resultSection');
    if (result) {
      new MutationObserver(queueRefresh).observe(result, { childList: true, subtree: true, characterData: true });
    }

    queueRefresh();
  }

  function queueRefresh() {
    if (refreshQueued) return;
    refreshQueued = true;
    window.setTimeout(() => {
      refreshQueued = false;
      compactRoutes();
      enhanceSearchSummary();
      clarifyAnywhereCount();
    }, 0);
  }

  function enhanceSearchSummary() {
    const summary = $('#resultSearchSummary');
    if (!summary) return;

    $$('[data-advanced-summary="true"]', summary).forEach(node => node.remove());

    const extras = [];
    const stops = $('#stops')?.value;
    const trip = $('.segment.active')?.dataset.trip || 'roundtrip';

    if (stops !== '0') {
      const outPolicy = $('input[name="outSegmentCarrier"]:checked')?.value;
      const inPolicy = $('input[name="inSegmentCarrier"]:checked')?.value;
      if (outPolicy === 'same') extras.push('andata: stessa compagnia');
      if (trip === 'roundtrip' && inPolicy === 'same') extras.push('ritorno: stessa compagnia');
    }

    const preferred = readTags('#airlineIncludeChips');
    if (preferred.length) extras.push(`preferite: ${preferred.join(', ')}`);

    const excluded = readTags('#airlineExcludeChips');
    if (excluded.length) extras.push(`escluse: ${excluded.join(', ')}`);

    const avoid = readTags('#avoidCountryChips');
    if (avoid.length) extras.push(`evita scali: ${avoid.join(', ')}`);

    extras.forEach(text => {
      const chip = document.createElement('span');
      chip.dataset.advancedSummary = 'true';
      chip.className = 'advanced-summary-chip';
      chip.textContent = text;
      summary.appendChild(chip);
    });
  }

  function readTags(selector) {
    const root = $(selector);
    return root ? $$('.tag > span', root).map(node => node.textContent.trim()).filter(Boolean) : [];
  }

  function compactRoutes() {
    $$('.flight-leg').forEach(leg => {
      const details = $('.flight-place-details', leg);
      const routeText = $('.flight-leg-title span:nth-of-type(1)', leg);
      if (!details || !routeText) return;

      const countrySpan = $$('span', details).find(node => $('strong', node)?.textContent.trim() === 'Paesi');
      if (!countrySpan) {
        details.remove();
        return;
      }

      const countryClone = countrySpan.cloneNode(true);
      $('strong', countryClone)?.remove();
      const countries = countryClone.textContent.split(/\s*→\s*/).map(value => value.trim()).filter(Boolean);
      const places = routeText.textContent.split(/\s*→\s*/).map(value => value.trim()).filter(Boolean);

      if (places.length) {
        routeText.textContent = places.map((place, index) => {
          const country = countries[index] || '';
          const code = countryCodes[country] || '';
          return code ? `${place}, ${code}` : place;
        }).join(' → ');
      }

      details.remove();
    });
  }

  function clarifyAnywhereCount() {
    const meta = $('.live-results-meta');
    if (!meta) return;
    const countNode = $('strong', meta);
    const noteNode = $('span', meta);
    if (!countNode || !noteNode) return;

    const match = countNode.textContent.match(/(\d+)/);
    const count = match ? match[1] : '';

    if (lastSearchAnywhere) {
      if (count) countNode.textContent = `${count} destinazioni`;
      noteNode.textContent = '1 migliore opzione per città · prezzi e disponibilità ricevuti da Kiwi.com al momento della ricerca.';
    }
  }
})();
