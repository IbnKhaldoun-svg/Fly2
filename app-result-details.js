(() => {
  const API_URL = 'https://fly2-api.fly2-search.workers.dev/search';
  const nativeFetch = window.fetch.bind(window);
  let latestItineraries = [];

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

    const airlines = uniqueAirlines(item);
    const links = airlines
      .filter(airline => officialAirlineSites[airline.code])
      .map(airline => `<a class="airline-official-link" href="${escapeAttr(officialAirlineSites[airline.code])}" target="_blank" rel="noopener noreferrer">Sito ufficiale ${escapeHtml(airline.name)} ↗</a>`)
      .join('');

    if (links) {
      const wrap = document.createElement('div');
      wrap.className = 'official-airline-links';
      wrap.innerHTML = links;
      if (kiwi) foot.insertBefore(wrap, kiwi);
      else foot.appendChild(wrap);
    }
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
