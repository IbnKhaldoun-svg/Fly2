(() => {
  const KIWI_API = 'https://fly2-api.fly2-search.workers.dev/search';
  const COMPARE_API = 'https://fly2-api.fly2-search.workers.dev/ryanair-compare';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  let latestKiwiItems = [];
  let latestMatches = new Map();
  let latestRequest = null;
  let refreshQueued = false;
  const bookingStore = new Map();

  window.fly2Pricing = {
    effectivePrice(item) {
      const kiwiPrice = Number(item?.price);
      const direct = latestMatches.get(itinerarySignature(item));
      const directPrice = Number(direct?.totalPrice);
      if (Number.isFinite(kiwiPrice) && Number.isFinite(directPrice)) return Math.min(kiwiPrice, directPrice);
      if (Number.isFinite(directPrice)) return directPrice;
      return Number.isFinite(kiwiPrice) ? kiwiPrice : Infinity;
    },
    directPrice(item) {
      const direct = latestMatches.get(itinerarySignature(item));
      const price = Number(direct?.totalPrice);
      return Number.isFinite(price) ? price : null;
    },
    source(item) {
      const kiwiPrice = Number(item?.price);
      const direct = latestMatches.get(itinerarySignature(item));
      const directPrice = Number(direct?.totalPrice);
      return Number.isFinite(directPrice) && (!Number.isFinite(kiwiPrice) || directPrice < kiwiPrice)
        ? 'Ryanair diretto'
        : 'Kiwi';
    }
  };

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

  const bookingModal = createBookingModal();

  document.addEventListener('click', event => {
    const button = event.target.closest?.('.ryanair-booking-button[data-booking-key]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const booking = bookingStore.get(button.dataset.bookingKey);
    if (booking) openBookingModal(booking.items, booking.direct);
  }, true);

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

    const directItems = data.itineraries
      .filter(item => Number.isFinite(Number(item?.totalPrice)));

    const directByRouteTime = new Map(
      directItems.map(item => [directRouteTimeSignature(item), item])
    );

    const directByRouteDate = new Map();
    directItems.forEach(item => {
      const key = directRouteDateSignature(item);
      const current = directByRouteDate.get(key);
      if (!current || Number(item.totalPrice) < Number(current.totalPrice)) {
        directByRouteDate.set(key, item);
      }
    });

    const matched = new Map();
    ryanairItems.forEach(kiwiItem => {
      const direct =
        directByRouteTime.get(itineraryRouteTimeSignature(kiwiItem)) ||
        directByRouteDate.get(itineraryRouteDateSignature(kiwiItem));
      if (direct) matched.set(itinerarySignature(kiwiItem), direct);
    });
    latestMatches = matched;
    queueRefresh();
    window.setTimeout(() => window.fly2LiveResultsApi?.rerender?.(), 0);
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

  function itineraryRouteDateSignature(item) {
    return [...(item.outbound?.segments || []), ...(item.inbound?.segments || [])]
      .map(segment => {
        const from = String(segment?.from || '').trim().toUpperCase();
        const to = String(segment?.to || '').trim().toUpperCase();
        const date = String(segment?.departureTime || '').slice(0, 10);
        return from && to && date ? `${from}-${to}@${date}` : '';
      })
      .filter(Boolean)
      .join('|');
  }

  function directRouteTimeSignature(item) {
    return [...(item.outbound?.segments || []), ...(item.inbound?.segments || [])]
      .map(segment => {
        const from = String(segment?.from || '').trim().toUpperCase();
        const to = String(segment?.to || '').trim().toUpperCase();
        const departure = wallClockMinute(segment?.departureAt);
        return from && to && departure ? `${from}-${to}@${departure}` : '';
      })
      .filter(Boolean)
      .join('|');
  }

  function directRouteDateSignature(item) {
    return [...(item.outbound?.segments || []), ...(item.inbound?.segments || [])]
      .map(segment => {
        const from = String(segment?.from || '').trim().toUpperCase();
        const to = String(segment?.to || '').trim().toUpperCase();
        const date = String(segment?.departureAt || '').slice(0, 10);
        return from && to && date ? `${from}-${to}@${date}` : '';
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
    if (!latestKiwiItems.length) return;

    const kiwiBySignature = new Map(latestKiwiItems.map(item => [itinerarySignature(item), item]));

    $$('#resultContent .flight-card').forEach((card, index) => {
      const signature = cardSignature(card);
      const kiwi = kiwiBySignature.get(signature) || latestKiwiItems[index];
      if (!kiwi || !allRyanair(kiwi)) return;

      card.dataset.ryanairItinerary = 'true';
      hideGenericRyanairLink(card);
      ensureRyanairBooking(card, kiwi, signature || itinerarySignature(kiwi));

      const direct = latestMatches.get(itinerarySignature(kiwi));
      if (direct) {
        const enhancementKey = `${itinerarySignature(kiwi)}|${Number(direct.totalPrice)}`;
        if (card.dataset.ryanairPriceEnhanced !== enhancementKey) {
          renderComparison(card, kiwi, direct);
          card.dataset.ryanairPriceEnhanced = enhancementKey;
        }
      } else {
        ensurePricePending(card);
      }
    });
  }

  function hideGenericRyanairLink(card) {
    $$('.airline-official-link', card).forEach(link => {
      if (/Ryanair/i.test(link.textContent || '')) link.style.display = 'none';
    });
  }

  function ensurePricePending(card) {
    if ($('.ryanair-price-compare', card) || $('.ryanair-price-pending', card)) return;
    const priceArea = $('.flight-card-head > div:first-child', card);
    if (!priceArea || !isExactSearch(latestRequest)) return;
    const pending = document.createElement('div');
    pending.className = 'ryanair-price-pending';
    pending.textContent = 'Verifico il prezzo diretto Ryanair…';
    priceArea.appendChild(pending);
  }

  function ensureRyanairBooking(card, kiwi, signature) {
    const foot = $('.flight-foot', card);
    if (!foot) return;

    const bookingKey = `ryanair|${signature}`;
    const items = buildBookingItemsFromKiwi(kiwi, latestRequest);
    bookingStore.set(bookingKey, {
      items,
      direct: { selfTransfer: hasSelfTransfer(kiwi) }
    });

    let button = $('.ryanair-booking-button', foot);
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'ryanair-booking-button';
      button.setAttribute('aria-haspopup', 'dialog');
      button.innerHTML = 'Prenota su Ryanair <span aria-hidden="true">↗</span>';
      const kiwiLink = $('.book-link', foot);
      if (kiwiLink) foot.insertBefore(button, kiwiLink);
      else foot.appendChild(button);
    }
    button.dataset.bookingKey = bookingKey;
  }

  function hasSelfTransfer(kiwi) {
    const legs = [kiwi.outbound, kiwi.inbound].filter(Boolean);
    return legs.some(leg => Number(leg?.stops || 0) > 0);
  }

  function renderComparison(card, kiwi, direct) {
    $('.ryanair-price-compare', card)?.remove();
    $('.ryanair-price-pending', card)?.remove();
    $('.ryanair-self-transfer-note', card)?.remove();

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

    hideGenericRyanairLink(card);
  }

  function buildBookingItemsFromKiwi(kiwi, request) {
    const outboundSegments = kiwi.outbound?.segments || [];
    const inboundSegments = kiwi.inbound?.segments || [];
    const allSegments = [...outboundSegments, ...inboundSegments];
    const cityMap = buildCityMap(kiwi);

    return allSegments.map((segment, index) => {
      const from = String(segment?.from || '').trim();
      const to = String(segment?.to || '').trim();
      const departureAt = segment?.departureTime || '';
      return {
        url: buildRyanairSegmentUrl(from, to, departureAt, request),
        from,
        to,
        fromCity: cityMap.get(from) || segment?.fromCity || from,
        toCity: cityMap.get(to) || segment?.toCity || to,
        flightNumber: segment?.flightNumber || '',
        departureAt,
        arrivalAt: segment?.arrivalTime || '',
        direction: index < outboundSegments.length ? 'Andata' : 'Ritorno'
      };
    });
  }

  function buildRyanairSegmentUrl(origin, destination, departureAt, request = {}) {
    const dateOut = String(departureAt || '').slice(0, 10);
    const adults = String(request?.adults ?? 1);
    const children = String(request?.children ?? 0);
    const infants = String(request?.infants ?? 0);
    const teens = '0';

    const params = new URLSearchParams({
      adults,
      teens,
      children,
      infants,
      dateOut,
      dateIn: '',
      isConnectedFlight: 'false',
      discount: '0',
      promoCode: '',
      originIata: origin,
      destinationIata: destination,
      tpAdults: adults,
      tpTeens: teens,
      tpChildren: children,
      tpInfants: infants,
      tpStartDate: dateOut,
      tpEndDate: '',
      tpDiscount: '0',
      tpPromoCode: '',
      tpOriginIata: origin,
      tpDestinationIata: destination
    });

    return `https://www.ryanair.com/it/it/trip/flights/select?${params.toString()}`;
  }

  function buildCityMap(kiwi) {
    const map = new Map();
    [kiwi.outbound, kiwi.inbound].filter(Boolean).forEach(leg => {
      const route = Array.isArray(leg.route) ? leg.route : [];
      const segments = Array.isArray(leg.segments) ? leg.segments : [];
      segments.forEach((segment, index) => {
        const fromName = segment?.fromCity || route[index];
        const toName = segment?.toCity || route[index + 1];
        if (segment?.from && fromName) map.set(String(segment.from).trim(), cleanPlaceName(fromName));
        if (segment?.to && toName) map.set(String(segment.to).trim(), cleanPlaceName(toName));
      });
    });
    return map;
  }

  function cleanPlaceName(value) {
    return String(value || '').replace(/\s*\([A-Z]{3}\)\s*$/, '').replace(/,\s*[A-Z]{2}\s*$/, '').trim();
  }

  function createBookingModal() {
    const modal = document.createElement('div');
    modal.className = 'ryanair-booking-modal hidden';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <div class="ryanair-booking-backdrop" data-ryanair-close></div>
      <section class="ryanair-booking-dialog" role="dialog" aria-modal="true" aria-labelledby="ryanairBookingTitle">
        <div class="ryanair-booking-head">
          <div>
            <span class="ryanair-booking-kicker">Prenotazione diretta</span>
            <h2 id="ryanairBookingTitle">Prenota i segmenti su Ryanair</h2>
          </div>
          <button type="button" class="ryanair-booking-close" data-ryanair-close aria-label="Chiudi">×</button>
        </div>
        <p class="ryanair-booking-intro">Ogni tratto è un biglietto separato. Aprendo Ryanair troverai aeroporto, data e passeggeri già impostati: verifica il volo indicato prima del pagamento.</p>
        <div class="ryanair-booking-list"></div>
      </section>`;
    document.body.appendChild(modal);

    modal.addEventListener('click', event => {
      if (event.target.closest('[data-ryanair-close]')) closeBookingModal();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !modal.classList.contains('hidden')) closeBookingModal();
    });

    return modal;
  }

  function openBookingModal(items, direct) {
    const list = $('.ryanair-booking-list', bookingModal);
    if (!list) return;

    let currentDirection = '';
    list.innerHTML = items.map((item, index) => {
      const directionTitle = item.direction !== currentDirection
        ? (() => { currentDirection = item.direction; return `<h3 class="ryanair-booking-direction">${esc(item.direction)}</h3>`; })()
        : '';
      const timeText = item.departureAt
        ? `${formatDate(item.departureAt)} · ${formatTime(item.departureAt)}`
        : '';
      return `${directionTitle}
        <article class="ryanair-booking-row">
          <div class="ryanair-booking-step">${index + 1}</div>
          <div class="ryanair-booking-route">
            <strong>${esc(item.fromCity)} (${esc(item.from)}) → ${esc(item.toCity)} (${esc(item.to)})</strong>
            <span>${esc(item.flightNumber)}${timeText ? ` · ${esc(timeText)}` : ''}</span>
          </div>
          <a class="ryanair-open-link" href="${escAttr(item.url)}" target="_blank" rel="noopener noreferrer">
            Apri su Ryanair ↗
          </a>
        </article>`;
    }).join('');

    const intro = $('.ryanair-booking-intro', bookingModal);
    if (intro) {
      intro.innerHTML = direct.selfTransfer
        ? '<strong>Self-transfer:</strong> questi segmenti sono prenotazioni separate. Rotta, data e passeggeri saranno già compilati su Ryanair; controlla il numero di volo e l’orario prima di acquistare.'
        : 'Rotta, data e passeggeri saranno già compilati su Ryanair; controlla il numero di volo e l’orario prima di acquistare.';
    }

    bookingModal.classList.remove('hidden');
    bookingModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('ryanair-modal-open');
    $('.ryanair-booking-close', bookingModal)?.focus();
  }

  function closeBookingModal() {
    bookingModal.classList.add('hidden');
    bookingModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('ryanair-modal-open');
  }

  function formatTime(value) {
    const text = String(value || '');
    const match = text.match(/T(\d{2}:\d{2})/);
    return match ? match[1] : '';
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