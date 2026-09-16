# Onafhankelijk provenance- en licentieonderzoek — Homey Backup Center

**Onderzochte repository:** https://github.com/94brwdfyst-coder/Homey-backup-center (package: `nl.dennisweel.flowbackup`, v0.3.28)
**Onderzoeksdatum:** 16 september 2026
**Methode:** volledige lokale clone + `git log --all -p` over de hele geschiedenis, plus onafhankelijke clones van de genoemde externe projecten en directe stringmatching van kenmerkende identifiers.

> **Belangrijke methodologische kanttekening vooraf.** De repository bevat zelf al een `PROVENANCE-REPORT.md`, `CREDITS.md` en een `docs/provenance/`-map met een eerder (kennelijk AI-ondersteund) zelfonderzoek, inclusief een claim dat Sven Serlier op 15-9-2026 mondeling/per screenshot toestemming zou hebben gegeven voor gebruik van zijn GPLv3-code. Dat eerdere rapport is door de repository-eigenaar zelf aangeleverd materiaal, niet onafhankelijk bewijs. Ik heb het **niet** als waarheid overgenomen, maar de onderliggende technische claims zelf opnieuw geverifieerd door de externe repositories apart te clonen en te vergelijken. De toestemmingsclaim van Sven Serlier (screenshot, niet openbaar gemaakt) kan ik niet verifiëren en wordt hieronder expliciet als **onbevestigd** gerapporteerd.

---

## Executive summary

1. **Git-geschiedenis van de onderzochte repo geeft geen diepe provenance.** Alle 30 commits dateren van 15–16 september 2026, één auteur, en bestaan grotendeels uit "rename"-commits van een reeds bestaande bronboom naar de huidige mapstructuur. Dit is functioneel een eenmalige import, geen organisch gegroeide historie. Uitspraken over "wanneer code precies verscheen" binnen déze repo zijn daardoor beperkt bruikbaar; het is niet vast te stellen wanneer de code oorspronkelijk buiten deze repo is geschreven.
2. **Geen LICENSE-bestand aanwezig** in de onderzochte repository zelf (wel `THIRD-PARTY-NOTICES.txt` voor npm-dependencies, en `CREDITS.md`).
3. **Sven Serlier / smarthomesven — `homey-flow-version-history` (GPLv3):** onafhankelijk geclonet en gecontroleerd. Diens kenmerkende identifiers (`flow_revisions_`, `flow_trash`, `initFlowRevisions`, `cleanupTrash`, `onFlowUpdate`, `onFlowDelete`, `purgeRevisions`, `purgeTrash`, `formatFlow`, `initRevision`) komen **nergens** voor in de volledige geschiedenis van de onderzochte repo. Bevindingsniveau: **geen relevante overeenkomst** (categorie A/C — gedeeld is alleen het gebruik van de standaard Homey API `HomeyAPI.createAppAPI`, `flow.getFlows()`/`getAdvancedFlows()`).
4. **Serge Regoor / Dijker — `nl.regoor.flowbackup`:** onafhankelijk geclonet (oorspronkelijke `SergeRegoor/nl.regoor.flowbackup`, SDK1-app uit 2016). **Geen LICENSE-bestand** in die repo. Kenmerkende identifiers (`backUpInfo`, `createFullBackUp`, `readBackUpFile`, `Uint8ToString`, `getFolderPath`, `HomeyBackUp`) komen **nergens** voor in de onderzochte repo. Bevindingsniveau: **geen relevante overeenkomst**.
5. **Mike_Nono community-post** ("Backup Script - All flows and split them", community.homey.app/t/159140) is onafhankelijk teruggevonden en bevestigt het verhaal in `CREDITS.md`: een Gemini-geassisteerd API/split-script, met een expliciete uitnodiging om er een app van te maken. Er is bronvermelding aanwezig in `settings/backup.js` regel 1 en in `CREDITS.md`. Dit forumbericht had geen formele licentie; de auteur nodigde zelf uit tot hergebruik, wat als informele toestemming kan gelden, maar geen substituut is voor een formele licentie.
6. **Geen enkele vondst bereikt het niveau "Mogelijke afleiding" of hoger.** Er is dus geen sectie met gedetailleerde side-by-side codevergelijking nodig — die is per opzet alleen vereist vanaf dat niveau.
7. **Wat wél apart benoemd moet worden:** de onverifieerbare "toestemming van Sven Serlier"-claim in de eigen `CREDITS.md`/`PROVENANCE-REPORT.md`. Technisch is er geen Sven-code gevonden, dus deze toestemming is momenteel niet nodig om te onderbouwen dat het gebruik rechtmatig is — maar de claim zoals nu geformuleerd suggereert een geverifieerd feit terwijl het een onbevestigde, niet-publieke bewering is. Dit is een documentatierisico, geen codeprobleem.

---

## Vergelijkingstabel

| Onze code | Externe bron | Overeenkomst | Eerste externe datum | Eerste interne datum | Licentie | Vereiste | Bij ons aanwezig? | Bewijssterkte |
|---|---|---|---|---|---|---|---|---|
| `app.js` (algehele architectuur, flow-restore-logica) | Sven Serlier — `smarthomesven/homey-flow-version-history` | Beide gebruiken `HomeyAPI.createAppAPI`, `flow.getFlows()`/`getAdvancedFlows()` — standaard Homey SDK-patroon | 21 mrt 2026 (initial commit) | onbekend (buiten deze repo niet vast te stellen; in déze repo 15 sep 2026) | GPLv3 | Bij daadwerkelijke overname: bronvermelding, notices behouden, afgeleide broncode meeleveren (copyleft) | N.v.t. — geen overgenomen code gevonden | **Geen relevante overeenkomst** (generiek SDK-patroon) |
| `settings/backup.js` (backup-/restore­structuur) | Serge Regoor / Dijker — `nl.regoor.flowbackup` | Beide zijn Homey-flow-backup-apps met JSON/zip-export | 22 nov 2016 (v1.0.0) | onbekend | **Geen LICENSE-bestand aanwezig** in bronrepo → standaard "alle rechten voorbehouden" tenzij anders overeengekomen | Bij overname: expliciete toestemming van rechthebbende nodig (geen open licentie aanwezig) | N.v.t. — geen overgenomen code gevonden | **Geen relevante overeenkomst** |
| `settings/backup.js`, algemeen concept | Mike_Nono — Homey Community forumpost (API+split-script) | Erkend concept: flows via API ophalen en splitsen in bestanden/mappen | ± eind aug/begin sep 2026 (forumpost "159140") | onbekend | Geen formele licentie; auteur nodigt expliciet uit tot doorontwikkelen als app | Informele toestemming aanwezig, geen schriftelijke licentie | Ja — vermeld in `CREDITS.md` en `settings/backup.js` regel 1 | **Zwakke overeenkomst / erkend concept, geen codeovername vastgesteld** |
| `settings/download.js` | `FileSaver.js` (Eli Grey, MIT) — dit is een bekende, veelgebruikte losse library, ook aanwezig in Regoor's `settings/FileSaver.js` | Beide projecten gebruiken vermoedelijk dezelfde/vergelijkbare publieke library voor browserdownloads | 2014 (FileSaver.js) | onbekend | MIT | Copyright- en permissienotice behouden | Niet gecontroleerd of `download.js` een aangepaste FileSaver.js-variant is — **aanbevolen vervolgstap**, zie hieronder | **Nader te controleren** (niet als "Mogelijke afleiding" geclassificeerd zonder directe inspectie) |

---

## Toelichting per bron

### 1. Sven Serlier / smarthomesven (`homey-flow-version-history`, GPLv3)
- Onafhankelijk geclonet vanaf de publieke GitHub-repo; bevat een volledige, standaard GPLv3-licentietekst (FSF, versie 3, 29 juni 2007), geen projectspecifieke uitzonderingen.
- Kenmerkende, niet-triviale identifiers uit `app.js` (`flow_revisions_`, `flow_trash`, `initFlowRevisions`, `cleanupTrash`, `onFlowUpdate`, `onFlowDelete`, `purgeRevisions`, `purgeTrash`, `formatFlow`, `initRevision`) zijn met `git log --all -p | grep` doorzocht over de **volledige** geschiedenis van de onderzochte repository. Nul treffers in daadwerkelijke code — de enige treffers zijn in het (zelfgeschreven) `PROVENANCE-REPORT.md`, waar deze termen juist genoemd worden als *afwezig*.
- Conclusie: categorie **C** (vergelijkbare functionaliteit, onafhankelijk plausibel geïmplementeerd via dezelfde Homey SDK), niet D of E.
- De in `CREDITS.md`/`PROVENANCE-REPORT.md` genoemde "toestemming van Sven Serlier via screenshot, 15 september 2026" is door mij **niet te verifiëren** — geen publiek bewijs, geen bijgevoegd bestand in deze repo-clone. Aangezien er sowieso geen Sven-code is gevonden, is deze toestemming momenteel niet nodig als juridische onderbouwing. Aanbeveling: de claim in de documentatie herformuleren als "gemelde, niet-geverifieerde toestemming" in plaats van als vaststaand feit, of het bewijs (screenshot) daadwerkelijk archiveren met datum/hash.

### 2. Serge Regoor / Dijker (`nl.regoor.flowbackup`)
- Onafhankelijk geclonet vanaf `github.com/SergeRegoor/nl.regoor.flowbackup` (de `Dijker`-fork die in de opdracht en in het forum wordt genoemd was niet bereikbaar in deze sessie; de oorspronkelijke SergeRegoor-repo wel).
- **Geen LICENSE-bestand** in deze repo. Dit is een project uit 2016 met alleen een `README.md`; zonder expliciete licentie geldt in beginsel "alle rechten voorbehouden" — publieke zichtbaarheid op GitHub is geen vrijgave.
- Kenmerkende identifiers uit de kernklassen (`backUpInfo.json`, `createFullBackUp`, `readBackUpFile`, `Uint8ToString`, `getFolderPath`, klassenaam `HomeyBackUp`) zijn gezocht over de volledige geschiedenis van de onderzochte repo: **nul treffers**.
- Conclusie: **geen relevante overeenkomst** vastgesteld.

### 3. Mike_Nono — Homey Community forumpost
- Onafhankelijk teruggevonden op `community.homey.app/t/backup-script-all-flows-and-split-them/159140`. Beschrijft een Gemini-geassisteerd script dat via de API-playground alle flows ophaalt en met een lokaal Python-script in standaard/advanced-mappen splitst.
- Dit is precies het verhaal dat `CREDITS.md` vertelt, en de bronvermelding is aanwezig in code (`settings/backup.js:1`) en documentatie.
- Er is geen formele licentie aan dit forumbericht verbonden; de auteur nodigt zelf uit om er een app van te maken, wat redelijkerwijs als informele toestemming voor dat specifieke gebruik gezien kan worden — dit is echter geen vervanging voor een schriftelijke licentie en biedt in een geschil minder zekerheid.

### 4. FileSaver.js / `settings/download.js`
- Dit is een generieke, veelgebruikte MIT-library (Eli Grey) die in tientallen Homey- en andere JS-projecten voorkomt, ook letterlijk als los bestand in Regoor's repo.
- Ik heb **niet** regel-voor-regel gecontroleerd of `settings/download.js` in de onderzochte repo een (aangepaste) kopie van deze specifieke library is, of een eigen implementatie. Dit is de enige openstaande technische vervolgvraag uit dit onderzoek.

---

## Feit versus juridische interpretatie

**Feitelijke constatering:** met stringmatching op kenmerkende, niet-triviale identifiers over de volledige git-geschiedenis van de onderzochte repository zijn geen treffers gevonden voor de kenmerkende code van Sven Serlier (GPLv3) of Serge Regoor/Dijker. De enige erkende concept-overname (Mike_Nono) is gedocumenteerd en van bronvermelding voorzien.

**Juridische interpretatie (geen juridisch advies):** afwezigheid van tekstuele/structurele overeenkomst in de huidige en historische broncode van déze repo is een sterke aanwijzing tegen auteursrechtelijke ontlening, maar sluit niet met zekerheid uit dat elders (buiten deze repo, bijvoorbeeld in eerdere niet-gecommitte bestanden) code is bekeken of gebruikt als inspiratie zonder dat dit in identifiers terug te zien is. Een statische vergelijking kan dat niet uitsluiten.

---

## Eindresultaat

1. **Externe projecten met daadwerkelijk relevante overeenkomsten:** geen. Sven Serlier (GPLv3) en Regoor/Dijker vertonen geen aantoonbare code-overname; Mike_Nono's concept is erkend en van bronvermelding voorzien.
2. **Waarschijnlijk generieke overeenkomsten:** het gebruik van `HomeyAPI.createAppAPI`, `flow.getFlows()/getAdvancedFlows()` en vergelijkbare JSON/zip-backupstructuren — dit volgt uit de gedeelde Homey SDK en de aard van de taak (flows backuppen), niet uit overname.
3. **Onderdelen die nader bekeken moeten worden:**
   - `settings/download.js` versus FileSaver.js (technische vervolgcontrole, geen juridische kwestie op zich, tenzij blijkt dat het een aangepaste MIT-library is zonder de vereiste copyright/permissienotice).
   - De onverifieerbare "toestemming van Sven Serlier"-claim in `CREDITS.md`/`PROVENANCE-REPORT.md` — nu geen probleem omdat er geen Sven-code is gevonden, maar de claim moet niet als vaststaand feit gepresenteerd blijven zonder controleerbaar bewijs.
4. **Aanbevolen concrete wijzigingen aan de repository:**
   - Voeg een expliciet `LICENSE`-bestand toe voor de hoofdcode (er is momenteel geen enkele hoofdlicentie in de repo, alleen third-party notices voor dependencies).
   - Herformuleer de Sven-toestemmingspassages in `CREDITS.md`/`PROVENANCE-REPORT.md` van "bevestigd" naar "gemeld, niet onafhankelijk geverifieerd", of archiveer het bewijs (screenshot + hash + datum) apart en verwijs daarnaar.
   - Controleer en documenteer expliciet of `settings/download.js` een eigen implementatie is of een aangepaste FileSaver.js-kopie; voeg zo nodig de MIT-notice toe.
5. **Auteurs die eventueel om toestemming gevraagd zouden moeten worden:** geen, op basis van de huidige technische bevindingen — er is geen code van Sven Serlier of Regoor/Dijker aangetroffen. Mike_Nono is al erkend en om diens materiaal is al (informeel) toestemming/uitnodiging aanwezig.
6. **Code die beter onafhankelijk herschreven kan worden:** niet nodig op basis van dit onderzoek. Mocht bij nadere inspectie blijken dat `settings/download.js` toch een bewerkte FileSaver.js-kopie is zonder correcte MIT-notice, dan is de minst ingrijpende oplossing het toevoegen van de ontbrekende notice — niet herschrijven, aangezien FileSaver.js dat expliciet toestaat onder MIT.

**Geen code is tijdens dit onderzoek gewijzigd, verwijderd, gecommit of gepusht.**
