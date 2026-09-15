#!/bin/zsh
cd -- "${0:A:h}" || exit 1
finish() { printf '\nDruk op Enter om dit venster te sluiten.'; read -r reply; }
echo "Homey Backupcentrum installeren op je Homey Self-Hosted Server"
if ! command -v homey >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
    echo "Homey CLI of Node.js ontbreekt. Vraag hulp bij de installatie."
    finish; exit 1
fi
echo "De app wordt toegevoegd; bestaande flows worden niet gewijzigd."
printf 'Typ INSTALLEREN om door te gaan: '
read -r answer
if [[ "$answer" != "INSTALLEREN" ]]; then echo "Geannuleerd."; finish; exit 0; fi
npm ci --ignore-scripts --no-audit --no-fund || { finish; exit 1; }
homey whoami || homey login || { finish; exit 1; }
echo "Selecteer hieronder je Self-Hosted Server."
homey select || { finish; exit 1; }
homey app install || { finish; exit 1; }
echo "Installatie afgerond. Open Homey Backupcentrum bij je Homey-apps en kies Instellingen."
finish
