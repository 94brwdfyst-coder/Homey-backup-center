# Teststatus 0.3.27 / Test status

## Uitgevoerd / Completed

Datum: 15 september 2026. Node 26.8.1, Homey CLI 4.4.1, geïnstalleerde Google Chrome via Playwright in een mobiele viewport (390 × 844). Homey en WebDAV zijn gesimuleerd; geen echte restore, upload of push uitgevoerd.

- 22 regressietests (`npm test`): alle geslaagd.
- Volledige export → kleine overdrachtsdelen → herstelplan → geselecteerde Logic-write → nacontrole, in zowel Nederlands als Engels, met de echte appmethoden tegen een gesimuleerde Homey.
- Niet-geselecteerde Logic blijft gelijk; `ha_backup_token` wordt niet geëxporteerd en niet teruggeschreven vanuit een oude back-up.
- Protocolvelden en actiecodes blijven gelijk bij taalkeuze; taalvoorkeur wordt bewaard.
- Drie pogingen per geplande dag, minstens 15 minuten tussen herpogingen, herstel na herstart, herpogingen na middernacht, DST-tijdzone, uitgeschakelde/niet-geselecteerde dagen, stop na succes.
- Aparte handmatige status en uitsluiting van gelijktijdige uploads.
- Meldingen alleen na de derde back-upfout; zichtbare meldingsfout, begrensde herpogingen en deduplicatie over herstarts.
- Pushaanroep gebruikt eigenaar/gekozen gebruiker en de methodevorm van de daadwerkelijke dependency homey-api 3.19.2. Kritieke kaart met fallback naar gewone push gecontroleerd via mocks.
- Configuratievalidatie en bescherming tegen verwijderen van een actief WebDAV-doel.
- Overdracht van grote Unicode-inhoud, exacte reconstructie, onvolledige/verkeerde volgorde/corrupte/te grote delen, verlopen sessies en beschermde lopende bewerkingen.
- Polling herhaalt geen restore-writes; afgeronde jobs worden opgeruimd.
- Browser end-to-end: circa 4,8 MB back-up door een gesimuleerde 64 KiB-request- én responslimiet. Grootste gemeten API-request: 21.971 bytes; antwoord: 21.874 bytes.
- Werkelijke Chromium-bestandsdownload opgehaald en JSON-inhoud vergeleken.
- Browserdeelkaart, annulering en foutafhandeling getest met een gesimuleerde OS-deelservice.
- Mislukt herstelplan schakelt restore uit; taalwijziging wordt bewaard en herlaadt beide schermtalen; geen JavaScript-paginafouten.
- Mobiele screenshots visueel gecontroleerd.
- Syntax: alle 15 eigen JS/CJS-bestanden, alle 3 JSON-bestanden en de macOS-wrapper geldig.
- `homey app validate --level publish`: geslaagd. De gebruikelijke waarschuwing voor `homey:manager:api` blijft; die permissie was al aanwezig. Een aparte CLI-updatecheck kon de lokale configuratiemap niet gebruiken; dit veranderde de geslaagde appvalidatie niet.

De pure regressietests staan in `test/` en zijn via `npm test` uitvoerbaar. De testbestanden worden door `.homeyignore` niet naar Homey meegenomen. De browsercontrole draaide buiten het installatiepakket met een gesimuleerde API, zodat geen echte gegevens of ontvangers werden gebruikt.

## Nog op echte apparaten controleren / Remaining device checks

1. Installeer als normale update zonder `--clean`. Controleer versie 0.3.27 en behoud van API Key, WebDAV-doelen en schema (bijvoorbeeld Koofr, 03:00, alle weekdagen).
2. Kies English en Nederlands, sluit en heropen instellingen. Controleer ook de uitleg bij Homey API Key.
3. Maak een nieuwe back-up en vergelijk die direct met dezelfde Homey. Geen onbedoelde wijzigingen verwacht; veranderlijke Logic-waarden kunnen verschillen.
4. Open een grotere back-up, bijvoorbeeld de circa 4,5 MB van Peter. Test plan, één bewuste selectie, restore en nacontrole via de echte Homey-verbinding.
5. Test downloaden en delen op Android Chrome/Vivaldi/Firefox, de Homey-app/webview en eventueel iOS. Controleer het opgeslagen bestand echt. De desktop-Chromiumtest bewijst geen Android- of iOS-compatibiliteit.
6. Test een echte WebDAV-upload en geplande upload. Controleer bestandsinhoud en eventuele exportwaarschuwingen.
7. Test drie fouten met een tijdelijk testdoel/schema; controleer herpogingen, één push na de derde fout en Tijdlijnmelding. Zet daarna het oorspronkelijke schema terug. De echte pushkaart, API-rechten en telefoonbezorging zijn nog niet op Homey getest.
8. Test herstart tijdens een mislukte poging en controleer dat de volgende herpoging correct doorgaat. Een herstart tijdens een upload kan niet bewijzen of de server het bestand al ontving; de planner behandelt zo'n poging als onderbroken.

## English summary

All 22 local regression tests pass, plus a real Chromium end-to-end UI test with a simulated Homey and a 4.8 MB backup. Publish-level Homey validation passes. The browser successfully downloads and verifies a JSON file; OS file sharing is mocked. No actual Homey installation, restore, NAS upload or push delivery was performed. The checks above must still be completed on the user's Homey and target phones before treating 0.3.27 as field-tested.

## 0.3.28 network regression checks

Run `npm ci`, `npm run lint`, `npm test`, `npm run build` on Node 22+. Tests include a temporary real SFTP server, host-key mismatch, incorrect password, write denial, timeout termination, SMB adapter order/cleanup, settings form submission/polling, concurrent-run exclusion, secret redaction and Flow destination filtering. Existing restore/scheduler/transfer tests remain included. Local listening sockets must be permitted for SFTP tests.

Manual acceptance: test on a real SMB NAS and SFTP server; verify the final JSON can be opened by Backup Center; exercise success/failure Flow cards and a scheduled date/time Flow on Homey; retest the reported Android and Windows Chrome/Firefox download behavior. SMB signing/encryption compatibility and browser behavior on those devices are not established by mocks or DOM tests.
