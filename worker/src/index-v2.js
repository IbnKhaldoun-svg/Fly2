import core from './index.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/demo' && request.method === 'GET') {
      const departure = addDays(new Date(), 14);
      const returnDate = addDays(departure, 3);
      const proxy = new Request(new URL('/search', request.url), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: 'Bologna',
          destination: 'Barcelona',
          departureDate: toIsoDate(departure),
          returnDate: toIsoDate(returnDate),
          passengers: { adults: 1, children: 0, infants: 0 }
        })
      });
      return core.fetch(proxy, env, ctx);
    }

    return core.fetch(request, env, ctx);
  }
};

function addDays(date, days) {
  const out = new Date(date);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

function toIsoDate(date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0')
  ].join('-');
}
