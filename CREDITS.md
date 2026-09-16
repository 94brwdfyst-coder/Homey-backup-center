# Credits, bronnen en teststatus

## Credits

- **Dennis Weel** — ontwikkeling, integratie en praktijktests van Homey Backupcentrum.
- **Mike_Nono (Homey Community)** — oorspronkelijke flow-back-up- en splitscripts waarop het project is voortgebouwd. Zijn communitypost vroeg expliciet om hiervan een app te maken. Dit betekent niet dat hij verantwoordelijk is voor latere wijzigingen of deze bèta ondersteunt.
- **Mike1233 (Homey Community)** — wees vroeg op het risico dat flows met dezelfde naam elkaar konden overschrijven; dit hielp de unieke exportstructuur aanscherpen.
- **SingKT (Homey Community)** — deelde praktijktests rond flowrestore, parsing en broken flows in de oorspronkelijke communitydiscussie.
- Ontwikkeling is ondersteund met **OpenAI ChatGPT/Codex** voor code-analyse, implementatie en documentatie.

## Sven Serlier / smarthomesven

- **Sven Serlier / smarthomesven** — eigenaar van de publieke [Flow Version History-repository](https://github.com/smarthomesven/homey-flow-version-history). Op 15 september 2026 gaf hij schriftelijk toestemming om zijn open-source app/code te gebruiken. Deze toestemming is provenance-context; de bronvergelijking vond geen exacte of near-verbatim Sven-code in Backup Center en deze vermelding claimt dus geen auteurschap van zijn werk.

### Toestemming van Sven Serlier / smarthomesven

Op 15 september 2026 bevestigde Sven Serlier in een rechtstreeks bericht dat zijn Flow Version History-app open source is en dat de code door iedereen gebruikt mag worden. De projecteigenaar leverde deze bevestiging als schermafbeelding aan; de tekstuele vastlegging wordt als provenance-context bewaard. De publieke repository bevat daarnaast Svens eigen GPLv3 LICENSE; toestemming en licentie worden samen gelezen. Als later alsnog Sven-code wordt vastgesteld, blijven GPLv3-verplichtingen en correcte notices leidend.

## Sven Serlier / smarthomesven (English)

- **Sven Serlier / smarthomesven** — owner of the public [Flow Version History repository](https://github.com/smarthomesven/homey-flow-version-history). On 15 September 2026 he gave written permission to use his open-source app/code. This is provenance context; the source comparison found no exact or near-verbatim Sven code in Backup Center, so this entry does not claim authorship of his work.

### Permission from Sven Serlier / smarthomesven

On 15 September 2026, Sven Serlier confirmed in a direct message that his Flow Version History app is open source and that everyone may use the code. The project owner supplied the confirmation as a screenshot; this textual record is retained as provenance context. The public repository also contains Sven's own GPLv3 LICENSE; permission and license are read together. If Sven code is later identified, the GPLv3 obligations and required notices remain controlling.

## Mogelijk vergeten codebijdragers

Als iemand code heeft bijgedragen die in Homey Backupcentrum is gebruikt en hier onbedoeld niet wordt genoemd, meld dat dan bij het project met de relevante commit, bestanden of andere herleidbare informatie. Na verificatie voegen we correcte naam, copyright- en licentie-informatie en passende credits toe. We claimen andermans werk niet als eigen werk.

Testers, bugmelders en mensen die feedback of voorbeelden deelden worden afzonderlijk als test- of feedbackbijdragers vermeld. Dat betekent op zichzelf geen auteurschap van code.

## Potentially omitted code contributors

If you contributed code that is used in Backup Center and you are unintentionally missing from this file, please contact the project with the relevant commit, files, or other traceable information. After verification, we will add accurate name, copyright and license information, and appropriate credits. We do not claim another person's work as our own.

Testers, bug reporters, and people who shared feedback or examples are listed separately as testing or feedback contributors. That does not by itself mean they authored code.

## Bronnen

- Homey Community — *Backup Script - All flows and split them*: https://community.homey.app/t/backup-script-all-flows-and-split-them/159140
- Officiële Homey Apps SDK-documentatie: https://apps.developer.homey.app/
- Officiële Homey Web API-documentatie: https://athombv.github.io/node-homey-api/

## Zelf praktisch getest vóór Beta 1

Op de gebruikte Homey-installatie zijn end-to-end getest en daarna opnieuw uitgelezen/gecontroleerd:

- Logic-variabele herstellen.
- Apparaatnaam herstellen.
- Apparaat naar oorspronkelijke zone herstellen.
- Schrijfbare apparaatinstelling herstellen (Shelly `beacon_timeout`, 6 → 5).
- Standard Flow herstellen/aanmaken.
- Advanced Flow herstellen/aanmaken en wijzigen.
- Selectieve restore: alleen aangevinkte wijzigingen worden uitgevoerd.
- Verse v4-back-up direct vergelijken met de ongewijzigde Homey: **0 verschillen**.

Dit is geen garantie dat iedere Homey, app of apparaatinstelling hetzelfde gedrag heeft. Daarom is dit een publieke bèta.

## Bekende grens

Backupcentrum is geen volledige Homey-systeemimage. Radio-pairings en app-specifieke/private interne data kunnen niet betrouwbaar door deze configuratierestore worden gereconstrueerd. Gebruik voor een volledige systeemrestore Homey's officiële herstelmogelijkheden.
