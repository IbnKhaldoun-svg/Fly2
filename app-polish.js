(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const DATE_IDS = [
    'flexOutExact', 'flexOutBase', 'flexOutFrom', 'flexOutTo',
    'flexInExact', 'flexInBase', 'flexInFrom', 'flexInTo'
  ];

  let currentSearch = null;
  let calendarRoot = null;
  let calendarInput = null;
  let calendarAnchor = null;
  let calendarMonth = null;

  init();

  function init() {
    ensureResultSummary();
    enhanceDateInputs();
    bindDateRules();
    syncDateRules(true);

    document.addEventListener('click', captureSearch, true);

    const content = $('#resultContent');
    if (content) {
      new MutationObserver(() => {
        if (content.querySelector('.flight-card') && currentSearch) applySearchHeading(currentSearch);
      }).observe(content, { childList: true, subtree: true });
    }

    const title = $('#resultTitle');
    if (title) {
      new MutationObserver(() => {
        const value = title.textContent.trim();
        if (value === 'Ricerca non riuscita' || value === 'Nessun volo compatibile' || value === 'Controlla le date') {
          const summary = $('#resultSearchSummary');
          if (summary) summary.innerHTML = '';
        }
      }).observe(title, { childList: true, characterData: true, subtree: true });
    }
  }

  function captureSearch(event) {
    if (!event.target.closest('#searchButton')) return;

    syncDateRules(true);
    const issue = validateDates();
    if (issue) {
      event.preventDefault();
      event.stopPropagation();
      showDateError(issue);
      return;
    }

    currentSearch = readSearchContext();
    applySearchHeading(currentSearch);
  }

  function ensureResultSummary() {
    if ($('#resultSearchSummary')) return $('#resultSearchSummary');
    const title = $('#resultTitle');
    if (!title) return null;
    const summary = document.createElement('p');
    summary.id = 'resultSearchSummary';
    summary.className = 'result-search-summary';
    title.insertAdjacentElement('afterend', summary);
    return summary;
  }

  function readSearchContext() {
    const origin = $('#origin')?.value.trim() || 'Partenza';
    const destination = $('#anywhereToggle')?.checked ? 'Ovunque' : ($('#destination')?.value.trim() || 'Destinazione');
    const trip = $('.segment.active')?.dataset.trip || 'roundtrip';
    const mode = $('.chip.active')?.dataset.mode || 'flexible';
    const parts = [];

    if (mode === 'flexible') {
      const out = summarizeLeg('out');
      if (trip === 'roundtrip') {
        const back = summarizeLeg('in');
        if (activeKind('out') === 'exact' && activeKind('in') === 'exact') parts.push(`${out} → ${back}`);
        else parts.push(`Andata ${out} · ritorno ${back}`);
      } else {
        parts.push(out);
      }
    } else if (mode === 'cheapest') {
      const nights = $('#nights')?.value || '3';
      const horizon = $('#horizon')?.selectedOptions?.[0]?.textContent || '6 mesi';
      parts.push(`${nights} notti · entro ${horizon}`);
    } else {
      const outDay = $('#weekendOut')?.value || 'Venerdì';
      const outTime = $('#weekendOutTime')?.value || '20:00';
      const backDay = ($('#weekendBack')?.value || 'Domenica').toLowerCase();
      const backTime = $('#weekendBackTime')?.value || '20:00';
      parts.push(`${outDay} dopo le ${outTime} · ${backDay} verso le ${backTime}`);
    }

    const passengerText = $('#passengerSummary')?.textContent.trim();
    if (passengerText) parts.push(passengerText);

    const stopsText = $('#stops')?.selectedOptions?.[0]?.textContent;
    if (stopsText) parts.push(stopsText.toLowerCase());

    const layover = $('#layover')?.value;
    if (layover && layover !== 'none' && $('#stops')?.value !== '0') parts.push(`scalo max ${layover}h`);

    return { route: `${origin} → ${destination}`, parts };
  }

  function applySearchHeading(context) {
    const title = $('#resultTitle');
    const summary = ensureResultSummary();
    if (!title || !summary || !context) return;
    title.textContent = context.route;
    summary.innerHTML = context.parts.map(part => `<span>${esc(part)}</span>`).join('');
  }

  function summarizeLeg(leg) {
    const kind = activeKind(leg);
    const prefix = leg === 'out' ? 'flexOut' : 'flexIn';
    if (kind === 'exact') return formatDate($('#' + prefix + 'Exact')?.value);
    if (kind === 'plusminus') return `${formatDate($('#' + prefix + 'Base')?.value)} ± ${$('#' + prefix + 'Days')?.value || '0'} gg`;
    return formatRange($('#' + prefix + 'From')?.value, $('#' + prefix + 'To')?.value);
  }

  function enhanceDateInputs() {
    DATE_IDS.forEach(id => {
      const input = $('#' + id);
      if (!input || input.dataset.fly2Enhanced === 'true') return;
      input.dataset.fly2Enhanced = 'true';
      input.classList.add('fly2-date-source');
      input.tabIndex = -1;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'fly2-date-button';
      button.dataset.dateFor = id;
      button.setAttribute('aria-label', `Scegli ${input.closest('.control')?.querySelector(':scope > span')?.textContent?.trim() || 'data'}`);
      button.innerHTML = '<span class="fly2-date-value"></span><span class="fly2-calendar-icon" aria-hidden="true">▦</span>';
      input.insertAdjacentElement('afterend', button);
      updateDateButton(input);

      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        openCalendar(input, button);
      });

      input.addEventListener('change', () => updateDateButton(input));
      input.addEventListener('input', () => updateDateButton(input));
    });
  }

  function bindDateRules() {
    DATE_IDS.forEach(id => {
      $('#' + id)?.addEventListener('change', () => syncDateRules(true));
    });

    $('#flexOutDays')?.addEventListener('change', () => syncDateRules(true));
    $('#flexInDays')?.addEventListener('change', () => syncDateRules(true));

    $$('[data-flex-kind]').forEach(button => button.addEventListener('click', () => {
      window.setTimeout(() => syncDateRules(true), 0);
    }));

    $$('.segment').forEach(button => button.addEventListener('click', () => {
      window.setTimeout(() => syncDateRules(true), 0);
    }));
  }

  function syncDateRules(clampValues) {
    const today = todayIso();
    setMin('flexOutExact', today, clampValues);
    setMin('flexOutFrom', today, clampValues);

    const outFlexDays = Number($('#flexOutDays')?.value || 0);
    setMin('flexOutBase', addIsoDays(today, outFlexDays), clampValues);

    const outFrom = $('#flexOutFrom')?.value || today;
    setMin('flexOutTo', maxIso(today, outFrom), clampValues);

    const latestOut = latestOutboundDate();
    if (latestOut) {
      setMin('flexInExact', latestOut, clampValues);
      setMin('flexInFrom', latestOut, clampValues);

      const returnFlexDays = Number($('#flexInDays')?.value || 0);
      setMin('flexInBase', addIsoDays(latestOut, returnFlexDays), clampValues);

      const returnFrom = $('#flexInFrom')?.value || latestOut;
      setMin('flexInTo', maxIso(latestOut, returnFrom), clampValues);
    }

    DATE_IDS.forEach(id => {
      const input = $('#' + id);
      if (input) updateDateButton(input);
    });

    if (calendarInput) renderCalendar();
  }

  function latestOutboundDate() {
    const kind = activeKind('out');
    if (kind === 'exact') return $('#flexOutExact')?.value || null;
    if (kind === 'plusminus') {
      const base = $('#flexOutBase')?.value;
      return base ? addIsoDays(base, Number($('#flexOutDays')?.value || 0)) : null;
    }
    return $('#flexOutTo')?.value || $('#flexOutFrom')?.value || null;
  }

  function intervalForLeg(leg) {
    const prefix = leg === 'out' ? 'flexOut' : 'flexIn';
    const kind = activeKind(leg);
    if (kind === 'exact') {
      const date = $('#' + prefix + 'Exact')?.value;
      return date ? { start: date, end: date } : null;
    }
    if (kind === 'plusminus') {
      const base = $('#' + prefix + 'Base')?.value;
      const days = Number($('#' + prefix + 'Days')?.value || 0);
      return base ? { start: addIsoDays(base, -days), end: addIsoDays(base, days) } : null;
    }
    const start = $('#' + prefix + 'From')?.value;
    const end = $('#' + prefix + 'To')?.value;
    return start && end ? { start, end } : null;
  }

  function validateDates() {
    const mode = $('.chip.active')?.dataset.mode || 'flexible';
    if (mode !== 'flexible') return null;

    const out = intervalForLeg('out');
    if (!out) return 'Completa la data di andata.';
    if (out.end < out.start) return 'La fine dell’intervallo di andata non può precedere l’inizio.';
    if (out.start < todayIso()) return 'La data di andata non può essere nel passato.';

    const trip = $('.segment.active')?.dataset.trip || 'roundtrip';
    if (trip !== 'roundtrip') return null;

    const back = intervalForLeg('in');
    if (!back) return 'Completa la data di ritorno.';
    if (back.end < back.start) return 'La fine dell’intervallo di ritorno non può precedere l’inizio.';
    if (back.start < out.end) return 'Il ritorno non può precedere l’andata. Fly2 richiede che la prima data possibile di ritorno sia successiva all’ultima data possibile di partenza.';
    return null;
  }

  function setMin(id, min, clampValues) {
    const input = $('#' + id);
    if (!input || !min) return;
    input.min = min;
    if (clampValues && input.value && input.value < min) input.value = min;
  }

  function activeKind(leg) {
    return $(`[data-flex-leg="${leg}"].active`)?.dataset.flexKind || 'exact';
  }

  function updateDateButton(input) {
    const button = $(`[data-date-for="${input.id}"]`);
    if (!button) return;
    const value = $('.fly2-date-value', button);
    if (value) value.textContent = input.value ? formatDateLong(input.value) : 'Scegli data';
    button.classList.toggle('empty', !input.value);
  }

  function openCalendar(input, anchor) {
    ensureCalendar();
    calendarInput = input;
    calendarAnchor = anchor;
    const selected = parseIso(input.value) || parseIso(input.min) || new Date();
    calendarMonth = new Date(selected.getFullYear(), selected.getMonth(), 1);
    renderCalendar();
    calendarRoot.classList.remove('hidden');
    positionCalendar();
  }

  function ensureCalendar() {
    if (calendarRoot) return;
    calendarRoot = document.createElement('div');
    calendarRoot.className = 'fly2-calendar hidden';
    calendarRoot.setAttribute('role', 'dialog');
    calendarRoot.setAttribute('aria-label', 'Calendario Fly2');
    calendarRoot.innerHTML = `
      <div class="fly2-calendar-head">
        <button type="button" data-cal-nav="prev" aria-label="Mese precedente">‹</button>
        <strong id="fly2CalendarMonth"></strong>
        <button type="button" data-cal-nav="next" aria-label="Mese successivo">›</button>
      </div>
      <div class="fly2-calendar-weekdays"><span>Lun</span><span>Mar</span><span>Mer</span><span>Gio</span><span>Ven</span><span>Sab</span><span>Dom</span></div>
      <div id="fly2CalendarDays" class="fly2-calendar-days"></div>
      <div class="fly2-calendar-foot"><button type="button" data-cal-today>Oggi</button><button type="button" data-cal-close>Chiudi</button></div>`;
    document.body.appendChild(calendarRoot);

    $('[data-cal-nav="prev"]', calendarRoot).addEventListener('click', () => changeMonth(-1));
    $('[data-cal-nav="next"]', calendarRoot).addEventListener('click', () => changeMonth(1));
    $('[data-cal-close]', calendarRoot).addEventListener('click', closeCalendar);
    $('[data-cal-today]', calendarRoot).addEventListener('click', () => {
      if (!calendarInput) return;
      const today = todayIso();
      if (calendarInput.min && today < calendarInput.min) return;
      chooseDate(today);
    });

    calendarRoot.addEventListener('click', event => event.stopPropagation());
    document.addEventListener('click', event => {
      if (calendarRoot?.classList.contains('hidden')) return;
      if (event.target.closest('.fly2-date-button')) return;
      closeCalendar();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeCalendar();
    });
    window.addEventListener('resize', () => {
      if (!calendarRoot?.classList.contains('hidden')) positionCalendar();
    });
  }

  function renderCalendar() {
    if (!calendarRoot || !calendarInput || !calendarMonth) return;
    const monthLabel = $('#fly2CalendarMonth', calendarRoot);
    monthLabel.textContent = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' }).format(calendarMonth);

    const grid = $('#fly2CalendarDays', calendarRoot);
    grid.innerHTML = '';
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const first = new Date(year, month, 1);
    const offset = (first.getDay() + 6) % 7;
    const days = new Date(year, month + 1, 0).getDate();
    const selected = calendarInput.value;
    const today = todayIso();
    const min = calendarInput.min || '';
    const max = calendarInput.max || '';

    for (let i = 0; i < offset; i += 1) {
      const blank = document.createElement('span');
      blank.className = 'fly2-calendar-blank';
      grid.appendChild(blank);
    }

    for (let day = 1; day <= days; day += 1) {
      const date = isoParts(year, month + 1, day);
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = String(day);
      button.dataset.date = date;
      button.setAttribute('aria-label', formatDateLong(date));
      if (date === selected) button.classList.add('selected');
      if (date === today) button.classList.add('today');
      if ((min && date < min) || (max && date > max)) button.disabled = true;
      button.addEventListener('click', () => chooseDate(date));
      grid.appendChild(button);
    }

    const prev = $('[data-cal-nav="prev"]', calendarRoot);
    const prevLast = isoParts(year, month, 0);
    prev.disabled = Boolean(min && prevLast < min);
  }

  function chooseDate(date) {
    if (!calendarInput) return;
    calendarInput.value = date;
    updateDateButton(calendarInput);
    calendarInput.dispatchEvent(new Event('change', { bubbles: true }));
    syncDateRules(true);
    closeCalendar();
  }

  function changeMonth(delta) {
    if (!calendarMonth) return;
    calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + delta, 1);
    renderCalendar();
  }

  function positionCalendar() {
    if (!calendarRoot || !calendarAnchor) return;
    if (window.matchMedia('(max-width: 560px)').matches) {
      calendarRoot.style.left = '';
      calendarRoot.style.top = '';
      return;
    }
    const rect = calendarAnchor.getBoundingClientRect();
    const width = calendarRoot.offsetWidth || 340;
    const height = calendarRoot.offsetHeight || 390;
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
    let top = rect.bottom + 8;
    if (top + height > window.innerHeight - 12) top = Math.max(12, rect.top - height - 8);
    calendarRoot.style.left = `${left}px`;
    calendarRoot.style.top = `${top}px`;
  }

  function closeCalendar() {
    calendarRoot?.classList.add('hidden');
    calendarInput = null;
    calendarAnchor = null;
  }

  function showDateError(message) {
    const section = $('#resultSection');
    const title = $('#resultTitle');
    const content = $('#resultContent');
    const sort = $('#resultSortWrap');
    if (!section || !title || !content) return;
    title.textContent = 'Controlla le date';
    const summary = ensureResultSummary();
    if (summary) summary.innerHTML = '';
    content.innerHTML = `<article class="result-card"><div class="notice"><strong>Date non valide.</strong><br>${esc(message)}</div></article>`;
    sort?.classList.add('hidden');
    section.classList.remove('hidden');
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function parseIso(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function todayIso() {
    const now = new Date();
    return isoParts(now.getFullYear(), now.getMonth() + 1, now.getDate());
  }

  function addIsoDays(value, days) {
    const date = parseIso(value);
    if (!date) return value;
    date.setDate(date.getDate() + Number(days || 0));
    return isoParts(date.getFullYear(), date.getMonth() + 1, date.getDate());
  }

  function isoParts(year, month, day) {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  function maxIso(a, b) {
    return a > b ? a : b;
  }

  function formatDate(value) {
    const date = parseIso(value);
    if (!date) return 'data non scelta';
    return new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }).format(date).replace('.', '');
  }

  function formatDateLong(value) {
    const date = parseIso(value);
    if (!date) return 'Scegli data';
    return new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(date).replace(/\./g, '');
  }

  function formatRange(from, to) {
    if (!from || !to) return 'intervallo non completo';
    const a = parseIso(from);
    const b = parseIso(to);
    if (!a || !b) return 'intervallo non completo';
    const sameMonth = a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
    if (sameMonth) {
      const month = new Intl.DateTimeFormat('it-IT', { month: 'short' }).format(a).replace('.', '');
      return `${a.getDate()}–${b.getDate()} ${month} ${a.getFullYear()}`;
    }
    return `${formatDate(from)} – ${formatDate(to)}`;
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }
})();