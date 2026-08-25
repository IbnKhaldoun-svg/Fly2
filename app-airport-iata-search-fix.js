(() => {
  if (window.__fly2AirportIataSearchFixInstalled) return;
  window.__fly2AirportIataSearchFixInstalled = true;

  const SEARCH_ENDPOINTS = [
    'https://fly2-api.fly2-search.workers.dev/search',
    'https://fly2-api.fly2-search.workers.dev/country-pair-search'
  ];

  const originalFetch = window.fetch.bind(window);
  const validIata = value => /^[A-Z]{3}$/.test(String(value || '').trim().toUpperCase());

  window.fetch = function(resource, init) {
    try {
      const url = typeof resource === 'string' ? resource : resource?.url;
      const method = String(init?.method || 'GET').toUpperCase();
      const isFly2Search = method === 'POST' && SEARCH_ENDPOINTS.some(endpoint => String(url || '').startsWith(endpoint));

      if (isFly2Search && typeof init?.body === 'string') {
        const payload = JSON.parse(init.body);
        let changed = false;

        const originIata = String(payload?.originIata || '').trim().toUpperCase();
        if (validIata(originIata) && payload?.originType !== 'country' && payload?.origin !== originIata) {
          payload.origin = originIata;
          payload.originType = 'airport';
          changed = true;
        }

        const destinationIata = String(payload?.destinationIata || '').trim().toUpperCase();
        if (
          payload?.destination !== 'anywhere' &&
          payload?.destinationType !== 'country' &&
          validIata(destinationIata) &&
          payload?.destination !== destinationIata
        ) {
          payload.destination = destinationIata;
          payload.destinationType = 'airport';
          changed = true;
        }

        if (changed) {
          return originalFetch(resource, { ...init, body: JSON.stringify(payload) });
        }
      }
    } catch (error) {
      console.warn('Fly2: impossibile normalizzare i codici IATA della ricerca.', error);
    }

    return originalFetch(resource, init);
  };
})();
