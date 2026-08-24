(() => {
  const API_URL = 'https://fly2-api.fly2-search.workers.dev/search';
  const nativeFetch = window.fetch.bind(window);
  let latestItineraries = [];
  const officialBookingStore = new Map();
  const officialBookingModal = createOfficialBookingModal();

  const officialAirlineSites = {
    FR: 'https://www.ryanair.com/',
    U2: 'https://www.easyjet.com/',
    W6: 'https://www.wizzair.com/',
    W4: 'https://www.wizzair.com/',
    W9: 'https://www.wizzair.com/',
    VY: 'https://www.vueling.com/',
    V7: 'https://www.volotea.com/',
    AZ: 'https://www.ita-airways.com/',
    LH: 'https://www.lufthansa.com/',
    LX: 'https://www.swiss.com/',
    AF: 'https://www.airfrance.com/',
    KL: 'https://www.klm.com/',
    IB: 'https://www.iberia.com/',
    BA: 'https://www.britishairways.com/',
    TP: 'https://www.flytap.com/',
    TK: 'https://www.turkishairlines.com/',
    AT: 'https://www.royalairmaroc.com/',
    HV: 'https://www.transavia.com/',
    EW: 'https://www.eurowings.com/',
    OS: 'https://www.austrian.com/',
    DY: 'https://www.norwegian.com/',
    PC: 'https://www.flypgs.com/',
    SN: 'https://www.brusselsairlines.com/'
  };

  const countryIt = {
    Albania: 'Albania', Austria: 'Austria', Belgium: 'Belgio', Bulgaria: 'Bulgaria', Croatia: 'Croazia',
    Cyprus: 'Cipro', Denmark: 'Danimarca', Egypt: 'Egitto', Finland: 'Finlandia', France: 'Francia',
    Germany: 'Germania', Greece: 'Grecia', Hungary: 'Ungheria', Iceland: 'Islanda', Ireland: 'Irlanda',
    Italy: 'Italia', Malta: 'Malta', Morocco: 'Marocco', Netherlands: 'Paesi Bassi', Norway: 'Norvegia',
    Poland: 'Polonia', Portugal: 'Portogallo', Qatar: 'Qatar', Romania: 'Romania', Serbia: 'Serbia',
    Spain: 'Spagna', Sweden: 'Svezia', Switzerland: 'Svizzera', Tunisia: 'Tunisia', Turkey: 'Turchia',
    'United Kingdom': 'Regno Unito', 'United Arab Emirates': 'Emirati Arabi Uniti',
    'Czech Republic': 'Repubblica Ceca', Czechia: 'Repubblica Ceca', 'North Macedonia': 'Macedonia del Nord'
  };

  window.fetch = async (...args) => {
    const response = await nativeFetch(...args);
    try {
      const target = typeof args[0] === 'string' ? args[0] : args[0]?.url;
      if (target && String(target).startsWith(API_URL)) {
        response.clone().json().then(data => {
          const items = data?.result?.itineraries;
          if (Array.isArray(items)) {
            latestItineraries = items;
            window.setTimeout(enhanceResults, 0);
          }
        }).catch(() => {});
      }
    } catch {}
    return response;
  };

  const content = document.querySelector('#resultContent');
  if (content) {
    new MutationObserver(() => window.setTimeout(enhanceResults, 0))
      .observe(content, { childList: true, subtree: true });
  }

  function enhanceResults() {
    if (!latestItineraries.length) return;
    const cards = [...document.querySelectorAll('#resultContent .flight-card')];
    if (!cards.length) return;

    const bySignature = new Map();
    latestItineraries.forEach(item => {
      const sig = itinerarySignature(item);
      if (sig && !bySignature.has(sig)) bySignature.set(sig, item);
    });

    cards.forEach((card, index) => {
      if (card.dataset.fly2Details === 'true') return;
      const item = bySignature.get(cardSignature(card)) || latestItineraries[index];
      if (!item) return;
      enhanceCard(card, item);
      card.dataset.fly2Details = 'true';
    });
  }

  function enhanceCard(card, item) {
    const legs = [...card.querySelectorAll('.flight-leg')];
    if (legs[0] && item.outbound) enhanceLeg(legs[0], item.outbound);
    if (legs[1] && item.inbound) enhanceLeg(legs[1], item.inbound);

    const foot = card.querySelector('.flight-foot');
    if (!foot) return;

    const kiwi = foot.querySelector('.book-link:not(.disabled)');
    if (kiwi) kiwi.textContent = 'Prenota con Kiwi ↗';

    const segments = allSegments(item);
    const allRyanair = segments.length > 0 && segments.every(segment => segment?.carrier === 'FR');

    if (!allRyanair && segments.some(segment => officialAirlineSites[segment?.carrier])) {
      const key = itinerarySignature(item) || String(Math.random());
      officialBookingStore.set(key, item);

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'official-booking-button';
      button.dataset.officialBookingKey = key;
      button.setAttribute('aria-haspopup', 'dialog');
      button.textContent = 'Prenota sui siti ufficiali ↗';

      if (kiwi) foot.insertBefore(button, kiwi);
      else foot.appendChild(button);
    }
  }

  document.addEventListener('click', event => {
    const button = event.target.closest?.('.official-booking-button[data-official-booking-key]');
    if (!button) return;
    event.preventDefault();
    const item = officialBookingStore.get(button.dataset.officialBookingKey);
    if (item) openOfficialBookingModal(item);
  }, true);

  function allSegments(item) {
    return [...(item.outbound?.segments || []), ...(item.inbound?.segments || [])];
  }

  function createOfficialBookingModal() {
    const modal = document.createElement('div');
    modal.className = 'official-booking-modal hidden';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <div class="official-booking-backdrop" data-official-close></div>
      <section class="official-booking-dialog" role="dialog" aria-modal="true" aria-labelledby="officialBookingTitle">
        <div class="official-booking-head">
          <div>
            <span class="official-booking-kicker">Prenotazione diretta</span>
            <h2 id="officialBookingTitle">Prenota sui siti ufficiali</h2>
          </div>
          <button type="button" class="official-booking-close" data-official-close aria-label="Chiudi">×</button>
        </div>
        <p class="official-booking-intro">Ogni tratta viene aperta sul sito ufficiale della compagnia. Per Ryanair Fly2 precompila rotta, data e passeggeri; per le altre compagnie, quando non esiste un deep-link stabile, si apre il sito ufficiale.</p>
        <div class="official-booking-list"></div>
      </section>`;
    document.body.appendChild(modal);

    modal.addEventListener('click', event => {
      if (event.target.closest('[data-official-close]')) closeOfficialBookingModal();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !modal.classList.contains('hidden')) closeOfficialBookingModal();
    });

    return modal;
  }

  function openOfficialBookingModal(item) {
    const list = officialBookingModal.querySelector('.official-booking-list');
    if (!list) return;

    const outboundCount = item.outbound?.segments?.length || 0;
    const passengers = readPassengers();
    const segments = allSegments(item);

    list.innerHTML = segments.map((segment, index) => {
      const carrier = segment?.carrier || '';
      const airline = segment?.carrierName || carrier || 'Compagnia';
      const official = officialAirlineSites[carrier];
      const prefilled = carrier === 'FR';
      const href = prefilled
        ? buildRyanairUrl(segment?.from, segment?.to, segment?.departureTime, passengers)
        : official;

      if (!href) return '';

      const direction = index < outboundCount ? 'Andata' : 'Ritorno';
      const fromCity = segment?.fromCity || segment?.from || '';
      const toCity = segment?.toCity || segment?.to || '';
      const route = `${fromCity} (${segment?.from || ''}) → ${toCity} (${segment?.to || ''})`;
      const when = formatSegmentDateTime(segment?.departureTime);

      return `
        <article class="official-booking-row">
          <div class="official-booking-step">${index + 1}</div>
          <div class="official-booking-route">
            <span class="official-booking-direction">${escapeHtml(direction)} · ${escapeHtml(airline)}</span>
            <strong>${escapeHtml(route)}</strong>
            <span>${escapeHtml(segment?.flightNumber || '')}${when ? ` · ${escapeHtml(when)}` : ''}</span>
            <small>${prefilled ? 'Rotta, data e passeggeri già impostati' : 'Apre il sito ufficiale; la ricerca potrebbe dover essere compilata'}</small>
          </div>
          <a class="official-open-link" href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">
            ${prefilled ? 'Apri già impostato ↗' : 'Apri sito ufficiale ↗'}
          </a>
        </article>`;
    }).join('');

    officialBookingModal.classList.remove('hidden');
    officialBookingModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('official-modal-open');
    officialBookingModal.querySelector('.official-booking-close')?.focus();
  }

  function closeOfficialBookingModal() {
    officialBookingModal.classList.add('hidden');
    officialBookingModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('official-modal-open');
  }

  function readPassengers() {
    const count = (id, fallback) => Number(document.querySelector('#count-' + id)?.textContent || fallback);
    return {
      adults: count('adults', 1),
      children: count('children', 0),
      infants: count('infantsSeat', 0) + count('infantsLap', 0),
      teens: 0
    };
  }

  function buildRyanairUrl(origin, destination, departureAt, passengers) {
    const dateOut = String(departureAt || '').slice(0, 10);
    const params = new URLSearchParams({
      adults: String(passengers.adults || 1),
      teens: String(passengers.teens || 0),
      children: String(passengers.children || 0),
      infants: String(passengers.infants || 0),
      dateOut,
      dateIn: '',
      isConnectedFlight: 'false',
      discount: '0',
      promoCode: '',
      originIata: origin || '',
      destinationIata: destination || '',
      tpAdults: String(passengers.adults || 1),
      tpTeens: String(passengers.teens || 0),
      tpChildren: String(passengers.children || 0),
      tpInfants: String(passengers.infants || 0),
      tpStartDate: dateOut,
      tpEndDate: '',
      tpDiscount: '0',
      tpPromoCode: '',
      tpOriginIata: origin || '',
      tpDestinationIata: destination || ''
    });
    return `https://www.ryanair.com/it/it/trip/flights/select?${params.toString()}`;
  }

  function formatSegmentDateTime(value) {
    if (!value) return '';
    const text = String(value);
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})/);
    if (!match) return text.slice(0, 16);
    return `${match[3]}/${match[2]}/${match[1]} · ${match[4]}`;
  }

  function enhanceLeg(root, leg) {
    const segments = Array.isArray(leg.segments) ? leg.segments : [];
    if (!segments.length) return;

    const title = root.querySelector('.flight-leg-title');
    const routeText = title?.querySelector('span:nth-of-type(1)');
    if (routeText) routeText.textContent = formatCityRoute(segments);

    if (root.querySelector('.flight-place-details')) return;

    const details = document.createElement('div');
    details.className = 'flight-place-details';

    const countries = pathPoints(segments)
      .map(point => translateCountry(point.country))
      .filter(Boolean);
    const airports = pathPoints(segments)
      .map(point => point.airport)
      .filter(Boolean);

    const countryLine = countries.length ? `<span><strong>Paesi</strong> ${escapeHtml(countries.join(' → '))}</span>` : '';
    const airportLine = airports.length ? `<span><strong>Aeroporti</strong> ${escapeHtml(airports.join(' → '))}</span>` : '';
    details.innerHTML = countryLine + airportLine;

    if (details.childNodes.length && title) title.insertAdjacentElement('afterend', details);
  }

  function pathPoints(segments) {
    const points = segments.map(segment => ({
      city: segment.fromCity || segment.from,
      code: segment.from,
      country: segment.fromCountry,
      airport: segment.fromName
    }));
    const last = segments[segments.length - 1];
    points.push({
      city: last.toCity || last.to,
      code: last.to,
      country: last.toCountry,
      airport: last.toName
    });
    return points;
  }

  function formatCityRoute(segments) {
    return pathPoints(segments)
      .map(point => `${point.city || point.code || '—'}${point.code ? ` (${point.code})` : ''}`)
      .join(' → ');
  }

  function uniqueAirlines(item) {
    const all = [...(item.outbound?.segments || []), ...(item.inbound?.segments || [])];
    const seen = new Set();
    const out = [];
    all.forEach(segment => {
      const code = segment?.carrier;
      if (!code || seen.has(code)) return;
      seen.add(code);
      out.push({ code, name: segment.carrierName || code });
    });
    return out;
  }

  function itinerarySignature(item) {
    return [...(item.outbound?.segments || []), ...(item.inbound?.segments || [])]
      .map(segment => segment?.flightNumber || '')
      .filter(Boolean)
      .join('|');
  }

  function cardSignature(card) {
    return [...card.querySelectorAll('.flight-segment > div:first-child span')]
      .map(span => span.textContent.trim())
      .filter(Boolean)
      .join('|');
  }

  function translateCountry(value) {
    return countryIt[value] || value || '';
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[char]));
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }
})();
