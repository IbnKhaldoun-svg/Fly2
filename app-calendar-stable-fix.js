(() => {
  let activeInput = null;

  function todayIso() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  function isoDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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
    const min = input?.min || '';
    const max = input?.max || '';

    // Ultimo giorno reale del mese precedente. La versione #102 usava
    // accidentalmente un giorno "00", che da settembre bloccava agosto.
    const previousLastDate = new Date(year, month - 1, 0);
    const previousLast = isoDate(previousLastDate);
    const prev = root.querySelector('[data-cal-nav="prev"]');
    if (prev) prev.disabled = Boolean(min && previousLast < min);

    const today = todayIso();
    const todayDay = root.querySelector(`[data-date="${today}"]`);
    if (todayDay) {
      todayDay.classList.add('today');
      todayDay.setAttribute('aria-current', 'date');
      todayDay.title = todayDay.disabled ? 'Oggi — non selezionabile con i vincoli attuali' : 'Oggi';
    }

    const todayButton = root.querySelector('[data-cal-today]');
    if (todayButton) {
      const unavailable = Boolean((min && today < min) || (max && today > max));
      todayButton.disabled = unavailable;
      todayButton.title = unavailable
        ? 'Oggi non è selezionabile con i vincoli della data corrente'
        : 'Seleziona oggi';
    }
  }

  document.addEventListener('click', event => {
    const opener = event.target.closest?.('.fly2-date-button[data-date-for]');
    if (opener) {
      activeInput = document.getElementById(opener.dataset.dateFor || '');
      window.setTimeout(fixCalendarNavigation, 0);
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
})();
