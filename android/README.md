# Fly2 Android

Versione Android dedicata di Fly2, pensata per installazione diretta su Samsung Galaxy S25.

## Obiettivi

- mantenere intatto il motore di ricerca web stabile;
- offrire una shell Android pulita, edge-to-edge e ottimizzata per smartphone;
- aprire i siti di prenotazione esterni nel browser;
- aggiornarsi automaticamente usando la versione web pubblicata di Fly2;
- avere un APK installabile senza modificare il ramo `main` della web app.

## Build

Il workflow GitHub Actions `Build Fly2 Android APK` produce `Fly2-S25-debug.apk` come artifact.

Per una distribuzione personale continuativa conviene poi aggiungere una chiave di firma release stabile, così gli aggiornamenti APK possono essere installati sopra la versione precedente senza disinstallarla.
