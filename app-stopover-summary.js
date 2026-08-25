(() => {
  const AIRPORT_META_API = 'https://fly2-api.fly2-search.workers.dev/airports';
  const metaCache = new Map();
  const missingMeta = new Set();
  let metaPending = false;
  let refreshQueued = false;

  const countries = (() => {
    try { return new Intl.DisplayNames(['it-IT'], { type: 'region' }); }
    catch { return null; }
  })();

  const style = document.createElement('style');
  style.textContent = `
    .flight-compact-times.fly2-has-stopovers{grid-template-columns:minmax(92px,1fr) minmax(0,auto) minmax(92px,1fr);gap:10px}
    .fly2-stopover-inline{display:flex;align-items:center;justify-content:center;gap:6px;max-width:min(58vw,620px);overflow-x:auto;overscroll-behavior-inline:contain;scrollbar-width:none;padding:1px 0}
    .fly2-stopover-inline::-webkit-scrollbar{display:none}
    .fly2-stopover-pill{display:inline-flex;align-items:center;gap:5px;min-height:34px;padding:4px 9px;border:1px solid rgba(194,132,31,.38);border-radius:999px;background:linear-gradient(135deg,#fffaf0,#fff3d7);box-shadow:0 4px 14px rgba(91,67,22,.07);color:#4d3815;white-space:nowrap}
    .fly2-stopover-flag{display:grid;place-items:center;width:22px;height:22px;border-radius:50%;background:#fff;font-size:11px;box-shadow:0 2px 7px rgba(91,67,22,.09)}
    .fly2-stopover-pill strong{font-size:10.5px;font-weight:900;color:#3f2d0e}
    .fly2-stopover-pill small{font-size:9.5px;font-weight:750;color:#7b5c27}
    .flight-compact-layovers.fly2-hide-legacy-layover{display:none!important}
    @media(max-width:700px){
      .flight-compact-times.fly2-has-stopovers{grid-template-columns:minmax(70px,1fr) minmax(0,auto) minmax(70px,1fr);gap:6px}
      .fly2-stopover-inline{max-width:56vw;gap:5px}
      .fly2-stopover-pill{min-height:31px;padding:3px 7px;gap:4px}
      .fly2-stopover-flag{width:19px;height:19px;font-size:10px}
      .fly2-stopover-pill strong{font-size:9.5px}.fly2-stopover-pill small{font-size:8.5px}
    }
    @media(max-width:430px){
      .flight-compact-times.fly2-has-stopovers{grid-template-columns:minmax(62px,1fr) minmax(0,auto) minmax(62px,1fr)}
      .fly2-stopover-inline{max-width:54vw}
    }
  `;
  document.head.appendChild(style);

  function esc(value) {
    return String(value ?? '').replace(/[&<>'\"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '\"':'&quot;' }[char]));
  }

  function normalizeCountry(value) {
    const code = String(value || '').trim().toUpperCase().replace(/^UK$/, 'GB');
    return /^[A-Z]{2}$/.test(code) ? code : '';
  }

  function countryName(code) {
    const normalized = normalizeCountry(code);
    if (!normalized) return '';
    try { return countries?.of(normalized) || normalized; }
    catch { return normalized; }
  }

  function flag(code) {
    const normalized = normalizeCountry(code);
    if (!normalized) return '✦';
    return [...normalized].map(char => String.fromCodePoint(127397 + char.charCodeAt(0))).join('');
  }

  function cleanCity(value, code) {
    const city = String(value || '').trim();
    if (!city) return '';
    const upper = city.toUpperCase();
    if (upper === String(code || '').toUpperCase() || /^[A-Z]{3}$/.test(upper)) return '';
    const normalized = city.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (['scalo','layover','stopover','connection','coincidenza','cambio'].includes(normalized)) return '';
    return city;
  }

  function minutesBetween(arrival, departure) {
    const a = new Date(String(arrival || '')).getTime();
    const b = new Date(String(departure || '')).getTime();
    if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
    return Math.round((b - a) / 60000);
  }

  function duration(minutes) {
    if (!Number.isFinite(minutes)) return 'durata n/d';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (!h) return `${m} min`;
    return m ? `${h}h ${String(m).padStart(2, '0')}m` : `${h}h`;
  }

  function itineraryKey(item) {
    return [...(item?.outbound?.segments || []), ...(item?.inbound?.segments || [])]
      .map(segment => {
        const from = String(segment?.from || '').trim().toUpperCase();
        const to = String(segment?.to || '').trim().toUpperCase();
        const departure = String(segment?.departureTime || '').slice(0, 16);
        return from && to && departure ? `${from}-${to}@${departure}` : '';
      })
      .filter(Boolean)
      .join('|');
  }

  function stopData(leg) {
    const segments = Array.isArray(leg?.segments) ? leg.segments : [];
    if (segments.length < 2) return [];

    return segments.slice(0, -1).map((segment, index) => {
      const next = segments[index + 1];
      const code = String(segment?.to || next?.from || '').trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(code)) return null;

      const meta = metaCache.get(code) || {};
      const city = cleanCity(segment?.toCity || next?.fromCity, code) || cleanCity(meta.city, code) || code;
      const countryCode = normalizeCountry(segment?.toCountry || next?.fromCountry || meta.countryCode);
      const minutes = minutesBetween(segment?.arrivalTime, next?.departureTime);

      return {
        code,
        city,
        countryCode,
        country: countryName(countryCode),
        flag: flag(countryCode),
        minutes,
        duration: duration(minutes)
      };
    }).filter(Boolean);
  }

  function signature(stops) {
    return stops.map(stop => [stop.code, stop.city, stop.countryCode, stop.duration].join('~')).join('|');
  }

  function renderLeg(section, leg) {
    const times = section?.querySelector('.flight-compact-times');
    if (!times) return;

    const stops = stopData(leg);
    const existing = times.querySelector(':scope > .fly2-stopover-inline');
    const middle = [...times.children].find(node => node !== existing && node.tagName === 'SPAN');

    if (!stops.length) {
      times.classList.remove('fly2-has-stopovers');
      if (existing) {
        const arrow = document.createElement('span');
        arrow.textContent = '→';
        existing.replaceWith(arrow);
      }
      return;
    }

    const currentSignature = signature(stops);
    if (existing?.dataset.signature === currentSignature) return;

    const center = document.createElement('span');
    center.className = 'fly2-stopover-inline';
    center.dataset.signature = currentSignature;
    center.innerHTML = stops.map(stop => {
      const detail = [stop.country, stop.duration].filter(Boolean).join(' · ');
      return `<span class="fly2-stopover-pill" title="Scalo a ${esc(stop.city)}${stop.country ? `, ${esc(stop.country)}` : ''} · ${esc(stop.duration)}">
        <span class="fly2-stopover-flag" aria-hidden="true">${esc(stop.flag)}</span>
        <strong>Scalo a ${esc(stop.city)}</strong>
        <small>${esc(detail)}</small>
      </span>`;
    }).join('');

    if (existing) existing.replaceWith(center);
    else if (middle) middle.replaceWith(center);
    else {
      const rightTime = [...times.querySelectorAll(':scope > strong')].at(-1);
      if (rightTime) times.insertBefore(center, rightTime);
      else times.appendChild(center);
    }

    times.classList.add('fly2-has-stopovers');
    section.querySelector('.flight-compact-layovers')?.classList.add('fly2-hide-legacy-layover');
  }

  function enhanceAll() {
    const items = window.fly2LiveResultsApi?.getResults?.();
    if (!Array.isArray(items) || !items.length) return;

    const byKey = new Map(items.map(item => [itineraryKey(item), item]));
    document.querySelectorAll('#resultContent .flight-card[data-itinerary-key]').forEach(card => {
      const item = byKey.get(String(card.dataset.itineraryKey || ''));
      if (!item) return;
      const legs = card.querySelectorAll('.flight-compact-leg');
      if (legs[0]) renderLeg(legs[0], item.outbound);
      if (legs[1]) renderLeg(legs[1], item.inbound);
    });

    prefetchMetadata(items);
  }

  function collectMissingCodes(items) {
    const codes = new Set();
    for (const item of items) {
      for (const leg of [item?.outbound, item?.inbound]) {
        const segments = Array.isArray(leg?.segments) ? leg.segments : [];
        segments.slice(0, -1).forEach((segment, index) => {
          const next = segments[index + 1];
          const code = String(segment?.to || next?.from || '').trim().toUpperCase();
          if (!/^[A-Z]{3}$/.test(code) || metaCache.has(code) || missingMeta.has(code)) return;
          const hasCity = Boolean(cleanCity(segment?.toCity || next?.fromCity, code));
          const hasCountry = Boolean(normalizeCountry(segment?.toCountry || next?.fromCountry));
          if (!hasCity || !hasCountry) codes.add(code);
        });
      }
    }
    return [...codes].slice(0, 100);
  }

  async function prefetchMetadata(items) {
    if (metaPending) return;
    const codes = collectMissingCodes(items);
    if (!codes.length) return;

    metaPending = true;
    try {
      const url = new URL(AIRPORT_META_API);
      url.searchParams.set('codes', codes.join(','));
      const response = await fetch(url.toString());
      const data = await response.json().catch(() => null);
      const airports = response.ok && data?.ok && Array.isArray(data.airports) ? data.airports : [];
      const found = new Set();

      airports.forEach(airport => {
        const code = String(airport?.iataCode || '').trim().toUpperCase();
        if (!/^[A-Z]{3}$/.test(code)) return;
        found.add(code);
        metaCache.set(code, {
          city: String(airport?.city || '').trim(),
          countryCode: normalizeCountry(airport?.countryCode),
          name: String(airport?.name || '').trim()
        });
      });

      codes.forEach(code => { if (!found.has(code)) missingMeta.add(code); });
      if (found.size) scheduleRefresh();
    } catch {
      codes.forEach(code => missingMeta.add(code));
    } finally {
      metaPending = false;
    }
  }

  function scheduleRefresh() {
    if (refreshQueued) return;
    refreshQueued = true;
    requestAnimationFrame(() => {
      refreshQueued = false;
      enhanceAll();
    });
  }

  const content = document.querySelector('#resultContent');
  if (content) {
    // Osserviamo solo i figli diretti del contenitore risultati. Le modifiche
    // ai badge dentro le card non riattivano quindi l'observer e non possono
    // creare il loop che aveva congelato Fly2 nelle versioni successive a #102.
    new MutationObserver(scheduleRefresh).observe(content, { childList: true });
  }

  document.querySelector('#resultSort')?.addEventListener('change', () => window.setTimeout(scheduleRefresh, 0));
  scheduleRefresh();
})();
