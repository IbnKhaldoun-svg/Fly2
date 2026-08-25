(() => {
  const AIRPORT_META_API = 'https://fly2-api.fly2-search.workers.dev/airports';
  const metaCache = new Map();
  const missingMeta = new Set();
  let metaPending = false;
  let refreshQueued = false;

  const displayNames = (() => {
    try { return new Intl.DisplayNames(['it-IT'], { type: 'region' }); }
    catch { return null; }
  })();

  const COUNTRY_ALIASES = new Map(Object.entries({
    'italia':'IT','italy':'IT',
    'spagna':'ES','spain':'ES','espana':'ES','españa':'ES',
    'marocco':'MA','morocco':'MA','maroc':'MA',
    'portogallo':'PT','portugal':'PT',
    'francia':'FR','france':'FR',
    'germania':'DE','germany':'DE','deutschland':'DE',
    'regno unito':'GB','united kingdom':'GB','great britain':'GB','uk':'GB',
    'irlanda':'IE','ireland':'IE',
    'belgio':'BE','belgium':'BE',
    'paesi bassi':'NL','netherlands':'NL','olanda':'NL',
    'svizzera':'CH','switzerland':'CH',
    'austria':'AT',
    'polonia':'PL','poland':'PL',
    'repubblica ceca':'CZ','czechia':'CZ','czech republic':'CZ',
    'ungheria':'HU','hungary':'HU',
    'croazia':'HR','croatia':'HR',
    'grecia':'GR','greece':'GR',
    'romania':'RO',
    'bulgaria':'BG',
    'albania':'AL',
    'serbia':'RS',
    'turchia':'TR','turkey':'TR','turkiye':'TR','türkiye':'TR',
    'tunisia':'TN',
    'egitto':'EG','egypt':'EG',
    'malta':'MT',
    'cipro':'CY','cyprus':'CY',
    'danimarca':'DK','denmark':'DK',
    'svezia':'SE','sweden':'SE',
    'norvegia':'NO','norway':'NO',
    'finlandia':'FI','finland':'FI',
    'islanda':'IS','iceland':'IS'
  }));

  const style = document.createElement('style');
  style.textContent = `
    .flight-compact-times.fly2-has-stopovers{grid-template-columns:minmax(92px,1fr) minmax(0,auto) minmax(92px,1fr);gap:12px}
    .fly2-stopover-inline{display:flex;align-items:center;justify-content:center;gap:8px;max-width:min(64vw,700px);overflow-x:auto;overscroll-behavior-inline:contain;scrollbar-width:none;padding:2px 0}
    .fly2-stopover-inline::-webkit-scrollbar{display:none}
    .fly2-stopover-pill{display:inline-grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:9px;min-height:44px;padding:6px 7px 6px 8px;border:1px solid rgba(194,132,31,.42);border-radius:16px;background:linear-gradient(135deg,#fffdf7,#fff3d8);box-shadow:0 6px 18px rgba(91,67,22,.09);color:#3f2d0e;white-space:nowrap}
    .fly2-stopover-flag{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:#fff;border:1px solid rgba(194,132,31,.17);font-size:13px;box-shadow:0 2px 8px rgba(91,67,22,.08)}
    .fly2-stopover-copy{display:flex;flex-direction:column;align-items:flex-start;min-width:0;line-height:1.08}
    .fly2-stopover-copy strong{max-width:220px;overflow:hidden;text-overflow:ellipsis;font-size:11.5px;font-weight:900;color:#2f210b}
    .fly2-stopover-country{margin-top:3px;font-size:9.5px;font-weight:800;color:#7b5c27}
    .fly2-stopover-duration{display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:58px;min-height:34px;padding:4px 9px;border-radius:12px;background:#fff;border:1px solid rgba(13,102,95,.15);box-shadow:0 2px 8px rgba(13,102,95,.06)}
    .fly2-stopover-duration span{font-size:7.5px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;color:#6b7d78}
    .fly2-stopover-duration strong{margin-top:1px;font-size:12.5px;line-height:1;font-weight:950;color:#0d665f}
    .flight-compact-layovers.fly2-hide-legacy-layover{display:none!important}
    @media(max-width:700px){
      .flight-compact-times.fly2-has-stopovers{grid-template-columns:minmax(66px,1fr) minmax(0,auto) minmax(66px,1fr);gap:6px}
      .fly2-stopover-inline{max-width:59vw;gap:6px}
      .fly2-stopover-pill{min-height:40px;padding:5px 6px;gap:6px;border-radius:14px}
      .fly2-stopover-flag{width:24px;height:24px;font-size:11px}
      .fly2-stopover-copy strong{max-width:145px;font-size:10px}
      .fly2-stopover-country{font-size:8.5px}
      .fly2-stopover-duration{min-width:52px;min-height:31px;padding:3px 7px}
      .fly2-stopover-duration span{font-size:6.8px}.fly2-stopover-duration strong{font-size:11px}
    }
    @media(max-width:430px){
      .flight-compact-times.fly2-has-stopovers{grid-template-columns:minmax(58px,1fr) minmax(0,auto) minmax(58px,1fr)}
      .fly2-stopover-inline{max-width:57vw}
      .fly2-stopover-copy strong{max-width:112px}
    }
  `;
  document.head.appendChild(style);

  function esc(value) {
    return String(value ?? '').replace(/[&<>'\"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '\"':'&quot;' }[char]));
  }

  function norm(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  function normalizeCountryCode(value) {
    const raw = String(value || '').trim();
    const upper = raw.toUpperCase().replace(/^UK$/, 'GB');
    if (/^[A-Z]{2}$/.test(upper)) return upper;
    return COUNTRY_ALIASES.get(norm(raw)) || '';
  }

  function countryInfo(value, fallbackValue = '') {
    const raw = String(value || fallbackValue || '').trim();
    const code = normalizeCountryCode(raw);
    if (code) {
      let label = code;
      try { label = displayNames?.of(code) || code; } catch {}
      return { code, label };
    }
    return { code: '', label: raw };
  }

  function flag(code) {
    const normalized = normalizeCountryCode(code);
    if (!normalized) return '✦';
    return [...normalized].map(char => String.fromCodePoint(127397 + char.charCodeAt(0))).join('');
  }

  function cleanCity(value, code) {
    const city = String(value || '').trim();
    if (!city) return '';
    const upper = city.toUpperCase();
    if (upper === String(code || '').toUpperCase() || /^[A-Z]{3}$/.test(upper)) return '';
    const normalized = norm(city);
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
    if (!Number.isFinite(minutes)) return 'n/d';
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
      const sourceCountry = segment?.toCountry || next?.fromCountry || '';
      const metaCountry = meta.countryCode || meta.country || '';
      const country = countryInfo(sourceCountry, metaCountry);
      const minutes = minutesBetween(segment?.arrivalTime, next?.departureTime);

      return {
        code,
        city,
        countryCode: country.code,
        country: country.label,
        flag: flag(country.code),
        minutes,
        duration: duration(minutes)
      };
    }).filter(Boolean);
  }

  function signature(stops) {
    return stops.map(stop => [stop.code, stop.city, stop.countryCode, stop.country, stop.duration].join('~')).join('|');
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
      const countryText = stop.country || 'Paese in verifica';
      const title = `Scalo a ${stop.city}, ${countryText} · ${stop.duration}`;
      return `<span class="fly2-stopover-pill" title="${esc(title)}" aria-label="${esc(title)}">
        <span class="fly2-stopover-flag" aria-hidden="true">${esc(stop.flag)}</span>
        <span class="fly2-stopover-copy">
          <strong>Scalo a ${esc(stop.city)}</strong>
          <span class="fly2-stopover-country">${esc(countryText)}</span>
        </span>
        <span class="fly2-stopover-duration">
          <span>Durata</span>
          <strong>${esc(stop.duration)}</strong>
        </span>
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
          const sourceCountry = segment?.toCountry || next?.fromCountry || '';
          const hasCountry = Boolean(countryInfo(sourceCountry).label);
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
          countryCode: normalizeCountryCode(airport?.countryCode || airport?.country || ''),
          country: String(airport?.country || '').trim(),
          name: String(airport?.name || '').trim()
        });
      });

      codes.forEach(code => { if (!found.has(code)) missingMeta.add(code); });
      if (found.size) scheduleRefresh();
    } catch {
      // Se il lookup metadati fallisce, manteniamo comunque i dati ricevuti
      // dal provider e non tocchiamo la ricerca voli.
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
    // Solo figli diretti: i badge che aggiorniamo dentro le card non possono
    // riattivare l'observer e creare cicli di rendering.
    new MutationObserver(scheduleRefresh).observe(content, { childList: true });
  }

  document.querySelector('#resultSort')?.addEventListener('change', () => window.setTimeout(scheduleRefresh, 0));
  scheduleRefresh();
})();
