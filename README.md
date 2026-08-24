# Fly2

Fly2 è una web app personale mobile-first per impostare ricerche di voli in modo semplice.

## Principi del progetto

- costo di hosting: **0 €**
- nessuna carta richiesta per il funzionamento del sito
- pubblicazione prevista con **GitHub Pages**
- nessun prezzo, volo, disponibilità o link di prenotazione inventato
- interfaccia separata dalla futura sorgente dei dati voli

## Stato attuale

Questa prima versione è una web app statica pura (`index.html`, `styles.css`, `app.js`). Funziona direttamente nel browser e non richiede Node.js, npm o un server.

Sono già presenti:

- andata e ritorno / sola andata
- date precise
- periodo più economico
- weekend
- città / aeroporto / Paese / Ovunque nell'interfaccia
- passeggeri
- numero massimo di scali
- durata massima dello scalo
- compagnie e Paesi di scalo da evitare
- UX mobile-first
- validazione della ricerca
- stato esplicito quando non esiste ancora una sorgente voli live

Il piccolo elenco di località incluso serve solo all'autocomplete iniziale. Non contiene prezzi o disponibilità.

## Pubblicazione gratis con GitHub Pages

Con GitHub Free, GitHub Pages richiede che questo repository sia **pubblico**.

Dopo aver reso pubblico il repository:

1. apri `Settings`
2. apri `Pages`
3. in `Build and deployment`, scegli `Deploy from a branch`
4. seleziona `main` e `/ (root)`
5. salva

Il sito sarà poi disponibile all'indirizzo del progetto GitHub Pages.

## Prossimo passo

Collegare una sorgente gratuita realmente utilizzabile per ottenere dati di volo, senza introdurre servizi a pagamento o carte. Se una sorgente non è disponibile, Fly2 deve continuare a mostrare un messaggio chiaro invece di inventare dati.
