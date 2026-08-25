(() => {
  let activeInput = null;
  let displaySummaryOverride = '';

  function todayIso() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  function parseIso(value) {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  function isoDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function addDays(value, days) {
    const date = parseIso(value);
    if (!date) return value;
    date.setDate(date.getDate() + Number(days || 0));
    return isoDate(date);
  }

  function formatDate(value) {
    const date = parseIso(value);
    if (!date) return 'data non scelta';
    return new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
      .format(date)
      .replace(/\./g, '');
  }

  function activeKind(leg) {
    return document.querySelector(`[data-flex-leg="${leg}"].active`)?.dataset.flexKind || 'exact';
  }

  function isOutboundPlusMinus() {
    return activeKind('out') === 'plusminus';
  }

  function isFlexibleOutboundBase(input = activeInput) {
    return input?.id === 'flexOutBase' && isOutboundPlusMinus();
  }

  function summarizeLeg(leg) {
    const prefix = leg === 'out' ? 'flexOut' : 'flexIn';
    const kind = activeKind(leg);
    if (kind === 'exact') return formatDate(document.getElementById(prefix + 'Exact')?.value);
    if (kind === 'plusminus') {
      return `${formatDate(document.getElementById(prefix + 'Base')?.value)} ± ${document.getElementById(prefix + 'Days')?.value || '0'} gg`;
    }
    const from = document.getElementById(prefix + 'From')?.value;
    const to = document.getElementById(prefix + 'To')?.value;
    return `${formatDate(from)} – ${formatDate(to)}`;
  }

  function currentDisplaySummary() {
    const out = summarizeLeg('out');
    const trip = document.querySelector('.segment.active')?.dataset.trip || 'roundtrip';
    if (trip !== 'roundtrip') return out;
    return `Andata ${out} · ritorno ${summarizeLeg('in')}`;
  }

  function updateDateButton(input) {
    const button = document.querySelector(`[data-date-for="${input?.id || ''}"]`);
    const value = button?.querySelector('.fly2-date-value');
    if (!value || !input?.value) return;
    const date = parseIso(input.value);
    if (!date) return;
    value.textContent = new Intl.DateTimeFormat('it-IT', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
    }).format(date).replace(/\./g, '');
  }

  function chooseFlexibleToday(date) {
    if (!isFlexibleOutboundBase() || !activeInput) return false;
    const today = todayIso();
    if (date < today) return false;

    activeInput.value = date;
    updateDateButton(activeInput);
    activeInput.dispatchEvent(new Event('input', { bubbles: false }));

    const root = document.querySelector('.fly2-calendar:not(.hidden)');
    root?.classList.add('hidden');

    // Aggiorna anche i vincoli del ritorno. La gestione capture qui sotto
    // converte per un istante ± giorni in un range futuro, senza spostare la
    // data centrale scelta dall'utente.
    document.getElementById('flexOutDays')?.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function fixCalendarNavigation() {
    const root = document.querySelector('.fly2-calendar:not(.hidden)');
    if (!root) return;

    const firstDay = root.querySelector('#fly2CalendarDays button[data-date]');
    if (!firstDay) return;

    const match = String(firstDay.dataset.date || '').match(/^(\d{4})-(\d{2})-/);
    if (!match) return;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const input = activeInput;
    const today = todayIso();
    const max = input?.max || '';

    // Ultimo giorno reale del mese precedente. La versione #102 costruiva
    // accidentalmente una data con giorno 00 e poteva bloccare agosto.
    const previousLast = isoDate(new Date(year, month - 1, 0));
    const effectiveMin = isFlexibleOutboundBase(input) ? today : (input?.min || '');
    const prev = root.querySelector('[data-cal-nav="prev"]');
    if (prev) prev.disabled = Boolean(effectiveMin && previousLast < effectiveMin);

    root.querySelectorAll('#fly2CalendarDays button[data-date]').forEach(button => {
      const date = String(button.dataset.date || '');
      if (isFlexibleOutboundBase(input)) {
        button.disabled = Boolean(date < today || (max && date > max));
      }
      if (date === today) {
        button.classList.add('today');
        button.setAttribute('aria-current', 'date');
        button.title = button.disabled
          ? 'Oggi non è selezionabile con i vincoli attuali'
          : 'Oggi — puoi partire anche oggi';
      }
    });

    const todayButton = root.querySelector('[data-cal-today]');
    if (todayButton) {
      const unavailable = isFlexibleOutboundBase(input)
        ? Boolean(max && today > max)
        : Boolean((effectiveMin && today < effectiveMin) || (max && today > max));
      todayButton.disabled = unavailable;
      todayButton.title = unavailable
        ? 'Oggi non è selezionabile con i vincoli della data corrente'
        : 'Seleziona oggi';
    }
  }

  function prepareNearTodayFlexibleSearch(setSummary = true) {
    if (setSummary) displaySummaryOverride = '';
    if (!isOutboundPlusMinus()) return null;

    const baseInput = document.getElementById('flexOutBase');
    const daysInput = document.getElementById('flexOutDays');
    const base = baseInput?.value;
    const days = Number(daysInput?.value || 0);
    if (!base || !Number.isFinite(days) || days <= 0) return null;

    const today = todayIso();
    const lower = addDays(base, -days);
    if (lower >= today) return null;

    const upper = addDays(base, days);
    if (setSummary) displaySummaryOverride = currentDisplaySummary();

    const plusButton = document.querySelector('[data-flex-leg="out"][data-flex-kind="plusminus"]');
    const rangeButton = document.querySelector('[data-flex-leg="out"][data-flex-kind="range"]');
    const plusPanel = document.querySelector('[data-flex-panel="out-plusminus"]');
    const rangePanel = document.querySelector('[data-flex-panel="out-range"]');
    const from = document.getElementById('flexOutFrom');
    const to = document.getElementById('flexOutTo');

    const saved = {
      base,
      from: from?.value || '',
      to: to?.value || '',
      plusActive: plusButton?.classList.contains('active') || false,
      rangeActive: rangeButton?.classList.contains('active') || false,
      plusHidden: plusPanel?.classList.contains('hidden') || false,
      rangeHidden: rangePanel?.classList.contains('hidden') || false
    };

    if (from) from.value = today;
    if (to) to.value = upper;
    plusButton?.classList.remove('active');
    rangeButton?.classList.add('active');
    plusPanel?.classList.add('hidden');
    rangePanel?.classList.remove('hidden');

    return () => {
      if (baseInput) {
        baseInput.value = saved.base;
        updateDateButton(baseInput);
      }
      if (from) from.value = saved.from;
      if (to) to.value = saved.to;
      plusButton?.classList.toggle('active', saved.plusActive);
      rangeButton?.classList.toggle('active', saved.rangeActive);
      plusPanel?.classList.toggle('hidden', saved.plusHidden);
      rangePanel?.classList.toggle('hidden', saved.rangeHidden);
      if (setSummary) restoreSearchSummary();
    };
  }

  function restoreSearchSummary() {
    if (!displaySummaryOverride) return;
    const first = document.querySelector('#resultSearchSummary > span:first-child');
    if (first && first.textContent !== displaySummaryOverride) first.textContent = displaySummaryOverride;
  }

  // Window è prima di document nella fase capture: prepariamo temporaneamente
  // un range futuro solo quando ± giorni sconfinerebbe nel passato. Il motore
  // riceve quindi oggi→data+N, ma l'interfaccia resta visualmente in modalità ±.
  window.addEventListener('click', event => {
    if (!event.target.closest?.('#searchButton')) return;
    const restore = prepareNearTodayFlexibleSearch(true);
    if (restore) window.setTimeout(restore, 0);
  }, true);

  // Anche il cambio della tolleranza non deve spostare la data centrale da
  // oggi a oggi+N. Usiamo lo stesso range temporaneo per lasciare che il codice
  // #102 aggiorni correttamente i vincoli del ritorno.
  window.addEventListener('change', event => {
    if (event.target?.id !== 'flexOutDays') return;
    const restore = prepareNearTodayFlexibleSearch(false);
    if (restore) window.setTimeout(restore, 0);
  }, true);

  document.addEventListener('click', event => {
    const opener = event.target.closest?.('.fly2-date-button[data-date-for]');
    if (opener) {
      activeInput = document.getElementById(opener.dataset.dateFor || '');
      window.setTimeout(fixCalendarNavigation, 0);
      return;
    }

    const dateButton = event.target.closest?.('.fly2-calendar button[data-date]');
    if (dateButton && isFlexibleOutboundBase()) {
      const date = String(dateButton.dataset.date || '');
      if (date >= todayIso() && activeInput?.min && date < activeInput.min) {
        event.preventDefault();
        event.stopImmediatePropagation();
        chooseFlexibleToday(date);
        return;
      }
    }

    const todayButton = event.target.closest?.('.fly2-calendar [data-cal-today]');
    if (todayButton && isFlexibleOutboundBase() && !todayButton.disabled) {
      event.preventDefault();
      event.stopImmediatePropagation();
      chooseFlexibleToday(todayIso());
      return;
    }

    if (event.target.closest?.('[data-cal-nav]')) {
      window.setTimeout(fixCalendarNavigation, 0);
    }
  }, true);

  document.addEventListener('change', event => {
    if (event.target?.matches?.('#flexOutDays, #flexInDays, .fly2-date-source')) {
      window.setTimeout(fixCalendarNavigation, 0);
    }
  }, true);

  const results = document.getElementById('resultContent');
  if (results) {
    new MutationObserver(() => window.setTimeout(restoreSearchSummary, 0))
      .observe(results, { childList: true });
  }
})();
