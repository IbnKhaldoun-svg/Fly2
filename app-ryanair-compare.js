(() => {
  const KIWI_API = 'https://fly2-api.fly2-search.workers.dev/search';
  const COMPARE_API = 'https://fly2-api.fly2-search.workers.dev/ryanair-compare';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  let latestKiwiItems = [];
  let latestMatches = new Map();
  let latestRequest = null;
  let refreshQueued = false;

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (resource, init = {}) => {
    const url = typeof resource === 'string' ? resource : resource?.url;
    const response = await nativeFetch(resource, init);

    if (url && String(url).startsWith(KIWI_API) && String(init?.method || 'GET').toUpperCase() === 'POST') {
      try {
        latestRequest = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
        response.clone().json().then(data => {
          const items = data?.result?.itineraries;
          if (!Array.isArray(items)) return;
          latestKiwiItems = items;
          latestMatches = new Map();
          queueRefresh();
          compareIfUseful(items, latestRequest).catch(() => {});
        }).catch(() => {});
      } catch {}
    }

    return response;
  };

  const content = $('#resultContent');
  if (content) {
    new MutationObserver(queueRefresh).observe(content, { childList: true, subtree: true });
  }

  async function compareIfUseful(items, request) {
    if (!request || !isExactSearch(request)) return;
    const ryanairItems = items.filter(allRyanair);
    if (!ryanairItems.length) return;

    const sample = ryanairItems[0];
    const firstOut = sample.outbound?.segments?.[0];
    const lastOut = sample.outbound?.segments?.at(-1);
    if (!firstOut?.from || !lastOut?.to) return;

    const payload = {
      originIata: firstOut.from,
      destinationIata: lastOut.to,
      departureDate: request.departureDate,
      returnDate: request.returnDate || null,
      adults: request.adults || 1,
      children: request.children || 0,
      infants: request.infants || 0,
      maxStopovers: request.maxStopovers ?? 1,
      maxLayoverHours: request.maxLayoverHours ?? null,
      excludeStopoverCountries: request.excludeStopoverCountries || []
    };

    const response = await nativeFetch(COMPARE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok || !Array.isArray(data.itineraries)) return;

    const directByRouteTime = new Map(
      data.itineraries
        .filter(item => item?.signature && Number.isFinite(Number(item.totalPrice)))
        .map(item => [item.signature, item])
    );

    const matched = new Map();
    ryanairItems.forEach(kiwiItem => {
      const direct = directByRouteTime.get(itineraryRouteTimeSignature(kiwiItem));
      if (direct) matched.set(itinerarySignature(kiwiItem), direct);
    });
    latestMatches = matched;
    queueRefresh();
  }

  function isExactSearch(request) {
    if (!request?.departureDate) return false;
    if (request.departureDateTo || request.departureDateFlexDays) return false;
    if (request.returnDateTo || request.returnDateFlexDays) return false;
    if (request.nightsFrom || request.nightsTo || request.flyDays || request.returnFlyDays) return false;
    return true;
  }

  function allRyanair(item) {
    const segments = [...(item.outbound?.segments || []), ...(item.inbound?.segments || [])];
    return segments.length > 0 && segments.every(segment => normalizeCarrier(segment?.carrier) === 'FR');
  }

  function normalizeCarrier(value) {
    return String(value || '').trim().toUpperCase();
  }

  function itinerarySignature(item) {
    return [...(item.outbound?.segments || []), ...(item.inbound?.segments || [])]
      .map(segment => normalizeFlight(segment?.flightNumber))
      .filter(Boolean)
      .join('|');
  }

  function normalizeFlight(value) {
    return String(value || '').replace(/\s+/g, '').toUpperCase();
  }

  function itineraryRouteTimeSignature(item) {
    return [...(item.outbound?.segments || []), ...(item.inbound?.segments || [])]
      .map(segment => {
        const from = String(segment?.from || '').trim().toUpperCase();
        const to = String(segment?.to || '').trim().toUpperCase();
        const departure = wallClockMinute(segment?.departureTime);
        return from && to && departure ? `${from}-${to}@${departure}` : '';
      })
      .filter(Boolean)
      .join('|');
  }

  function wallClockMinute(value) {
    const text = String(value || '').trim();
    const match = text.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
    return match ? `${match[1]}T${match[2]}` : text.slice(0, 16);
  }

  function cardSignature(card) {
    return $$('.flight-segment > div:first-child span', card)
      .map(node => normalizeFlight(node.textContent))
      .filter(Boolean)
      .join('|');
  }

  function queueRefresh() {
    if (refreshQueued) return;
    refreshQueued = true;
    window.setTimeout(() => {
      refreshQueued = false;
      enhanceCards();
    }, 0);
  }

  function enhanceCards() {
    if (!latestMatches.size) return;
    const kiwiBySignature = new Map(latestKiwiItems.map(item => [itinerarySignature(item), item]));

    $$('#resultContent .flight-card').forEach(card => {
      const signature = cardSignature(card);
      const direct = latestMatches.get(signature);
      const kiwi = kiwiBySignature.get(signature);
      if (!direct || !kiwi) return;
      renderComparison(card, kiwi, direct);
    });
  }

  function renderComparison(card, kiwi, direct) {
    $('.ryanair-price-compare', card)?.remove();
    $('.ryanair-self-transfer-note', card)?.remove();
    $('.ryanair-segment-booking', card)?.remove();

    const priceArea = $('.flight-card-head > div:first-child', card);
    if (priceArea) {
      const kiwiPrice = Number(kiwi.price);
      const directPrice = Number(direct.totalPrice);
      const delta = Number.isFinite(kiwiPrice) ? kiwiPrice - directPrice : 0;

      const box = document.createElement('div');
      box.className = 'ryanair-price-compare';
      box.innerHTML = `
        <div class="ryanair-direct-price">
          <span>Ryanair diretto</span>
          <strong>${formatPrice(directPrice)}</strong>
        </div>
        <div class="ryanair-price-note">
          ${delta > 0.009
            ? `<strong>Risparmi ${formatPrice(delta)}</strong> rispetto al prezzo Kiwi`
            : delta < -0.009
              ? `Kiwi è più economico di <strong>${formatPrice(Math.abs(delta))}</strong>`
              : 'Stesso prezzo rilevato sulle due fonti'}
        </div>`;
      priceArea.appendChild(box);

      const kiwiPriceNode = $('.flight-price', card);
      if (kiwiPriceNode && !kiwiPriceNode.dataset.sourceLabelled) {
        kiwiPriceNode.dataset.sourceLabelled = 'true';
        kiwiPriceNode.insertAdjacentHTML('beforebegin', '<span class="kiwi-price-label">Kiwi</span>');
      }
    }

    const foot = $('.flight-foot', card);
    if (!foot) return;

    if (direct.selfTransfer) {
      const note = document.createElement('div');
      note.className = 'ryanair-self-transfer-note';
      note.innerHTML = '<strong>Self-transfer Ryanair:</strong> i segmenti sono biglietti separati; bagagli, nuovo check-in e coincidenze restano a carico del viaggiatore.';
      foot.insertAdjacentElement('beforebegin', note);
    }

    const existingOfficial = $$('.airline-official-link', foot).find(link => /Ryanair/i.test(link.textContent));
    if (existingOfficial) existingOfficial.style.display = 'none';

    if (Array.isArray(direct.bookingLinks) && direct.bookingLinks.length) {
      const details = document.createElement('details');
      details.className = 'ryanair-segment-booking';
      details.innerHTML = `
        <summary>Prenota su Ryanair ↗</summary>
        <div class="ryanair-segment-links">
          ${direct.bookingLinks.map(link => `
            <a href="${escAttr(link.url)}" target="_blank" rel="noopener noreferrer">
              <strong>${esc(link.label)}</strong>
              <span>${esc(link.flightNumber || '')} · ${formatDate(link.departureAt)}</span>
            </a>`).join('')}
        </div>`;
      const kiwiLink = $('.book-link', foot);
      if (kiwiLink) foot.insertBefore(details, kiwiLink);
      else foot.appendChild(details);
    }
  }

  function formatPrice(value) {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(value));
  }

  function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
    return new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }).format(date).replace(/\./g, '');
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({
      '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
    }[char]));
  }

  function escAttr(value) { return esc(value); }
})();