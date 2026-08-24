# Fly2 API Worker

Questo Worker è il ponte gratuito tra Fly2 (GitHub Pages) e una sorgente esterna di voli reali.

## Stato

La prima integrazione di prova usa il server MCP ufficiale di Kiwi.com (`https://mcp.kiwi.com`). È una sperimentazione: prima verifichiamo che il server accetti correttamente richieste da un Worker Cloudflare, poi colleghiamo la UI di Fly2.

Il Worker non contiene API key, carte o servizi a pagamento.

## Endpoint

- `GET /health` — verifica che il Worker sia online.
- `GET /tools` — inizializza una sessione MCP e restituisce gli strumenti esposti dal server Kiwi.
- `POST /search` — prova una ricerca volo precisa.

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
