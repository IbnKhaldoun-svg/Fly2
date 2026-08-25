const ORIGIN_HEADER = 'https://ibnkhaldoun-svg.github.io';
const WORKER = 'https://fly2-api.fly2-search.workers.dev';
const RYANAIR = 'https://ryanair-flight-finder-v2.vercel.app/api/fly2-anywhere';

const base = {
  origin: 'BLQ', originType: 'airport', originIata: 'BLQ',
  destination: 'AGA', destinationType: 'airport', destinationIata: 'AGA',
  destinationCountryCode: '', adults: 1, children: 0, infants: 0,
  maxStopovers: 1, maxLayoverHours: 24, sort: 'price'
};

const kiwiCases = [
  ['airport one-way exact', { ...base, departureDate: '2026-09-25' }],
  ['airport roundtrip exact', { ...base, departureDate: '2026-09-25', returnDate: '2026-10-02' }],
  ['airport roundtrip ±3', { ...base, departureDate: '2026-09-25', departureDateFlexDays: 3, returnDate: '2026-10-02', returnDateFlexDays: 3 }],
  ['airport roundtrip range', { ...base, departureDate: '2026-09-22', departureDateTo: '2026-09-28', returnDate: '2026-10-01', returnDateTo: '2026-10-05' }],
  ['airport cheapest 3 nights', { ...base, searchMode: 'cheapest', searchHorizonMonths: 3, stayNights: 3, departureDate: '2026-08-26', departureDateTo: '2026-11-26', nightsFrom: 3, nightsTo: 3 }],
  ['airport weekend', { ...base, departureDate: '2026-08-26', departureDateTo: '2026-11-26', flyDays: [5], returnFlyDays: [0], nightsFrom: 2, nightsTo: 2, departureHourFrom: 17, returnHourFrom: 20 }],
  ['anywhere one-way exact', { ...base, destination: 'anywhere', destinationType: '', destinationIata: '', departureDate: '2026-09-25', oneForCity: true }],
  ['anywhere roundtrip ±3', { ...base, destination: 'anywhere', destinationType: '', destinationIata: '', departureDate: '2026-09-25', departureDateFlexDays: 3, returnDate: '2026-10-02', returnDateFlexDays: 3, oneForCity: true }],
  ['anywhere weekend', { ...base, destination: 'anywhere', destinationType: '', destinationIata: '', departureDate: '2026-08-26', departureDateTo: '2026-11-26', flyDays: [5], returnFlyDays: [0], nightsFrom: 2, nightsTo: 2, departureHourFrom: 17, returnHourFrom: 20, oneForCity: true }],
];

function rBase(destination = 'AGA') {
  return {
    origin: 'BLQ', destination, connectionPreference: 'one-stop', maxLayoverMinutes: 1440,
    excludedLayoverCountryCodes: [], excludedLayoverAirportCodes: [], adults: 1, teens: 0,
    children: 0, infants: 0, currency: 'EUR'
  };
}
const ryanairCases = [
  ['airport one-way exact', { ...rBase(), tripType: 'one-way', searchMode: 'selected-dates', outbound: { mode: 'fixed', startDate: '2026-09-25', flexibilityDays: 0 } }],
  ['airport roundtrip exact', { ...rBase(), tripType: 'round-trip', searchMode: 'selected-dates', outbound: { mode: 'fixed', startDate: '2026-09-25', flexibilityDays: 0 }, inbound: { mode: 'fixed', startDate: '2026-10-02', flexibilityDays: 0 } }],
  ['airport roundtrip ±3', { ...rBase(), tripType: 'round-trip', searchMode: 'selected-dates', outbound: { mode: 'flexible', startDate: '2026-09-25', flexibilityDays: 3 }, inbound: { mode: 'flexible', startDate: '2026-10-02', flexibilityDays: 3 } }],
  ['airport roundtrip range', { ...rBase(), tripType: 'round-trip', searchMode: 'selected-dates', outbound: { mode: 'range', startDate: '2026-09-22', endDate: '2026-09-28', flexibilityDays: 0 }, inbound: { mode: 'range', startDate: '2026-10-01', endDate: '2026-10-05', flexibilityDays: 0 } }],
  ['airport cheapest 3 nights', { ...rBase(), tripType: 'round-trip', searchMode: 'cheapest-stay', searchHorizonMonths: 3, stayNights: 3, outbound: { mode: 'any', startDate: '2026-08-26', flexibilityDays: 0 }, inbound: { mode: 'any', startDate: '2026-08-27', flexibilityDays: 0 } }],
  ['airport weekend', { ...rBase(), tripType: 'round-trip', searchMode: 'weekend', searchHorizonMonths: 3, weekendOutboundDay: 'friday', weekendInboundDay: 'sunday', weekendOutboundMinTime: '17:00', weekendInboundMinTime: '20:00', outbound: { mode: 'any', startDate: '2026-08-26', flexibilityDays: 0 }, inbound: { mode: 'any', startDate: '2026-08-27', flexibilityDays: 0 } }],
  ['anywhere one-way exact', { ...rBase('ANY'), tripType: 'one-way', searchMode: 'selected-dates', outbound: { mode: 'fixed', startDate: '2026-09-25', flexibilityDays: 0 } }],
  ['anywhere weekend', { ...rBase('ANY'), tripType: 'round-trip', searchMode: 'weekend', searchHorizonMonths: 3, weekendOutboundDay: 'friday', weekendInboundDay: 'sunday', weekendOutboundMinTime: '17:00', weekendInboundMinTime: '20:00', outbound: { mode: 'any', startDate: '2026-08-26', flexibilityDays: 0 }, inbound: { mode: 'any', startDate: '2026-08-27', flexibilityDays: 0 } }],
];

async function post(url, body, timeoutMs = 65000) {
  const response = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Origin': ORIGIN_HEADER },
    body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs)
  });
  const text = await response.text();
  let data = null;
  try { data = JSON.parse(text); } catch {}
  return { response, data, text };
}

const rows = [];
async function checkKiwi(name, body) {
  const started = Date.now();
  try {
    const { response, data, text } = await post(`${WORKER}/search`, body, 45000);
    const items = data?.result?.itineraries;
    const ok = response.ok && data?.ok === true && Array.isArray(items);
    rows.push({ source: 'Kiwi', name, ok, status: response.status, count: Array.isArray(items) ? items.length : '-', ms: Date.now()-started, note: ok ? '' : String(data?.error || text).slice(0,160) });
  } catch (e) { rows.push({ source:'Kiwi', name, ok:false, status:'ERR', count:'-', ms:Date.now()-started, note:e.name+': '+e.message }); }
}
async function checkRyanair(name, body) {
  const started = Date.now();
  try {
    const { response, data, text } = await post(RYANAIR, body, 65000);
    const items = data?.itineraries;
    const knownNoFlights = data?.error?.code === 'NO_FLIGHTS';
    const ok = (response.ok && Array.isArray(items)) || knownNoFlights;
    rows.push({ source: 'Ryanair', name, ok, status: response.status, count: Array.isArray(items) ? items.length : 0, ms: Date.now()-started, note: ok ? (knownNoFlights ? 'NO_FLIGHTS' : '') : String(data?.error?.message || data?.error || text).slice(0,160) });
  } catch (e) { rows.push({ source:'Ryanair', name, ok:false, status:'ERR', count:'-', ms:Date.now()-started, note:e.name+': '+e.message }); }
}

async function runLimited(cases, fn, limit=2) {
  let cursor=0;
  await Promise.all(Array.from({length:limit}, async()=>{
    while(cursor<cases.length){ const i=cursor++; const [name,body]=cases[i]; await fn(name,body); }
  }));
}

// Metadata / country endpoint
try {
  const r = await fetch(`${WORKER}/country-airports?country=MA&name=Marocco`, { headers: { Origin: ORIGIN_HEADER, Accept:'application/json' }, signal: AbortSignal.timeout(20000) });
  const d = await r.json();
  rows.push({source:'Metadata',name:'Marocco commercial airports',ok:r.ok&&d?.ok&&Array.isArray(d.airports),status:r.status,count:Array.isArray(d?.airports)?d.airports.length:'-',ms:'-',note:Array.isArray(d?.airports)?`Ryanair=${d.airports.filter(a=>a.ryanair).length}`:''});
} catch(e){rows.push({source:'Metadata',name:'Marocco commercial airports',ok:false,status:'ERR',count:'-',ms:'-',note:e.message});}

await runLimited(kiwiCases, checkKiwi, 2);
await runLimited(ryanairCases, checkRyanair, 2);

rows.sort((a,b)=>a.source.localeCompare(b.source)||a.name.localeCompare(b.name));
console.table(rows);
const failed = rows.filter(r=>!r.ok);
const summary = [
  '# Fly2 production search audit', '',
  `Date: ${new Date().toISOString()}`, '',
  '| Source | Search | OK | HTTP | Results | ms | Note |',
  '|---|---|---:|---:|---:|---:|---|',
  ...rows.map(r=>`| ${r.source} | ${r.name} | ${r.ok?'✅':'❌'} | ${r.status} | ${r.count} | ${r.ms} | ${String(r.note||'').replaceAll('|','/')} |`),
  '', `Failures: ${failed.length}/${rows.length}`
].join('\n');
if (process.env.GITHUB_STEP_SUMMARY) await (await import('node:fs/promises')).appendFile(process.env.GITHUB_STEP_SUMMARY, summary+'\n');
console.log(summary);
if (failed.length) process.exitCode = 1;
