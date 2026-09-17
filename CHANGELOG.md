## 0.4.3
- Add FTP as a network backup destination alongside SMB2 and SFTP.
- Add FTP connection/write testing and real backup uploads with temporary-file rename and cleanup.
- Show a clear warning that FTP is unencrypted and should only be used on a trusted network.
- Add FTP validation, worker and settings UI regression tests.
- SMB2 and SFTP backup behavior remains supported and was regression-tested.

## 0.4.2
- Finalize the Backup Center App Store presentation and certification updates.
- Clean up visible branding and use the Backup_Center prefix for newly created backup files.
- Keep the tested SMB2 and SFTP network backup functionality.

## 0.4.1
- Rename the app to Backup Center and update the English and Dutch store taglines.
- Replace the store readme with concise product information without release history.
- Replace the store images with a setup-to-backup-to-storage visual.
- Update visible settings and share-sheet branding; backup and restore behavior is unchanged.

## 0.4.0
- Promote the successfully field-tested SMB2/SFTP work to the 0.4 release line.
- SMB2 uses NTLMv2 authentication; real connection/write test and real JSON backup validated against Samba on Ubuntu.
- SFTP real connection/write test and JSON backup validated against OpenSSH on Ubuntu with SHA256 host-key verification.
- Restore saved non-secret SMB/SFTP fields when reopening settings; passwords remain hidden.
- Clarify SFTP host-key setup: use the existing server/NAS host-key fingerprint; SHA256 is recommended and SHA1 is also accepted.
- Document exactly what was and was not field-tested.

## 0.3.36 beta
- Settings reopen the last selected network destination (or the first saved destination), so non-secret SMB/SFTP fields are restored instead of showing an empty new-destination form.
- Password remains intentionally hidden and can be left empty to retain the saved secret.
- Keeps the SMB NTLMv2 authentication fix from 0.3.35.

## 0.3.34
- Add safe SMB authentication diagnostics (error name/code/status/message; never credentials).
- No SMB behavior change; diagnostic beta only.

## 0.3.33 beta
- Replace @awo00/smb2 1.1.1 with node-smb2 1.3.5 for the upstream NTLMv2 authentication fix.
- Keep SMB stage diagnostics enabled while validating the fix against Samba.
- No community release yet: this build is for SMB2 validation only.

## 0.3.32
- Kept the 0.3.30 settings UI/storage code unchanged.
- Added SMB stage diagnostics for connection tests and backups.
- Normalize SHA256/SHA1 fingerprint prefixes case-insensitively.

## 0.3.30
- Show network save/test progress and success/failure directly beside the controls.
- Use protocol-specific SMB and SFTP folder labels, examples and hints.
- Preserve safe worker diagnostic details during connection tests.

## 0.3.29
- Accept SHA256 and colon-separated SHA1 SFTP host-key fingerprints.
- Clarify Synology-style SMB share vs. subfolder configuration.
- Improve safe SMB connection diagnostics without exposing credentials.
- Keep network destination testing separate from the existing WebDAV scheduler.

## 0.3.28 (local build)

- Fix explicit browser download/share selection and iframe fallback capability handling.
- Add SMB2/SFTP destinations, mandatory SFTP host-key verification, safe error messages and bounded worker transfers.
- Add settings forms, connection tests and Homey Flow action/completion/failure/condition cards.
- Add runtime license notices, provenance evidence, reproducible lint/build and protocol/UI regression tests.
- Hardware/NAS/browser acceptance testing remains required; see docs/NETWORK-BACKUPS.md.

## 0.3.27 — Beta fixes / bèta-correcties
- Keuze Nederlands / English, opgeslagen in appinstellingen; uitleg en eigen meldingen vertaald.
- Homey API Key-benaming met instructies en bestaande restorePat-opslag behouden.
- Back-ups, herstelkeuze en resultaten in kleine overdrachtsdelen; langdurige bewerkingen worden gevolgd zonder restore opnieuw te starten.
- Download via bewaardialoog, deelkaart of blijvende bestandslink met duidelijke foutfeedback.
- Planner: correcte dagelijkse teller, herpogingen over herstart/middernacht, aparte handmatige status, één WebDAV-upload tegelijk, invoercontrole en actuele status.
- Push via de Homey API-client naar gekozen ontvanger/eigenaar; Tijdlijnmelding als aanvullend kanaal, begrensde meldingsherpogingen en zichtbare afleverfouten.
- ha_backup_token ook uitgesloten van restore uit oudere back-ups; exportfilter behouden.
- README, App Store README.txt en regressietests toegevoegd/bijgewerkt. Geen installatie of publicatie uitgevoerd bij het bouwen van deze versie.

## 0.3.26 — Scheduler
- Nieuwe sectie "Automatische back-up" in de instellingen: dagelijks op ingestelde tijd naareen gekozen WebDAV-locatie, met dagkeuze.
- De app probeert de back-up maximaal 3 keer per dag (elke 15 minuten). Geslaagde poging reset de teller; alleen als de dag standaard wordt afgesloten zonder succes verschijnt een kritieke pushmelding (na 3 mislukte pogingen).
- Hardcoded HA-token verplaatst naar de Logic-variabele `ha_backup_token`; die variabele wordt voortaan uit platte Backups (`Logic`) overgeslagen, net als de PAT en WebDAV-wachtwoorden.
- Bestaand v4-back-upgedrag en restore-engine inhoudelijk ongewijzigd.

## 0.3.25 — Beta 1
- Eerste pakket bedoeld voor gecontroleerde communitytests.
- Credits, gebruikte bronnen, eigen praktijktests en bekende grenzen expliciet gedocumenteerd.
- Restore-engine en v4-back-upgedrag van 0.3.24 inhoudelijk ongewijzigd.
- Testers worden gevraagd alleen bewust geselecteerde wijzigingen te herstellen en geen PAT, wachtwoorden, keys of complete back-ups openbaar te delen.

## 0.3.24
- Nieuw back-upformaat v4 met expliciete `deviceSettingsValueSource: device.settings`.
- Oude v3-back-ups krijgen een conservatieve apparaatinstellingenfilter om historische/stale `settings_obj.value`-verschillen niet meer als restore-keuze te tonen.
- De bewezen `beacon_timeout`-route blijft compatibel met v3-back-ups.
- Voor volledige betrouwbare apparaatinstellingen wordt een nieuw gemaakte v4-back-up gebruikt.

## 0.3.23
- Restoreplan toont null/lege placeholders uit oudere apparaatback-ups niet langer als herstelbare wijzigingen.
- Alleen concrete primitieve apparaatinstellingen die Homey nu als schrijfbaar exposeert worden als restore-kandidaat getoond.
- Bewezen Shelly `beacon_timeout` restorepad blijft ongewijzigd.

## 0.3.22
- Restore-interface opgeschoond: de selectielijst staat direct bovenaan; technische details zijn standaard ingeklapt.
- Na restore verschijnt een korte, duidelijke uitslag met verificatiestatus en alleen het aantal overige niet-gewijzigde verschillen.
- Apparaatkeuzes tonen compacte settinginformatie in plaats van lange capability-/settinglijsten.
- Werkende restore- en verificatie-engine van 0.3.21 inhoudelijk ongewijzigd gelaten.
- Versienummers in app.json, package.json en package-lock.json gelijkgetrokken.

# 0.3.21

- Fix: device-settings restore crash door ontbrekende `normalizeSettingValue` helper.
- Schrijft alleen primitieve waarden met typecontrole; `null`, `undefined` en complexe waarden worden geweigerd.
- Verificatie na `setDeviceSettings()` blijft actief.
- Geen automatische device-selectie; apparaatinstellingen blijven handmatig selecteren.

## 0.3.20

- Device-settings veiligheidsfilter aangescherpt: de parser volgt alleen de echte `children`-boom van Homey's settings UI en niet langer willekeurige geneste device-metadata.
- Shelly `beacon_timeout` blijft ondersteund; deze instelling is bevestigd op `$[0].children[0]`.
- Voorkomt valse restore-kandidaten zoals host-, sleutel-, capability- en HomeyClass-metadata.
- Restore/PAT (stappen 4 en 5) blijven boven de individuele flowzoeker staan voor minder scrollen tijdens herstel.

## 0.3.19

- Device-settings vergelijken en back-uppen gebruikt nu `Device.settings` voor de actuele opgeslagen waarden; `settings_obj` wordt alleen nog gebruikt als schema/type/writable-bron.
- Device-settings verificatie na restore leest eveneens `Device.settings`, zodat controle niet meer afhankelijk is van een mogelijk verouderde `settings_obj.value`.
- Tijdelijke 0.3.18 Beacon Timeout-diagnostiek verwijderd.
- Instellingenpagina herschikt: back-up openen, PAT en Full Configuration Restore staan boven de losse flowzoeker om scrollen bij herstel te beperken.

# Changelog

## 0.3.18
- Gerichte, alleen-lezen diagnose voor `beacon_timeout` in het herstelplan.
- Toont back-upwaarde, ruwe live `settings_obj`-waarde, genormaliseerde waarde, Homey-type, schrijfbaar-status en vergelijkingsbeslissing.
- Restore-logica zelf is ongewijzigd ten opzichte van 0.3.17; deze build is bedoeld om het resterende Shelly-vergelijkingsprobleem exact te lokaliseren.

## 0.3.17
- Versienummer in de instellingenpagina wordt nu dynamisch uit het actieve app-manifest gelezen; geen hardcoded oude versie meer.
- App-startlog gebruikt eveneens de actieve manifestversie.
- Device-settings tree-parser uit 0.3.16 behouden voor echte geneste setting-nodes (`id` + primitieve `value`), met de bestaande write-beveiligingen.

## 0.3.16
- Device-settings parser loopt nu robuust door de volledige geneste `settings_obj`-boom en neemt alleen echte `id` + primitieve `value`-nodes mee.
- Read-only `beacon_timeout` diagnostiek uit 0.3.15 verwijderd.
- Bestaande selectieve restore- en write-verificatie blijft behouden.

## 0.3.15
- Alleen-lezen diagnostiek voor `Beacon Timeout` in `settings_obj`; toont vorm, key/id, Homey-type en primitief datatype zonder restore-gedrag te verruimen.
- Bestaande v0.3.14-filter en write-beveiligingen blijven ongewijzigd.

## 0.3.14
- Device-settings worden alleen nog meegenomen wanneer Homey `settings_obj` het veld als een schrijfbaar type definieert: text, password, textarea, number, checkbox of dropdown.
- Read-only `label`-velden, `group`-containers en onbekende metadata uit oudere back-ups tellen niet meer als restore-wijziging.
- Ook bij restore wordt de live Homey-schema-informatie opnieuw gecontroleerd vóór een setting-write.
- Password-settings blijven restorebaar maar hun actuele/back-upwaarden worden niet in het herstelplan weergegeven.
- Nieuwe back-ups slaan alleen schema-bevestigde schrijfbare device-settings op.

## 0.3.13
- Device-settings restore veiliger gemaakt: alleen werkelijk afwijkende setting-keys worden geschreven.
- Herstelplan toont per afwijkende device-setting key, huidige waarde/type en back-upwaarde/type.
- Waarden worden vóór schrijven genormaliseerd naar het live Homey-datatype.
- Lege/null back-upwaarden worden bewust niet geschreven wanneer Homey die niet betrouwbaar via `setDeviceSettings` accepteert; de restore faalt dan veilig met een duidelijke melding.
- Nieuwe back-ups bewaren optioneel het Homey setting-type per key voor betere diagnose en toekomstige restores.

## 0.3.12
- Apparaatinstellingen worden betrouwbaarder uitgelezen: eerst de vlakke device-settings, met settings_obj als fallback.
- Device-diff vergelijkt instellingen per sleutel en markeert alleen echte verschillen.
- Restore schrijft uitsluitend de gewijzigde instelling-sleutels terug, niet blind het volledige settings-object.
- Na een settings-write leest Backupcentrum de instellingen via de PAT opnieuw uit en verifieert de geselecteerde waarden.
- Homey Energy-metadata (zoals “Energieverbruik wanneer aan”) blijft buiten settings-restore; de gedocumenteerde Device API biedt hiervoor geen ondersteunde write in updateDevice.

## 0.3.11
- Bestaande apparaatwijzigingen zijn nu afzonderlijk en standaard uitgevinkt selecteerbaar voor restore.
- Device restore schrijft uitsluitend expliciet geselecteerde apparaten terug.
- Na restore wordt elke geselecteerde apparaatwijziging via een vers herstelplan geverifieerd.
- Ontbrekende apparaten blijven alleen een waarschuwing en worden nooit automatisch gepaird.

## 0.3.10
- Flow create-verificatie herkent exact herstelde Standard/Advanced Flows ook wanneer Homey een nieuw ID toekent.
- Voorkomt dubbele create bij een reeds exact herstelde flow met nieuw ID.

# 0.3.9

- Zone-restore verifieert elke geselecteerde zone-update direct na de write via een verse `getZone()` read.
- Naam, bovenliggende zone en icoon worden alleen gecontroleerd wanneer dat veld daadwerkelijk in het herstelplan gewijzigd is.
- Een zone-write die zonder exception terugkeert maar niet is toegepast, wordt nu als fout gerapporteerd in plaats van als geslaagd.
- Het restore-rapport bevat per geslaagde zone-update de geverifieerde actuele zonegegevens.

# 0.3.8
- Zones worden nu inhoudelijk vergeleken op naam, bovenliggende zone en icoon.
- Bestaande zone-wijzigingen en ontbrekende zones zijn afzonderlijk selecteerbaar voor restore.
- Zone-restore gebruikt `updateZone` voor bestaande zones en voorkomt duplicaten door een bestaande zone met dezelfde naam te hergebruiken als het oude ID ontbreekt.
- Na restore worden geselecteerde zones opnieuw vergeleken en expliciet geverifieerd.

# 0.3.7

- Standaard- en Advanced Flow-wijzigingen zijn nu afzonderlijk selecteerbaar voor restore.
- Flow-restore schrijft alleen expliciet geselecteerde flows terug.
- Na restore wordt elke geselecteerde flow opnieuw inhoudelijk vergeleken met de back-up.
- Niet-geselecteerde Logic- en flowverschillen blijven apart zichtbaar.

# 0.3.6

- Restore-verificatie beoordeelt nu de daadwerkelijk geselecteerde Logic-items in plaats van alle resterende verschillen met de back-up.
- Een geselecteerde Logic-restore wordt expliciet als geverifieerd gemeld zodra de actuele waarde weer overeenkomt met de back-up.
- Niet-geselecteerde en dynamische verschillen blijven zichtbaar als “Overige verschillen — niet gewijzigd” en maken een geslaagde geselecteerde restore niet langer foutief verdacht.
- Bij een geselecteerd item dat na restore nog afwijkt, toont het rapport de actuele en verwachte waarde.

# 0.3.5

- Restore writes now use an optional Personal Access Token (PAT) through HomeyAPI.createLocalAPI.
- Added PAT status/save/test controls; the token stays in local app settings and is never exported.
- Only actual device and flow differences are written during restore; matching objects are no longer rewritten.
- Logic restore is opt-in per variable; no Logic variable is preselected.
- Clearer errors when Homey write scopes are unavailable.

# Changelog

## 0.3.4
- Dedupliceert Logic-variabelen op naam in het herstelplan.
- `health_heartbeat` wordt als dynamisch gemarkeerd en standaard niet hersteld.
- Logic-wijzigingen zijn vóór restore individueel selecteerbaar.
- Restore-API ontvangt expliciete Logic-selectie; niet-geselecteerde/dynamische waarden worden overgeslagen.

# 0.3.4
- Herstelplan toont concrete wijzigingen, inclusief huidige en back-upwaarde voor Logic.
- Restorebevestiging gebruikt twee expliciete tikken in plaats van `window.confirm`, voor betere Homey/iOS-webviewcompatibiliteit.
- Logic-restore schrijft alleen werkelijk geplande wijzigingen terug.
- Na restore wordt automatisch een nieuw herstelplan opgebouwd en zichtbaar geverifieerd.
- Tekst over apparaatinstellingen gecorrigeerd.


## 0.3.2
- Dry-run vergelijkt de back-up met de actuele Homey-configuratie en telt alleen echte wijzigingen.
- Device-settings worden in het herstelplan best-effort inhoudelijk vergeleken.
- Bij een volledige match toont de app expliciet **0 wijzigingen nodig** en blijft **Restore uitvoeren** uitgeschakeld.
- De restore-endpoint retourneert bij een volledige match veilig zonder configuratie opnieuw te schrijven.

## 0.3.1
- Herstelt device-settings export: gebruikt de officiële `getDeviceSettingsObj()` API.
- Zet de Homey settings-structuur om naar de vlakke `{ settingId: value }` vorm die `setDeviceSettings()` verwacht.
- Onderdrukt verwachte waarschuwingen voor apparaten zonder uitleesbare settings, zodat echte fouten zichtbaar blijven.

## 0.3.0
- Back-upformaat v3 met best-effort apparaatinstellingen.
- Full Configuration Restore met verplichte dry-run.
- Ontbrekende Store-apps eerst installeren.
- Zones en Logic herstellen.
- Bestaande apparaten reconciliëren; geen automatische radio-pairing.
- Standard en Advanced Flows als laatste herstellen.
- Verificatie op broken flows na restore.
- Bestaande WebDAV- en losse flow-export behouden.

# Changelog

## 0.2.0
- Hernoemd naar Homey Backupcentrum.
- Back-up uitgebreid met devices, zones, Logic-variabelen en app-inventaris.
- iPhone/iPad-delen via Web Share API met downloadfallback.
- Meerdere WebDAV-doelen met Basic Auth, verbindingstest en directe upload.
- WebDAV-wachtwoorden worden uitgesloten van het back-upbestand.
- Bestaande flowbackup- en individuele flowexport behouden.
