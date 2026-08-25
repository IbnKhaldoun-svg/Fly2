(function () {
  if (window.__fly2NativeCompactInstalled) return;
  window.__fly2NativeCompactInstalled = true;

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  }

  ready(function () {
    var searchCard = document.querySelector('.search-card');
    var searchButton = document.getElementById('searchButton');
    var routeGrid = document.querySelector('.route-grid');
    if (!searchCard || !searchButton || !routeGrid) return;

    document.documentElement.classList.add('fly2-native-app');
    searchCard.classList.add('fly2-android-search');

    var originalPassengerButton = document.getElementById('passengerButton');
    var passengerSummary = document.getElementById('passengerSummary');
    var stopsSelect = document.getElementById('stops');
    var advancedPanel = document.getElementById('advancedPanel');
    var fieldLabel = searchCard.querySelector('.field-label');
    var dateChips = searchCard.querySelector('.date-mode-chips');
    var flexiblePanel = document.getElementById('flexiblePanel');
    var cheapestPanel = document.getElementById('cheapestPanel');
    var weekendPanel = document.getElementById('weekendPanel');

    var nativeDateIds = [
      'flexOutExact', 'flexOutBase', 'flexOutFrom', 'flexOutTo',
      'flexInExact', 'flexInBase', 'flexInFrom', 'flexInTo'
    ];

    nativeDateIds.forEach(function (id) {
      var input = document.getElementById(id);
      if (input) input.value = '';
    });

    var backdrop = document.createElement('div');
    backdrop.className = 'fly2-native-sheet-backdrop';
    document.body.appendChild(backdrop);

    var sheets = {};
    var activeSheet = null;

    function makeSheet(key, title) {
      var sheet = document.createElement('section');
      sheet.className = 'fly2-native-sheet';
      sheet.setAttribute('role', 'dialog');
      sheet.setAttribute('aria-modal', 'true');
      sheet.setAttribute('aria-label', title);

      var grabber = document.createElement('div');
      grabber.className = 'fly2-native-sheet-grabber';
      sheet.appendChild(grabber);

      var header = document.createElement('div');
      header.className = 'fly2-native-sheet-header';
      var heading = document.createElement('strong');
      heading.textContent = title;
      var close = document.createElement('button');
      close.type = 'button';
      close.className = 'fly2-native-sheet-close';
      close.setAttribute('aria-label', 'Chiudi');
      close.textContent = '×';
      close.addEventListener('click', closeSheet);
      header.appendChild(heading);
      header.appendChild(close);
      sheet.appendChild(header);

      var content = document.createElement('div');
      content.className = 'fly2-native-sheet-content';
      sheet.appendChild(content);
      document.body.appendChild(sheet);
      sheets[key] = { root: sheet, content: content };
      return sheets[key];
    }

    function openSheet(key) {
      if (!sheets[key]) return;
      if (activeSheet && activeSheet !== sheets[key].root) activeSheet.classList.remove('is-open');
      activeSheet = sheets[key].root;
      document.body.classList.add('fly2-native-sheet-open');
      backdrop.style.pointerEvents = 'auto';
      requestAnimationFrame(function () {
        activeSheet.classList.add('is-open');
        var content = activeSheet.querySelector('.fly2-native-sheet-content');
        if (content) content.scrollTop = 0;
      });
    }

    function closeSheet() {
      if (activeSheet) activeSheet.classList.remove('is-open');
      document.body.classList.remove('fly2-native-sheet-open');
      backdrop.style.pointerEvents = '';
      activeSheet = null;
      syncSummaries();
    }

    backdrop.addEventListener('click', closeSheet);

    var dateSheet = makeSheet('dates', 'Date del viaggio');
    [fieldLabel, dateChips, flexiblePanel, cheapestPanel, weekendPanel].forEach(function (node) {
      if (node) dateSheet.content.appendChild(node);
    });
    if (fieldLabel) fieldLabel.style.display = 'none';
    var dateDone = document.createElement('button');
    dateDone.type = 'button';
    dateDone.className = 'fly2-native-sheet-action';
    dateDone.textContent = 'Fatto';
    dateDone.addEventListener('click', closeSheet);
    dateSheet.content.appendChild(dateDone);

    var stopSheet = makeSheet('stops', 'Numero di scali');
    var stopList = document.createElement('div');
    stopList.className = 'fly2-stop-choice-list';
    stopSheet.content.appendChild(stopList);

    var stopDefinitions = [
      { value: '0', title: 'Solo voli diretti', copy: 'Nessun cambio durante la tratta' },
      { value: '1', title: 'Massimo 1 scalo', copy: 'Buon equilibrio tra prezzo e semplicità' },
      { value: '2', title: 'Massimo 2 scali', copy: 'Più combinazioni e più possibilità di risparmio' }
    ];

    stopDefinitions.forEach(function (item) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'fly2-stop-choice';
      button.dataset.value = item.value;

      var text = document.createElement('span');
      var strong = document.createElement('strong');
      strong.textContent = item.title;
      var small = document.createElement('small');
      small.textContent = item.copy;
      text.appendChild(strong);
      text.appendChild(small);

      var check = document.createElement('span');
      check.className = 'fly2-stop-check';
      check.textContent = '✓';
      button.appendChild(text);
      button.appendChild(check);
      button.addEventListener('click', function () {
        if (stopsSelect) {
          stopsSelect.value = item.value;
          stopsSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
        renderStopChoices();
        syncSummaries();
        window.setTimeout(closeSheet, 90);
      });
      stopList.appendChild(button);
    });

    var advancedSheet = makeSheet('advanced', 'Personalizza la ricerca');
    if (advancedPanel) {
      advancedPanel.classList.remove('hidden');
      advancedSheet.content.appendChild(advancedPanel);
    }
    var advancedDone = document.createElement('button');
    advancedDone.type = 'button';
    advancedDone.className = 'fly2-native-sheet-action';
    advancedDone.textContent = 'Applica filtri';
    advancedDone.addEventListener('click', closeSheet);
    advancedSheet.content.appendChild(advancedDone);

    var summaryGrid = document.createElement('div');
    summaryGrid.className = 'fly2-native-summary-grid';

    function makeSummaryCard(key, icon, label, action) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'fly2-native-summary-card';
      button.dataset.nativeSummary = key;

      var top = document.createElement('span');
      top.className = 'fly2-native-summary-top';
      var iconNode = document.createElement('span');
      iconNode.className = 'fly2-native-summary-icon';
      iconNode.textContent = icon;
      var labelNode = document.createElement('span');
      labelNode.textContent = label;
      top.appendChild(iconNode);
      top.appendChild(labelNode);

      var value = document.createElement('span');
      value.className = 'fly2-native-summary-value';
      value.textContent = '—';
      button.appendChild(top);
      button.appendChild(value);
      button.addEventListener('click', action);
      summaryGrid.appendChild(button);
      return value;
    }

    var dateValue = makeSummaryCard('dates', '▦', 'Date', function () { openSheet('dates'); });
    var passengerValue = makeSummaryCard('passengers', '♙', 'Passeggeri', function () {
      if (originalPassengerButton) originalPassengerButton.click();
    });
    var stopValue = makeSummaryCard('stops', '✈', 'Scali', function () {
      renderStopChoices();
      openSheet('stops');
    });

    searchCard.insertBefore(summaryGrid, searchButton);

    var advancedOpen = document.createElement('button');
    advancedOpen.type = 'button';
    advancedOpen.className = 'fly2-native-advanced-button';
    var advancedIcon = document.createElement('span');
    advancedIcon.textContent = '☷';
    var advancedText = document.createElement('span');
    advancedText.textContent = 'Opzioni avanzate';
    advancedOpen.appendChild(advancedIcon);
    advancedOpen.appendChild(advancedText);
    advancedOpen.addEventListener('click', function () { openSheet('advanced'); });
    searchButton.insertAdjacentElement('afterend', advancedOpen);

    function formatShort(value) {
      if (!value) return '';
      var date = new Date(value + 'T12:00:00');
      if (!Number.isFinite(date.getTime())) return value;
      try {
        return new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' })
          .format(date)
          .replace(/\./g, '');
      } catch (error) {
        return value;
      }
    }

    function activeTrip() {
      var node = document.querySelector('.segment.active');
      return (node && node.dataset.trip) || 'roundtrip';
    }

    function activeMode() {
      var node = document.querySelector('.date-mode-chips .chip.active');
      return (node && node.dataset.mode) || 'flexible';
    }

    function flexKind(leg) {
      var node = document.querySelector('[data-flex-leg="' + leg + '"].active');
      return (node && node.dataset.flexKind) || 'exact';
    }

    function legText(leg) {
      var prefix = leg === 'out' ? 'flexOut' : 'flexIn';
      var kind = flexKind(leg);
      var exact = document.getElementById(prefix + 'Exact');
      var base = document.getElementById(prefix + 'Base');
      var days = document.getElementById(prefix + 'Days');
      var from = document.getElementById(prefix + 'From');
      var to = document.getElementById(prefix + 'To');
      if (kind === 'exact') return formatShort((exact && exact.value) || '');
      if (kind === 'plusminus') {
        var baseText = formatShort((base && base.value) || '');
        return baseText ? baseText + ' ±' + ((days && days.value) || '0') + 'g' : '';
      }
      var fromText = formatShort((from && from.value) || '');
      var toText = formatShort((to && to.value) || '');
      return fromText && toText ? fromText + '–' + toText : '';
    }

    function dateSummaryText() {
      var mode = activeMode();
      if (mode === 'cheapest') {
        var nightsNode = document.getElementById('nights');
        var horizonNode = document.getElementById('horizon');
        return ((nightsNode && nightsNode.value) || '—') + ' notti · ' + ((horizonNode && horizonNode.value) || '—') + ' mesi';
      }
      if (mode === 'weekend') {
        var outNode = document.getElementById('weekendOut');
        var backNode = document.getElementById('weekendBack');
        var out = (outNode && outNode.value) || 'Weekend';
        var back = (backNode && backNode.value) || '';
        return back ? out.slice(0, 3) + ' → ' + back.slice(0, 3) : out;
      }
      var outbound = legText('out');
      if (!outbound) return 'Scegli date';
      if (activeTrip() === 'oneway') return outbound;
      var inbound = legText('in');
      if (!inbound) return 'Scegli date';
      return outbound + ' · ' + inbound;
    }

    function stopSummaryText() {
      var value = (stopsSelect && stopsSelect.value) || '1';
      if (value === '0') return 'Diretto';
      if (value === '2') return 'Max 2';
      return 'Max 1';
    }

    function syncSummaries() {
      dateValue.textContent = dateSummaryText();
      passengerValue.textContent = ((passengerSummary && passengerSummary.textContent) || '1 adulto').trim();
      stopValue.textContent = stopSummaryText();
      renderStopChoices();
    }

    function renderStopChoices() {
      var selected = (stopsSelect && stopsSelect.value) || '1';
      stopList.querySelectorAll('.fly2-stop-choice').forEach(function (button) {
        button.classList.toggle('is-selected', button.dataset.value === selected);
      });
    }

    function showNativeDatePicker(input) {
      if (!input || input.disabled) return;
      try {
        input.focus({ preventScroll: true });
      } catch (error) {
        try { input.focus(); } catch (ignored) {}
      }
      try {
        if (typeof input.showPicker === 'function') input.showPicker();
      } catch (ignored) {}
    }

    nativeDateIds.forEach(function (id) {
      var input = document.getElementById(id);
      if (!input) return;
      input.removeAttribute('readonly');
      input.setAttribute('inputmode', 'none');
      input.addEventListener('click', function () { showNativeDatePicker(input); });
      var control = input.closest('.control');
      if (control) {
        control.addEventListener('click', function (event) {
          if (event.target === input || event.target.closest('select')) return;
          event.preventDefault();
          showNativeDatePicker(input);
        });
      }
    });

    var suggestionPairs = [
      { input: document.getElementById('origin'), box: document.getElementById('originSuggestions') },
      { input: document.getElementById('destination'), box: document.getElementById('destinationSuggestions') }
    ];
    var activeSuggestionPair = null;

    function visibleViewport() {
      var vv = window.visualViewport;
      if (vv) return { top: vv.offsetTop || 0, bottom: (vv.offsetTop || 0) + vv.height };
      return { top: 0, bottom: window.innerHeight };
    }

    function positionSuggestion(pair) {
      if (!pair || !pair.input || !pair.box || pair.box.classList.contains('hidden')) return;
      var wrap = pair.input.closest('.input-wrap') || pair.input;
      var rect = wrap.getBoundingClientRect();
      var viewport = visibleViewport();
      var gap = 6;
      var below = viewport.bottom - rect.bottom - gap - 8;
      var above = rect.top - viewport.top - gap - 8;
      var useBelow = below >= 132 || below >= above;
      var maxHeight = Math.max(96, Math.min(270, useBelow ? below : above));
      var top = useBelow ? rect.bottom + gap : rect.top - gap - maxHeight;
      top = Math.max(viewport.top + 8, top);
      pair.box.classList.add('fly2-native-suggestions-floating');
      pair.box.style.left = Math.max(10, rect.left) + 'px';
      pair.box.style.width = Math.max(220, rect.width) + 'px';
      pair.box.style.top = top + 'px';
      pair.box.style.maxHeight = maxHeight + 'px';
      activeSuggestionPair = pair;
    }

    function scheduleSuggestion(pair) {
      window.setTimeout(function () { positionSuggestion(pair); }, 0);
      window.setTimeout(function () { positionSuggestion(pair); }, 90);
    }

    suggestionPairs.forEach(function (pair) {
      if (!pair.input || !pair.box) return;
      pair.input.addEventListener('focus', function () { scheduleSuggestion(pair); }, true);
      pair.input.addEventListener('input', function () { scheduleSuggestion(pair); }, true);
      pair.box.addEventListener('click', function () {
        window.setTimeout(function () {
          pair.box.classList.remove('fly2-native-suggestions-floating');
          pair.box.removeAttribute('style');
          if (activeSuggestionPair === pair) activeSuggestionPair = null;
        }, 80);
      }, true);
      new MutationObserver(function () { scheduleSuggestion(pair); })
        .observe(pair.box, { attributes: true, attributeFilter: ['class'] });
    });

    function repositionSuggestions() {
      if (activeSuggestionPair) positionSuggestion(activeSuggestionPair);
    }
    window.addEventListener('resize', repositionSuggestions, { passive: true });
    window.addEventListener('scroll', repositionSuggestions, { passive: true, capture: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', repositionSuggestions, { passive: true });
      window.visualViewport.addEventListener('scroll', repositionSuggestions, { passive: true });
    }

    document.addEventListener('input', function (event) {
      if (event.target.closest && event.target.closest('.fly2-native-sheet')) window.setTimeout(syncSummaries, 0);
    }, true);
    document.addEventListener('change', function () { window.setTimeout(syncSummaries, 0); }, true);
    document.addEventListener('click', function (event) {
      if (event.target.closest && event.target.closest('.segment,.chip,[data-flex-kind],#passengerConfirm,#passengerCancel,#closePassengers')) {
        window.setTimeout(syncSummaries, 0);
      }
    }, true);

    if (passengerSummary) {
      new MutationObserver(function () { syncSummaries(); })
        .observe(passengerSummary, { childList: true, characterData: true, subtree: true });
    }

    syncSummaries();
  });
})();
