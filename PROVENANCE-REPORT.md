# Vergelijkingsrapport / Comparison report

**Datum:** 15 september 2026  
**Onderwerp:** Homey Backup Center 0.3.27 versus `smarthomesven/homey-flow-version-history`  
**Lokale werkmap:** `work/original/hbc0327` (Backup Center) en `work/sven` (publieke repo)

## Samenvatting

De volledige lokale vergelijking levert geen exacte bestandsovereenkomst, geen gedeeld commentaarblok en geen betekenisvol near-verbatim codeblok op tussen Backup Center en Svens repository, inclusief de historische codeblobs van alle 46 commits. De overeenkomsten die de automatische analyse vindt zijn korte patronen die door Homey's API, Node.js en standaard Homey-instellingen-HTML worden verklaard.


Daarom is er op basis van deze bronvergelijking geen technische grond om Backup Center als een afgeleid werk van Svens GPLv3-code te behandelen of de hoofdlicentie alleen om die reden naar GPLv3 te wijzigen. Dat is een technische conclusie, geen juridisch oordeel. De huidige hoofdlicentie is daarom ongemoeid gelaten.

## Bron en reproduceerbaarheid

- De aangeleverde `/mnt/data/homey-backupcenter-source.zip` was in deze runtime niet als pad aangekoppeld. De beschikbare lokale kopie is `.../referenced-chatgpt-conversation-this-is-an/outputs/Homey_Backup_Center_0.3.27.zip`; die bevat 31 bestanden, 284.688 bytes en SHA-256 `c42086558365479b4c42708e53318e2bd1b0a85ca677576bd8ef0cac92311b58`.
- De zip is byte voor byte gecontroleerd tegen `work/original/hbc0327`; alle 31 bestanden zijn gelijk.
- Svens repo is lokaal uitgecheckt vanaf `f633db30ab5889bfbfa6a966676690ec3bb54a35` (tag 1.0.22, `main`, 13 september 2026). De GitHub-repo is publiek en vermeldt GPL-3.0.
- De inventaris en hashes staan in [`outputs/evidence/manifest.json`](evidence/manifest.json). De historische commit/statistiek-export staat in [`outputs/evidence/history.txt`](evidence/history.txt); de kandidaatmatches staan in [`outputs/evidence/matches.json`](evidence/matches.json).

## Svens LICENSE, notices en historie

Svens [`LICENSE`](https://github.com/smarthomesven/homey-flow-version-history/blob/main/LICENSE) is de standaardtekst van de GNU General Public License versie 3 (29 juni 2007), zonder zichtbare project-specifieke uitzonderingen. De repo toont GPL-3.0 als licentie. `app.json` noemt Sven Serlier als auteur en verwijst naar de repo; er is geen aparte `NOTICE`- of `CREDITS`-file in de publieke tree. `CONTRIBUTING.md` en `CODE_OF_CONDUCT.md` zijn algemene projectdocumenten.

De geschiedenis loopt van initiële commit `9ec3353` (21 maart 2026) tot `f633db3` (13 september 2026), 46 commits in totaal. De functionele commits laten een consistente eigen evolutie zien: flow-revisies, trash, purge/max-revisions, dependency-updates en RAM-optimalisatie. De auteurs in de geschiedenis zijn Sven/smarthomesven (`sven@dypodex.com`).

## Methode

1. Byte-hashes van alle 31 Backup Center-bestanden en alle 20 getrackte bestanden in Svens `HEAD`.
2. Vergelijking van alle historische Sven-blobs die in de commits voorkomen, niet alleen `HEAD`.
3. Regels, strings, comments en token-sequenties vergeleken; de langere identifier-genormaliseerde matches zijn handmatig teruggelezen.
4. Functie- en structuurinventaris gemaakt voor `app.js`, `api.js`, `settings/index.html`, `settings/backup.js` en de manifesten.

## Resultaten

### Exacte en near-verbatim code

- **Exacte bestanden:** 0. Geen bestand uit de Backup Center-zip heeft dezelfde bytes als een bestand in Svens `HEAD` of historische blobset.
- **Comments:** geen gedeeld commentaarblok van betekenis; `outputs/evidence/shared-comments.json` is leeg.
- **Langste bruikbare matches:** de niet-genormaliseerde analyse vindt alleen korte stukken (maximaal 14 tokens) in generieke HTML/API-context. De genormaliseerde analyse meldt bijvoorbeeld een blok in Sven `api.js` regels 4–10 tegenover Backup Center `api.js` regels 4–6. Na teruglezen blijkt dit alleen de gebruikelijke Homey API-wrappervorm (`async ...({ homey ... }) { return homey.app... }`), met andere methoden en een andere API-oppervlakte.
- Een tweede genormaliseerde kandidaat is Sven `app.js` regels 116–118 tegenover Backup Center `app.js` regel 703: beide halen standard en advanced flows op met `getFlows()`/`getAdvancedFlows()`; Sven initialiseert revisies, Backup Center verifieert restore-resultaten. Dit is een Homey API-patroon, geen gekopieerde implementatie.
- Overige matches zijn de standaard Homey-settings HTML-omhulling, `app.json`-afbeeldingspaden en gedeelde npm lockfile-regels. Die zijn niet auteursrechtelijk onderscheidend voor deze vergelijking.

### Svens specifieke flow-history-architectuur ontbreekt in Backup Center

Svens [`app.js`](https://github.com/smarthomesven/homey-flow-version-history/blob/main/app.js) bevat onder meer:

- `onInit` regels 14–32: eerste-run initialisatie, `HomeyAPI.createAppAPI({ homey, debug: false })`, flow-eventlisteners voor create/update/delete en een uurinterval voor trash-opruiming;
- `getFlowRevisions` regel 58, `flow_revisions_<id>`-settingskeys, en `/userdata` UUID-bestanden;
- `formatFlow` regels 129–144: eigen standaard/advanced-revisievorm;
- `initRevision` regels 146–159 en `onFlowUpdate` regels 183–204: revisies opslaan, max vijf/instelbaar, oudste bestand verwijderen;
- `onFlowDelete` regels 83–113 en `cleanupTrash` regels 67–81: verwijderde flows naar een trashlijst en na 30 dagen opruimen.

In Backup Center komen de onderscheidende namen en flow-events niet voor (`flow_revisions_`, `flow_trash`, `initRevision`, `formatFlow`, `onFlowUpdate`, `onFlowDelete`, `cleanupTrash`, `advancedflow.create/update` zijn niet aanwezig). Backup Center heeft in plaats daarvan een andere klasse en taakverdeling: `HomeyBackupCenterApp` (`app.js` regels 168–706), helpers voor veilige inventory-extractie (regels 14–165), `exportBackup` (308–395), `buildRestorePlan` (404–552), `restoreBackup` (554–707), plus WebDAV, scheduler, jobs en chunked transfers. De publieke API in Backup Center (`api.js` regels 3–29) exposeert 26 backup/restore- en job-endpoints; Svens API (`api.js` regels 1–27) exposeert vier revisie/trash-endpoints.

### Gedeelde Homey-structuur versus eigen werk

De volgende gedeelde elementen zijn verklaarbaar door de Homey SDK/API en zijn geen sterk bewijs van ontlening:

- `HomeyAPI.createAppAPI`, `flow.getFlows()` en `flow.getAdvancedFlows()`;
- standaard Homey-appmanifestvelden zoals `sdk`, lokale platformondersteuning, `tools`, `homey:manager:api` en assetpaden;
- flowvelden als `type`, `name`, `trigger`, `conditions`, `actions` en `cards`.

Svens `formatFlow` maakt een kleine revisiesnapshot. Backup Center laat Homey's flowobjecten via `settings/backup.js` regels 20–41 door in `buildFlows`, voegt mappen toe en valideert een geheel ander back-upformaat. Dat verschil in dataflow, opslagmodel en restore-doel maakt een gedeelde Homey-datastructuur waarschijnlijker dan code-afleiding.

## Provenance

De huidige [`CREDITS.md`](../work/original/hbc0327/CREDITS.md) vermeldt Mike_Nono als bron van de oorspronkelijke flow-back-up- en splitscripts en maakt expliciet onderscheid met latere Backup Center-code. `settings/backup.js` regel 1 draagt dezelfde bronvermelding. De door de gebruiker verstrekte expliciete toestemming van Mike_Nono is daarom relevante provenance-context voor zijn materiaal; die toestemming zegt niets over Svens GPL-code.

Mike1233 en SingKT zijn in de bestaande credits als feedback-/testbijdragers opgenomen. Dat is geen claim dat zij code hebben geschreven. De NL- en EN-secties voor mogelijk vergeten codebijdragers zijn aan `CREDITS.md` toegevoegd; na verificatie kan daar correcte copyright-, licentie- en creditinformatie worden aangevuld.


## Aanvulling: toestemming van Sven Serlier / smarthomesven

Op 15 september 2026 leverde de projecteigenaar een schermafbeelding aan van een rechtstreeks bericht van Sven Serlier (smarthomesven). Daarin bevestigt Sven dat zijn Flow Version History-app open source is en dat de code door iedereen gebruikt mag worden. Dit is toestemming/provenance-context, geen bewijs dat Backup Center Sven-code bevat. Svens publieke repository bevat bovendien een GPLv3-LICENSE; de technische vergelijking hierboven blijft leidend voor de vraag of er daadwerkelijk GPL-afgeleid materiaal is gebruikt. De schermafbeelding zelf is niet publiek gemaakt; de tekstuele vastlegging staat in CREDITS.md.

## Addendum: permission from Sven Serlier / smarthomesven

On 15 September 2026, the project owner supplied a screenshot of a direct message from Sven Serlier (smarthomesven). Sven confirms that his Flow Version History app is open source and that everyone may use the code. This is permission/provenance context, not evidence that Backup Center contains Sven code. Sven's public repository also contains a GPLv3 LICENSE; the technical comparison above remains decisive for whether any GPL-derived material was actually used. The screenshot itself was not made public; the textual record is in CREDITS.md.
## Licentie- en publicatiebeoordeling

**Feit:** Svens publieke repo bevat GPLv3-code.  
**Technische inferentie:** in de aangeleverde Backup Center-bron is geen herkenbare Sven-code gevonden; de huidige code gebruikt algemene Homey API-patronen en een andere architectuur.  
**Juridische onzekerheid:** of een werk “afgeleid” is, hangt af van toepasselijk auteursrecht, beschermde expressie en feiten buiten deze bronboom. Een statische vergelijking kan verborgen, niet-aangeleverde of mondeling overgedragen code niet uitsluiten.

Praktisch betekent dit voor publieke bronpublicatie:

- wijzig de hoofdlicentie niet naar GPLv3 uitsluitend vanwege de overeenkomstige productfunctie of Homey API;
- publiceer pas onder een gekozen hoofdlicentie nadat voor alle daadwerkelijk gebruikte code de rechthebbenden en licentievoorwaarden zijn gecontroleerd;
- behoud de provenancevermeldingen en voeg bij later ontdekte codebijdragen de vereiste copyright-/licentienotices toe;
- als later wél Sven-code wordt vastgesteld, behandel het betrokken werk als mogelijk GPLv3-afgeleid: behoud notices, markeer wijzigingen en lever de bijbehorende bron onder GPLv3 bij conveyance, met juridisch advies voor de concrete distributievorm;
- Mike_Nono's toestemming voor zijn eigen scripts vervangt geen licentieonderzoek voor andere auteurs.

## Lokale wijzigingen en controle

Gewijzigd:

- [`work/original/hbc0327/CREDITS.md`](../work/original/hbc0327/CREDITS.md): NL+EN-procedure voor vergeten codebijdragers en expliciet onderscheid tussen code en testen/feedback.
- Dit eindrapport in `outputs/`.
- [`Homey_Backup_Center_0.3.27-with-provenance.zip`](Homey_Backup_Center_0.3.27-with-provenance.zip): lokale bronkopie met de bijgewerkte `CREDITS.md`.

Niet gewijzigd: de Backup Center-hoofdlicentie (er is geen technische grond om die door GPLv3 te vervangen). Alle lokale JavaScriptbestanden slagen voor `node --check`; de projecttests zijn niet uitgevoerd omdat `node_modules` niet in de lokale kopie aanwezig is.
