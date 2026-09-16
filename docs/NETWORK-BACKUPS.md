# Network backups — 0.3.28

## Instellen / Setup

1. Open Backup Center → instellingen → SMB / SFTP.
2. Kies protocol, naam, host/IP, gebruikersnaam, wachtwoord en een bestaande map.
3. SMB: vul alleen de sharenaam in bij “SMB-share”, bijvoorbeeld `backups`; de map is bijvoorbeeld `Homey`. Poort 445, optioneel Windows-domein. SFTP: standaardpoort 22, map bijvoorbeeld `/backups/homey`.
4. SFTP: verkrijg de SHA256-hostsleutelvingerafdruk via de serverbeheerder (bijvoorbeeld `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` op de server). Dit is de sleutel van de **server**, niet van je gebruiker. Er is bewust geen “accepteer elke sleutel”-optie. Bij meerdere hostsleuteltypen moet de ingestelde vingerafdruk bij de onderhandelde serverkey horen.
5. Bewaar en test de verbinding. De test schrijft, hernoemt en verwijdert een eigen klein bestand. Gebruik daarna “Nu back-up maken”.
6. Bestaande wachtwoorden blijven behouden bij een lege invoer. Bij wijziging van server, poort, protocol, account, SMB-share/domein of SFTP-hostsleutel moet het wachtwoord opnieuw worden ingevuld. Bestemming verwijderen verwijdert ook het opgeslagen wachtwoord.

## Flow-planning

Voorbeeld: **Elke zondag om 03:00 → Maak back-up naar netwerkbestemming → NAS**.

- Actie `network_backup`: maakt een nieuwe configuratieback-up en schrijft naar de gekozen SMB/SFTP-bestemming.
- Trigger `network_backup_completed`: bestemming, bestandsnaam, aantal bytes.
- Trigger `network_backup_failed`: bestemming en een foutmelding zonder serverdetails of wachtwoord.
- Conditie `network_destination_reachable`: controleert daadwerkelijk schrijf-/hernoem-/verwijderrechten met een tijdelijk testbestand; bij bezig/offline/fout is het resultaat false.
- Alle kaarten kiezen een opgeslagen bestemming via autocomplete en gebruiken een stabiel ID. Bij verwijderen moet je betrokken Flows aanpassen.
- Een actie voert één poging uit. Configureer eventuele retries zelf in Flow. De bestaande WebDAV-planner behoudt zijn eigen retrygedrag.
- Er kan één SMB/SFTP-operatie tegelijk lopen. Gelijktijdige acties krijgen “already running”; er wordt geen stille wachtrij opgebouwd. Gebruik geen geslaagd-trigger om onbeperkt dezelfde backupactie opnieuw te starten.

## Opslag en foutgedrag

Passwords are stored in the existing Homey app-settings store, protected by Homey's access controls. This is **not a separate encrypted credential vault**. They are never returned by the destination-list API, placed in this app's backup exports, logged by the network layer or included in Flow tokens. Homey's own full-system backups may contain app settings. Backed-up Flow arguments and device settings may independently contain secrets; protect the backup files themselves.

Uploads first write a random `.homey-*.partial` file in the target folder, then rename it to the final `Backup_Center_<UTC>_<UUID>.json`. A failed write is never deliberately published as a final file. The app attempts to remove its partial file on failure. A hard timeout, process crash or disconnect may leave a partial/probe file; remove only the matching `.homey-*` file after confirming no upload is running. A server may complete the final rename just before a lost response: in that case check the destination before retrying.

The worker has a hard timeout of 5–120 seconds (30 by default); worker termination closes its sockets. This timeout covers the network operation, not Homey's initial inventory collection. Large backups may need a higher timeout. A failure to deliver a completion Flow does not change a successfully uploaded file into a failed upload. There is no persisted replay of completion events after an app restart.

SMB support uses SMB2. It does not implement SMB3 encryption or required SMB signing. Use a trusted LAN and a dedicated restricted account; use SFTP if the NAS requires encryption/signing. Do not weaken the NAS security policy to accommodate this client. SFTP currently supports password authentication with mandatory host-key verification; private-key authentication is not part of this build.

No automatic directory creation, retention deletion, compression or network restore is included. Download a network backup and use the existing explicit restore-plan/confirmation flow. Existing WebDAV destinations and schedule settings are unchanged.

## Validation / remaining acceptance checks

Automated tests cover real localhost SFTP upload, Unicode content, bad password, changed host key, denied write and a stalled connection; SMB adapter call ordering and cleanup; settings forms; Flow listeners; export redaction; concurrency and existing restore/scheduler behavior. SMB has **not** been tested against a real NAS. The build has **not** been installed on a physical Homey. Repeat browser download/file-opening tests on Android and Windows Chrome/Firefox, including the exact scenario reported by Peter_Kawa.
