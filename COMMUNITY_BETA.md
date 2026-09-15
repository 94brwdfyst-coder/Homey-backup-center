# Homey Backupcentrum 0.3.27 — ontwikkel-/testversie: testers gezocht

Homey Backupcentrum is voortgekomen uit het flow-back-upwerk van **Mike_Nono** op de Homey Community en is inmiddels uitgebreid naar een lokale configuratieback-up met gecontroleerde, selectieve restore. Dank ook aan **Mike1233** en **SingKT** voor hun eerdere bevindingen en praktijktests in die discussie.

## Wat werkt al?

Back-up en vergelijking van apps, zones, Logic, apparaten/apparaatinstellingen, Standard Flows en Advanced Flows. Voor restore krijg je eerst een herstelplan en kies je zelf wat er wordt teruggezet. In onze praktijktests zijn Logic, apparaatnaam, apparaat-zone, een echte Shelly-instelling (`beacon_timeout`), Standard Flows en Advanced Flows succesvol hersteld en daarna opnieuw gecontroleerd. Een verse v4-back-up van een ongewijzigde Homey vergelijkt bij ons met **0 verschillen**.

## Wat nog niet doen?

Beschouw dit niet als vervanging voor Homey's volledige systeemrestore. Radio-pairings en app-specifieke/private interne data kunnen niet betrouwbaar worden gereconstrueerd. Test bij voorkeur één kleine, herkenbare wijziging tegelijk en herstel alleen wat je bewust aanvinkt. Deel bij problemen **geen PAT, wachtwoorden, lokale keys of complete back-upbestanden** openbaar.

## Waar zoeken we hulp bij?

Vooral bij andere Homey-modellen, apps, apparaten en apparaatinstellingen. Meld graag ook onterechte verschillen in het herstelplan. Dat helpt om de filters veiliger en breder compatibel te maken.

## Bronnen en credits

Basis/voorwerk: Mike_Nono's *Backup Script - All flows and split them*, met communitybevindingen van onder anderen Mike1233 en SingKT. Voor de verdere app zijn de officiële Homey Apps SDK- en Homey Web API-documentatie gebruikt. Ontwikkeling en praktijktests: Dennis Weel, met ondersteuning van OpenAI ChatGPT/Codex.

**Status: 0.3.27 is lokaal getest; nieuwe praktijktests op Homey en Android zijn nog nodig. Niet als enige back-up gebruiken.**


Nieuw in 0.3.27: Nederlands/English, Homey API Key-uitleg, overdracht in delen voor grote back-ups, verbeterde downloadfeedback en correcties aan automatische back-ups. Zie TESTING.md voor wat daadwerkelijk in deze versie is gecontroleerd.
