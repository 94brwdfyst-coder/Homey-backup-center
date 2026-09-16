# Backup Center 0.4.1

## Nederlands

Maak configuratieback-ups van Standard Flows, Advanced Flows, flowmappen, zones, Logic-variabelen, apparaten, ondersteunde apparaatinstellingen en geïnstalleerde apps. Vergelijk een back-up met Homey en herstel alleen de wijzigingen die je zelf selecteert en bevestigt.

Kies bovenaan de instellingen **Nederlands** of **English**. De taal wordt in de appinstellingen bewaard. Een taalwijziging herlaadt het scherm; bewaar andere gewijzigde instellingen eerst. Bestaande Homey API Key-, WebDAV- en schema-instellingen blijven bij een normale update behouden.

### Homey API Key

Eerdere versies gebruikten de naam Personal Access Token (PAT). Dit is dezelfde opgeslagen sleutel; opnieuw invoeren is niet nodig.

Open Homey Web → Instellingen → API Keys → Nieuwe API Key. Kies schrijfrechten voor Logic, Apparaten, Zones, Flows en Apps (`homey.logic`, `homey.device`, `homey.zone`, `homey.flow`, `homey.app`). Kopieer de sleutel zodra Homey deze toont en plak hem in Backupcentrum. De verbindingstest controleert authenticatie; de geselecteerde restore controleert de daadwerkelijke schrijfrechten.

[Officiële Homey-uitleg](https://support.homey.app/hc/en-us/articles/8178797067292-Create-and-use-API-Keys-on-Homey-Pro)

### Automatische back-up

Kies tijd, dagen en WebDAV-doel en bewaar het schema. De bestaande configuratie, bijvoorbeeld Koofr om 03:00 op alle weekdagen, wordt behouden. Een nieuwe installatie start met de planner uitgeschakeld.

- Tijdzone Europe/Amsterdam; controle iedere minuut. Uitvoering kan door belasting of herstart later beginnen.
- Drie pogingen per geplande dag: één eerste poging en twee herpogingen, minstens 15 minuten na de vorige mislukking. Een laat begonnen reeks mag na middernacht eindigen, ook op een niet-geselecteerde dag.
- Herstarts behouden de teller en eerstvolgende herpoging. Er worden geen oudere gemiste dagen ingehaald, behalve een reeds begonnen reeks herpogingen.
- Handmatige back-ups hebben eigen status en tellen niet als automatische dagback-up. Gelijktijdige WebDAV-back-ups worden geblokkeerd.
- Pas na drie mislukte back-ups volgt een Tijdlijnmelding en een push naar de gekozen gebruiker, standaard de Homey-eigenaar. Push gebruikt de opgeslagen API Key met Flow-schrijfrechten. Een kritieke push wordt gebruikt wanneer die kaart beschikbaar is; anders een normale push. Ontvangers worden via de appverbinding opgehaald. Telefooninstellingen bepalen de uiteindelijke presentatie.
- Mislukte meldingen zijn zichtbaar. Push wordt maximaal drie keer aangeboden met 15 minuten ertussen. Na een bevestigde API-aanroep wordt die dag niet opnieuw verzonden. Werkelijke telefoonbezorging kan de app niet bewijzen.
- Uploadsucces kan waarschuwingen over ontbrekende inventarisgegevens hebben. Controleer de waarschuwingen en de inhoud van je back-ups.

De WebDAV-map moet bestaan. Maximaal acht doelen; HTTP(S) met optionele Basic Authentication. Geen SFTP, FTPS of SMB. Geen automatisch verwijderen of rotatie van opgeslagen back-upbestanden.

### Grote back-ups en downloaden

Overdracht gebruikt delen van 16 KiB met kleine JSON-verzoeken en antwoorden. Back-up, herstelkeuze en resultaten worden in delen overgedragen; langdurige bewerkingen worden gevolgd zonder de restore opnieuw te starten. Tijdelijke gegevens blijven alleen in appgeheugen: maximaal 50 MiB per overdracht, 64 MiB totaal, maximaal acht overdrachten, 30 minuten vervaltijd bij inactiviteit. Homey's beschikbare geheugen en de inhoud bepalen de praktische grens. Na een appherstart of verlopen overdracht moet je de back-up opnieuw openen.

Downloaden gebruikt waar beschikbaar een bewaardialoog of bestandsdeelkaart. Anders blijft een klikbare bestandslink beschikbaar. De app meldt alleen wat hij kan vaststellen; een aangeboden download is geen bewijs dat de browser hem heeft bewaard. Gebruik bij een blokkerende mobiele webview Homey Web in een gewone browser of WebDAV.

### Vertrouwelijke gegevens

De opgeslagen Homey API Key, WebDAV-wachtwoorden en Logic-variabele met exact de naam `ha_backup_token` worden niet geëxporteerd. Die Logic-variabele wordt ook niet uit oudere back-ups hersteld. Dit is geen algemeen geheimenfilter: andere apparaatinstellingen, variabelen en flowargumenten kunnen gevoelige waarden bevatten. De app draait geen tokenrotatie en wijzigt geen Home Assistant-instellingen.

### Installeren / bijwerken

Pak de zip uit en open de map `hbc0327` in een terminal:

```sh
npm ci --ignore-scripts
homey app validate --level publish
homey app install
```

Selecteer vooraf de juiste Homey via `homey select` wanneer nodig. Gebruik geen `--clean` als bestaande appinstellingen behouden moeten blijven. De macOS-install-wrapper is eveneens beschikbaar. Publicatie naar de App Store is een aparte stap.

### Grenzen en tests

Dit is een ontwikkel-/testversie. Het pakket is lokaal getest en gevalideerd, maar 0.3.27 is nog niet op een echte Homey of Android-telefoon getest. Controleer na installatie eerst taal, behouden instellingen, nieuwe back-up en een vergelijking met dezelfde Homey. Test daarna één herkenbare geselecteerde wijziging, geplande back-ups en telefoonmeldingen. Zie `TESTING.md` voor de uitgevoerde tests en resterende praktijkcontroles.

Geen volledige Homey-systeemimage; radio-pairings worden niet opnieuw opgebouwd. Bewaar broncode van eigen Developer Apps apart. Zie `CREDITS.md` voor herkomst en eerdere Beta 1-tests. De historische basis is een eerdere back-uptoolsversie.

---

## English

Back up Standard and Advanced Flows, folders, zones, Logic variables, devices, supported device settings and installed app information. Compare a backup with Homey and restore only the changes you select and confirm.

Choose **English** or **Nederlands** at the top of settings. The language is saved on Homey; changing it reloads the page. Normal updates retain existing API Key, WebDAV and schedule settings.

### Setup

For restore and push access, create a **Homey API Key** in Homey Web → Settings → API Keys → New API Key. Grant write access for Logic, Devices, Zones, Flows and Apps (`homey.logic`, `homey.device`, `homey.zone`, `homey.flow`, `homey.app`). Earlier versions called this key a PAT; saved keys are retained. Authentication testing does not verify every write permission.

For automatic backups, select a WebDAV destination, weekdays and time. The schedule uses Europe/Amsterdam, checked every minute. Each scheduled day allows one initial attempt and two retries at least 15 minutes apart. Retries survive restarts and can finish after midnight. Manual uploads have separate status. New installations start with scheduling disabled; existing schedules are retained.

Only after all three attempts fail does the app create a Timeline notification and attempt a push to the selected user, defaulting to this Homey's owner. Push requires a working API Key with Flow write access; a critical push is preferred when available, otherwise a normal push. Delivery errors appear in settings and notification retries are bounded. A successful API call does not prove delivery to the phone.

### Files and limits

Large backups, restore selections and results use 16 KiB transfer chunks. Long operations are polled without repeating restore writes. Temporary in-memory transfers expire after 30 minutes of inactivity or an app restart; limits are 50 MiB each, 64 MiB total and eight transfers. Practical capacity depends on available Homey memory and backup contents.

Downloads use a save dialog or file sharing where supported, otherwise a persistent file link. Browser restrictions may require Homey Web in a regular browser or WebDAV. WebDAV uses HTTP(S) and optional Basic Authentication; the folder must already exist. SFTP, FTPS, SMB and automatic backup-file retention are not included.

Saved API Keys, WebDAV passwords and the exact Logic variable `ha_backup_token` are excluded from exports. That variable is also excluded from restores of old backups. Other device settings, variables and Flow arguments may contain secrets. This app does not rotate tokens or change Home Assistant configuration.

### Install and test

Extract the zip, enter `hbc0327`, run `npm ci --ignore-scripts`, `homey app validate --level publish` and `homey app install`. Select the intended Homey beforehand if needed. Do not use `--clean` when retaining app settings. Publishing is a separate action.

0.3.27 is a development/test build. Local tests and publish-level validation pass; actual Homey, Android and phone notification tests remain. See `TESTING.md`. This app does not replace a complete Homey system backup or recreate radio pairings. Keep custom Developer App source folders separately.

## 0.4.0 — Network backup release

SMB2 and SFTP network backups are now field-tested end to end on a Homey Pro against an Ubuntu server on the local network. SMB2 authentication uses NTLMv2. Saved non-secret destination fields are restored when reopening settings; passwords remain hidden and can be left empty to retain the saved value.

### SFTP host-key fingerprint

SFTP verifies the identity of the SSH/SFTP server before sending a backup. Enter the fingerprint of the **existing server host key**. SHA256 is recommended; SHA1 is also accepted for NAS/server interfaces that only show SHA1. Do not invent a fingerprint and do not create a separate SSH key just for Backup Center.

On Linux/OpenSSH, an administrator can display the ED25519 host-key fingerprint with:

```sh
sudo ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

Example output:

```text
256 SHA256:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx server (ED25519)
```

Copy only the `SHA256:...` value into Backup Center. If your NAS shows a colon-separated SHA1 host-key fingerprint, `SHA1:aa:bb:...` is supported as well. Verify the fingerprint through a trusted administrator/NAS interface before accepting it.

### Field-tested in 0.4.0

- SMB2: connection/write test and a real JSON backup to Samba on Ubuntu; NTLMv2 confirmed in the app runtime.
- SFTP: host-key verification, connection/write test and a real JSON backup to OpenSSH/SFTP on Ubuntu using SHA256.
- Saved SMB2/SFTP non-secret settings reload correctly in the settings UI.
- Synology, QNAP and other NAS models are supported targets in principle but were **not** part of this specific end-to-end validation. SHA1 acceptance exists for NAS compatibility but was not the fingerprint format used in this field test.

## 0.3.28 — SMB/SFTP and Homey Flow

SMB and SFTP destinations can now be configured and tested in app settings. Schedule network backups using Homey's date/time trigger and the **Create backup to network destination** action. Completion/failure triggers and a writable-destination condition are included.

See [Network backup setup and limitations](docs/NETWORK-BACKUPS.md), [build/provenance review](docs/provenance/BUILD-REVIEW.md), and [runtime dependency notices](THIRD-PARTY-NOTICES.txt).

Development: Node.js 22 or newer, `npm ci`, `npm run lint`, `npm test`, `npm run build`. Integration tests create temporary servers on localhost; no NAS credentials are needed. `npm run build` creates `.homeybuild` without installing, publishing or uploading the app.
