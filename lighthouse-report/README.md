# Lighthouse Accessibility — Belege (R6)

Gemessen am 2026-08-20 auf Branch `arena/01a02021-camp` gegen den
frisch gebauten Static-Export (`npm run build`, dann
`python3 -m http.server` im `out/`-Verzeichnis).

## Ergebnisse

| Profil | URL | Score |
|---|---|---|
| Mobile, 375×667, DPR=2 | `/elektrik-planung/` | **Accessibility 100** |
| Desktop, 1366×768 | `/elektrik-planung/` | **Accessibility 100** |

## Dateien

- `elektrik-planung-mobile.report.html` / `.json`
- `elektrik-planung-desktop.report.html` / `.json`

Die HTML-Reports können direkt im Browser geöffnet werden und enthalten
neben dem Score auch alle Audit-Details.

## Reproduktion

```bash
# 1. Static-Export bauen
npm install
npm run build

# 2. Statischen Server starten (nicht next dev!)
cd out
python3 -m http.server 4173 &
SERVER_PID=$!

# 3. Lighthouse (Chrome/Chromium >= 127 muss im PATH sein)
npx --yes lighthouse@13 \
  http://127.0.0.1:4173/elektrik-planung/ \
  --only-categories=accessibility \
  --form-factor=mobile \
  --screenEmulation.mobile=true \
  --screenEmulation.width=375 \
  --screenEmulation.height=667 \
  --screenEmulation.deviceScaleFactor=2 \
  --chrome-flags="--headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage" \
  --output=html --output=json \
  --output-path=./lighthouse-report/elektrik-planung-mobile

kill $SERVER_PID
```

## Hinweis zur Messung in dieser Agent-Umgebung

Ein direkter Chrome-Download war im Sandbox-Netzwerk gesperrt.
Stattdessen wurde das npm-Paket `@sparticuz/chromium` (mit `--no-save`,
also **nicht** in `package.json` übernommen) verwendet; dessen
`bin/chromium.br` wurde per Brotli dekomprimiert und zusammen mit den
mitgelieferten `al2023.tar.br`-NSS-Libraries gestartet:

```bash
node -e "require('fs').createReadStream('node_modules/@sparticuz/chromium/bin/chromium.br')
  .pipe(require('zlib').createBrotliDecompress())
  .pipe(require('fs').createWriteStream('/tmp/chromium'))"
chmod +x /tmp/chromium
# AL2023-Libraries nach /tmp/chromium-extras/lib entpacken …
export LD_LIBRARY_PATH=/tmp/chromium-extras/lib:$LD_LIBRARY_PATH
export CHROME_PATH=/tmp/chromium
# dann lighthouse wie oben
```

Auf einem normalen Entwicklerrechner oder CI-Runner mit installiertem
Chrome/Chromium entfällt dieser Schritt.
