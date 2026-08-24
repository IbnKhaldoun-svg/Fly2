# Fonti prezzi voli valutate per Fly2

Aggiornato: 24 agosto 2026.

## Kiwi.com

- Già integrato tramite il server MCP ufficiale.
- Usato come sorgente aggregata principale.

## Ryanair

- Già integrato tramite il fare finder Ryanair della vecchia app.
- Fly2 confronta e unisce questi risultati con Kiwi quando disponibili.

## easyJet

Stato: **accessibile in modo conforme tramite canale autorizzato, non tramite scraping**.

La Distribution Charter di easyJet vieta scraping e automazioni del sito e consente l'accesso ai dati soltanto tramite un canale approvato o un accordo API diretto. easyJet elenca **Duffel** tra i canali autorizzati.

Scelta Fly2: usare Duffel come fonte opzionale per easyJet e per eventuali altre compagnie abilitate nell'account Duffel.

## Wizz Air

Stato: **API ufficiale esistente, accesso da richiedere**.

Il portale sviluppatori Wizz Air espone un prodotto **Air Shopping** esplicitamente destinato a metasearch, comparatori, flight tracking, aggregatori e fare monitoring. Il portale richiede account, scelta di un piano e approvazione dell'applicazione.

Scelta Fly2: non fare scraping del sito. Preparare una futura integrazione diretta solo dopo aver ottenuto credenziali e documentazione del piano Air Shopping.

## Volotea

Stato: **nessuna API pubblica adatta a un progetto personale individuata**.

Volotea distribuisce contenuti tramite canali professionali/GDS e una piattaforma B2B per agenzie. Le condizioni della piattaforma vietano scraping e automazione esterna.

Scelta Fly2: niente scraping. Valutare contenuto Volotea tramite un aggregatore autorizzato se disponibile.

## Air Arabia

Stato: **nessuna API pubblica per metasearch/prezzi individuata**.

La documentazione pubblica fa riferimento ad agenti autorizzati e sistemi OTA, ma non espone un portale sviluppatori pubblico equivalente a Wizz Air.

Scelta Fly2: niente scraping. Verificare la presenza di Air Arabia tramite aggregatori autorizzati.

## Duffel

Stato: **integrazione preparata in Fly2, disattivata finché non viene configurato un token live**.

- API ufficiale per ricerca e booking di offerte.
- Più di 300 compagnie disponibili complessivamente.
- easyJet è esplicitamente disponibile e easyJet stessa include Duffel tra i propri canali autorizzati.
- I prezzi in test mode non sono reali; per prezzi live serve un account verificato e un live access token.
- L'attivazione live richiede verifica e KYC: tipo di business, dati personali, informazioni sull'attività e verifica delle informazioni fornite.
- I termini Duffel autorizzano l'uso della piattaforma live per le proprie **business operations**. Non è stata trovata documentazione ufficiale che confermi l'accettazione di un progetto puramente personale/hobby senza attività economica.
- Per un progetto personale, prima di completare l'onboarding conviene chiedere conferma direttamente a Duffel indicando che Fly2 è un comparatore personale/non commerciale e che l'uso previsto iniziale è solo ricerca prezzi, senza vendita di biglietti.
- Pricing pay-as-you-go: nessun costo iniziale, ma esistono fee sugli ordini e una fee per eccesso di ricerche oltre il rapporto search-to-book previsto.

Per limitare il rischio di costi, Fly2 interroga Duffel automaticamente solo per **date precise**. Nelle ricerche Paese, Duffel viene interrogato solo dopo che l'utente sceglie una città.
