# Fly2 API Worker

Questo Worker è il ponte gratuito tra Fly2 (GitHub Pages) e una sorgente esterna di voli reali.

## Stato

La prima integrazione di prova usa il server MCP ufficiale di Kiwi.com (`https://mcp.kiwi.com`). È una sperimentazione: prima verifichiamo che il server accetti correttamente richieste da un Worker Cloudflare, poi colleghiamo la UI di Fly2.

Kiwi e Ryanair funzionano senza segreti nel repository. L'integrazione Duffel è opzionale e legge `DUFFEL_ACCESS_TOKEN` esclusivamente dai Secrets del Worker: il token non deve mai essere salvato nel codice o in GitHub.

## Endpoint

- `GET /health` — verifica che il Worker sia online.
- `GET /tools` — inizializza una sessione MCP e restituisce gli strumenti esposti dal server Kiwi.
- `POST /search` — ricerca tramite Kiwi.
- `POST /ryanair-compare` — confronto tramite Ryanair.
- `POST /duffel-search` — ricerca opzionale tramite Duffel, attiva solo se è configurato `DUFFEL_ACCESS_TOKEN`.

Esempio body per `/search`:

```json
{
  "origin": "BLQ",
  "destination": "BCN",
  "departureDate": "2026-09-10",
  "returnDate": "2026-09-13",
  "passengers": {
    "adults": 1,
    "children": 0,
    "infants": 0
  }
}
```

## Deploy da Cloudflare Dashboard

1. Vai in **Workers & Pages**.
2. Seleziona **Create application**.
3. Scegli **Import a repository**.
4. Collega GitHub se richiesto e seleziona `IbnKhaldoun-svg/Fly2`.
5. Imposta **Root directory** su `worker`.
6. Il nome del Worker deve essere `fly2-api` (coerente con `wrangler.jsonc`).
7. Lascia il deploy command predefinito `npx wrangler deploy`.
8. Premi **Save and Deploy**.

Al termine Cloudflare mostrerà un indirizzo simile a:

`https://fly2-api.<tuo-subdomain>.workers.dev`

Apri prima:

`https://fly2-api.<tuo-subdomain>.workers.dev/health`

Se restituisce `"ok": true`, manda l'URL del Worker in chat. Il passaggio successivo sarà controllare `/tools` e poi eseguire la prima ricerca reale.

## Sicurezza

`POST /search` accetta richieste dal dominio GitHub Pages di Fly2 e da localhost. Il Worker non memorizza dati personali e non contiene segreti.


## Duffel opzionale

Fly2 contiene un adattatore Duffel disattivato per impostazione predefinita. Serve per aggiungere una fonte autorizzata di offerte live senza fare scraping dei siti delle compagnie.

Per attivarlo:

1. Crea e verifica un account Duffel.
2. Genera un **live access token** nel Dashboard Duffel. I token di test non restituiscono prezzi reali.
3. In Cloudflare apri il Worker `fly2-api` → **Settings** → **Variables and Secrets**.
4. Aggiungi un secret chiamato `DUFFEL_ACCESS_TOKEN`.
5. Esegui un nuovo deploy del Worker.
6. Controlla `GET /health`: il provider `duffel` deve risultare con `configured: true`.

Non inserire mai il token in `wrangler.jsonc`, nei file JavaScript o in un commit.

Per evitare di moltiplicare richieste e costi, Fly2 usa Duffel automaticamente solo su ricerche con **date precise**. Nelle ricerche Paese la verifica Duffel parte solo dopo che l'utente apre una città, non durante la scansione iniziale di tutti gli aeroporti.
