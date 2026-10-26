import { LadeboosterVergleichBehavior } from './LadeboosterVergleichBehavior';

export function LadeboosterVergleich() {
  return (
    <section id="vergleich" aria-labelledby="vergleich-titel" className="lb-compare scroll-mt-20">
      <div className="space-y-10">
        <header className="lb-intro">
          <p className="lb-eyebrow">Vergleich // 30 bis 120 A</p>
          <h2 id="vergleich-titel" className="mt-2 font-display text-xl font-semibold text-ink">
            Ladebooster im Vergleich: 30, 60 oder 90 A?
          </h2>
          <div className="mt-3 space-y-3 text-md leading-relaxed text-ink-soft">
            <p>
              30 A, 60 A, 90 A oder zwei Geräte parallel? Die Amperezahl ist nur die halbe Entscheidung. Die
              andere Hälfte ist die Frage, ob deine Lichtmaschine den Eingangsstrom dauerhaft liefert, ob dein
              Fahrzeug ein D+-Signal hat und ob du bereit bist, die Leitungen neu zu dimensionieren.
            </p>
            <p>
              Ich habe meinen eigenen Ausbau von 30 A auf 90 A umgestellt und dabei sieben Konzepte
              verglichen. Dieser Abschnitt ist keine Kaufberatung und keine Messreihe. Er ist meine Rechnung —
              mit Herstellerdaten, Preis-Momentaufnahmen und dem, was in Foren tatsächlich berichtet wird. Die
              Geräte habe ich nicht alle selbst getestet; ich fahre den Votronic. Wo die Datenlage dünn ist,
              steht das dabei.
            </p>
          </div>
          <nav className="lb-anchor-nav mt-5" aria-label="Im Vergleich springen">
            <a href="#vergleich-kurz">Kurzentscheidung</a>
            <a href="#vergleich-konzepte">Konzepte</a>
            <a href="#vergleich-geraete">Geräte</a>
            <a href="#vergleich-foren">Forenwissen</a>
            <a href="#vergleich-rechnung">Meine Rechnung</a>
            <a href="#vergleich-rechner">Rechner</a>
            <a href="#vergleich-quellen">Quellen</a>
          </nav>
        </header>

        <section id="vergleich-kurz" aria-labelledby="vergleich-kurz-titel" className="scroll-mt-20">
          <h3 id="vergleich-kurz-titel">Die Kurzentscheidung</h3>
          <div className="lb-verdict-grid mt-4">
            <article className="lb-verdict">
              <span className="lb-verdict__index">01 // Einstieg</span>
              <span className="lb-verdict__amp">30 A</span>
              <p>
                <strong>Für 100–200 Ah, kurze Fahrten, Solar als Stütze.</strong> Zuverlässig, günstig und für
                viele Ausbauten völlig ausreichend.
              </p>
              <p className="lb-verdict__limit">
                Grenze: Bei 330 Ah sind 30 A nur 0,09 C. Für Induktion und kurze Etappen zu wenig.
              </p>
            </article>
            <article className="lb-verdict">
              <span className="lb-verdict__index">02 // Sweet Spot</span>
              <span className="lb-verdict__amp">60–70 A</span>
              <p>
                <strong>Für 200–400 Ah ohne großen Wechselrichter.</strong> Kühlschrank, Licht, Laptop,
                Kaffeemaschine — dafür ist diese Klasse gebaut.
              </p>
              <p className="lb-verdict__limit">
                Grenze: 60 A sind an 330 Ah 0,18 C. Im Winter mit Induktion fehlt die Reserve.
              </p>
            </article>
            <article className="lb-verdict">
              <span className="lb-verdict__index">03 // Mein Setup</span>
              <span className="lb-verdict__amp">90 A</span>
              <p>
                <strong>Für 300–600 Ah und hohe Verbraucher.</strong> Ein Gerät, ein Kabelweg, 0–75 A
                drosselbar. Genau die Reserve, die ich wollte.
              </p>
              <p className="lb-verdict__limit">
                Grenze: 25/35 mm², Luft für den Lüfter und ein sauberer D+-Anschluss sind Pflicht.
              </p>
            </article>
            <article className="lb-verdict">
              <span className="lb-verdict__index">04 // Große Bänke</span>
              <span className="lb-verdict__amp">100–120 A</span>
              <p>
                <strong>Für Expeditionsmobile, 24-V-Systeme und große Lithium-Bänke.</strong> Sterling BB12120
                oder Victron Buck-Boost 100 A.
              </p>
              <p className="lb-verdict__limit">
                Grenze: teuer, aufwendig, und die Lichtmaschine muss die Eingangsleistung wirklich liefern.
              </p>
            </article>
          </div>
        </section>

        <section id="vergleich-konzepte" aria-labelledby="vergleich-konzepte-titel" className="scroll-mt-20">
          <h3 id="vergleich-konzepte-titel">Sieben Wege zum höheren Ladestrom</h3>
          <div className="prose-measure mt-3 space-y-3 text-md leading-relaxed text-ink-soft">
            <p>
              Die Wege unterscheiden sich nicht nur im Ladestrom. Sie unterscheiden sich darin, wie viel
              Verkabelung, Abstimmung und Reserve sie mitbringen. Die Preise sind Straßenpreise oder
              Herstellerpreise, Stand 23.10.2026, inklusive MwSt. Es sind Momentaufnahmen, keine Live-Preise.
            </p>
          </div>
          <div className="lb-ladder mt-4">
            <article className="lb-step">
              <span className="lb-step__num">30 A</span>
              <div className="lb-step__body">
                <h4>Ein Gerät, eine Zuleitung</h4>
                <p>
                  Victron Orion-Tr Smart 12/12-30, Schaudt WA 121525, ECTIVE BB30 oder Votronic VCC 1212-30.
                  Der Orion ist der flexibelste Einstieg: Bluetooth, kein D+ nötig, parallel schaltbar. Seine
                  Klemmen enden bei 16 mm².
                </p>
              </div>
              <div className="lb-step__meta">
                <strong>ab ca. 150 €</strong>geringer Aufwand
              </div>
            </article>
            <article className="lb-step">
              <span className="lb-step__num">2 × 30 A</span>
              <div className="lb-step__body">
                <h4>Zwei Orion parallel</h4>
                <p>
                  Victron erlaubt den Parallelbetrieb ausdrücklich. In der Praxis verteilt sich die Last aber
                  nicht von selbst. Gleiche Leitungslängen, ein gemeinsamer Abgreifpunkt und eine stillgelegte
                  EBL-Ladung sind Pflicht; die Lichtmaschine muss den doppelten Eingangsstrom tragen.
                </p>
              </div>
              <div className="lb-step__meta">
                <strong>ca. 300–450 €</strong>plus Kabel und Sicherungen
              </div>
            </article>
            <article className="lb-step">
              <span className="lb-step__num">60 A</span>
              <div className="lb-step__body">
                <h4>Ein Gerät mit 60 A</h4>
                <p>
                  Der ECTIVE BB 60 ist der Preis-Leistungs-Kandidat: 90–560 Ah, D+, vier LiFePO4-Spannungen,
                  ECE R10. Für 200–400 Ah ohne großen Wechselrichter eine runde Sache. Darüber fehlt die
                  Reserve.
                </p>
              </div>
              <div className="lb-step__meta">
                <strong>260–292 €</strong>mittlerer Aufwand
              </div>
            </article>
            <article className="lb-step">
              <span className="lb-step__num">45–70 A</span>
              <div className="lb-step__body">
                <h4>Einstellbar statt gestückelt</h4>
                <p>
                  Der Schaudt WA 121545 kann 45, 55, 63 oder 70 A. 80–700 Ah, 93 % Wirkungsgrad,
                  Temperaturfühler im Lieferumfang. Lithium lädt er mit festen 14,4 V. Das ist sicher, aber
                  weniger flexibel als 13,9–14,6 V.
                </p>
              </div>
              <div className="lb-step__meta">
                <strong>575 €</strong>OEM-nah, teuer pro Ampere
              </div>
            </article>
            <article className="lb-step">
              <span className="lb-step__num">90 A</span>
              <div className="lb-step__body">
                <h4>Ein Gerät mit Reserve</h4>
                <p>
                  Der Votronic VCC 1212-90 liefert 90 A, lässt sich auf 75 A drosseln und deckt 150–600 Ah ab.
                  Vier LiFePO4-Programme, Temperaturfühler im Lieferumfang, D+ oder Spannungserkennung.
                  Braucht 25/35 mm² und Luft.
                </p>
              </div>
              <div className="lb-step__meta">
                <strong>500–555 €</strong>mein Kaufpreis: 380 €
              </div>
            </article>
            <article className="lb-step">
              <span className="lb-step__num">100–120 A</span>
              <div className="lb-step__body">
                <h4>Die große Lösung</h4>
                <p>
                  Sterling Saturn BB12120 oder Victron Buck-Boost 100 A. Der Sterling nennt 120 A und 1.620 W;
                  im Handbuch stehen 110 A bei 14,41 V. Der Buck-Boost ist programmierbar und für gewachsene
                  Victron-Systeme gedacht. Beide verlangen dicke Kabel und eine starke Lichtmaschine.
                </p>
              </div>
              <div className="lb-step__meta">
                <strong>711–795 €</strong>hoher Aufwand
              </div>
            </article>
            <article className="lb-step">
              <span className="lb-step__num">Kombi</span>
              <div className="lb-step__body">
                <h4>Ladegerät und Booster in einem Gehäuse</h4>
                <p>
                  Büttner MT BCB (20–60 A Booster plus 230-V-Lader) oder Renogy DC/DC mit MPPT (50 A gesamt).
                  Platzsparend und aufgeräumt, aber mit eigenen Grenzen: Büttner endet bei 60 A, Renogy teilt
                  die 50 A zwischen Solar und Lichtmaschine auf.
                </p>
              </div>
              <div className="lb-step__meta">
                <strong>169–1.289 €</strong>je nach Funktion
              </div>
            </article>
          </div>
        </section>

        <section id="vergleich-geraete" aria-labelledby="vergleich-geraete-titel" className="scroll-mt-20">
          <h3 id="vergleich-geraete-titel">Die Geräte im Detail</h3>
          <div className="prose-measure mt-3 space-y-3 text-md leading-relaxed text-ink-soft">
            <p>
              Die Tabelle ist der schnelle Überblick. Die Karten darunter erklären die vier Geräte, die für
              mein Setup wirklich in Frage kamen. Weitere Konzepte folgen kompakt. Alle Preise sind inklusive
              MwSt. und ohne Anspruch auf Vollständigkeit.
            </p>
          </div>

          <div className="lb-table-wrap mt-4" role="group" aria-label="Tabelle: Geräteüberblick" tabIndex={0}>
            <table>
              <caption>
                Geräteüberblick, Preisstand 23.10.2026. Auf dem Handy seitlich scrollbar; die Karten unten
                erklären die Details.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Gerät</th>
                  <th scope="col">Ladestrom</th>
                  <th scope="col">D+</th>
                  <th scope="col">Preis ab</th>
                  <th scope="col">Was auffällt</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Victron Orion-Tr Smart 12/12-30</td>
                  <td>30 A</td>
                  <td>nein</td>
                  <td>ca. 150 €</td>
                  <td>16-mm²-Grenze; parallel möglich, Lastverteilung ungleich</td>
                </tr>
                <tr>
                  <td>ECTIVE BB 60</td>
                  <td>60 A</td>
                  <td>ja</td>
                  <td>ca. 260 €</td>
                  <td>90–560 Ah; vier LiFePO4-Spannungen; ECE R10</td>
                </tr>
                <tr>
                  <td>Schaudt WA 121545</td>
                  <td>45–70 A</td>
                  <td>ja</td>
                  <td>575 €</td>
                  <td>80–700 Ah; Lithium fest 14,4 V; teuer pro Ampere</td>
                </tr>
                <tr>
                  <td>Votronic VCC 1212-90</td>
                  <td>90 A</td>
                  <td>optional</td>
                  <td>ca. 501 €</td>
                  <td>150–600 Ah; 0–75 A drosselbar; 25/35 mm²</td>
                </tr>
                <tr>
                  <td>Sterling Saturn BB12120</td>
                  <td>110–120 A</td>
                  <td>nein</td>
                  <td>ca. 711 €</td>
                  <td>35 mm²/150 A; Herstellerangaben nicht konsistent</td>
                </tr>
                <tr>
                  <td>Renogy 50 A DC/DC mit MPPT</td>
                  <td>50 A gesamt</td>
                  <td>IGN</td>
                  <td>ca. 169 €</td>
                  <td>25 A je Quelle im Hybridbetrieb; 11,5-V-Schwelle</td>
                </tr>
                <tr>
                  <td>Büttner MT BCB</td>
                  <td>20–60 A + 230 V</td>
                  <td>ja</td>
                  <td>ca. 702 €</td>
                  <td>3-in-1; EBL-Einschränkung; kein 90-A-Modell</td>
                </tr>
                <tr>
                  <td>Victron Buck-Boost 100 A</td>
                  <td>100 A</td>
                  <td>programmierbar</td>
                  <td>ca. 795 €</td>
                  <td>für Victron-Systeme; sonst überdimensioniert</td>
                </tr>
                <tr>
                  <td>Ungebrandeter Import</td>
                  <td>110–120 A (angeblich)</td>
                  <td>je nach Gerät</td>
                  <td>ca. 180 € (beobachtet)</td>
                  <td>keine Prüfbarkeit, kein Support, keine Gewährleistung</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="lb-table-note">
            Die Tabelle bewertet keine Geräte mit Sternen. Sie nennt Daten, Preise und die Punkte, an denen
            ich hängen geblieben bin. Für die Preise gilt: Händlerpreise schwanken, Aktionen sind
            eingerechnet, UVP ist nicht gleich Straßenpreis.
          </p>

          <div className="lb-device-tools mt-6">
            <div className="lb-filter" role="group" aria-label="Geräte nach Klasse filtern">
              <button type="button" data-lb-filter="all" aria-pressed="true">
                Alle
              </button>
              <button type="button" data-lb-filter="30" aria-pressed="false">
                30 A
              </button>
              <button type="button" data-lb-filter="60" aria-pressed="false">
                60–70 A
              </button>
              <button type="button" data-lb-filter="90" aria-pressed="false">
                90 A+
              </button>
            </div>
            <span className="caption-xs text-ink-soft">Filter zeigt nur die Karten, nicht die Tabelle.</span>
          </div>

          <div className="lb-device-grid">
            <article className="lb-device" data-lb-class="30">
              <div className="lb-device__head">
                <div>
                  <p className="lb-device__brand">Victron Energy</p>
                  <h4>Orion-Tr Smart 12/12-30</h4>
                </div>
                <span className="lb-pill">30 A</span>
              </div>
              <dl className="lb-specs">
                <div>
                  <dt>Ladestrom</dt>
                  <dd>30 A bei 40 °C</dd>
                </div>
                <div>
                  <dt>Spitze</dt>
                  <dd>40 A / 10 s</dd>
                </div>
                <div>
                  <dt>Leistung</dt>
                  <dd>430 W / 360 W</dd>
                </div>
                <div>
                  <dt>Wirkungsgrad</dt>
                  <dd>87 %</dd>
                </div>
                <div>
                  <dt>Kabel</dt>
                  <dd>max. 16 mm²</dd>
                </div>
                <div>
                  <dt>Maße / Gewicht</dt>
                  <dd>130 × 186 × 70 mm / 1,8 kg</dd>
                </div>
                <div>
                  <dt>Steuerung</dt>
                  <dd>Spannungserkennung, kein D+</dd>
                </div>
                <div>
                  <dt>Preis</dt>
                  <dd>ab ca. 150 €</dd>
                </div>
              </dl>
              <p className="lb-device__copy">
                Der kleinste sinnvolle Einstieg. Kompakt, per Bluetooth konfigurierbar und ohne D+
                nachrüstbar. Für 100–200 Ah und kurze Fahrten eine saubere Lösung. Bei 330 Ah und Induktion
                ist er mit 0,09 C überfordert.
              </p>
              <p className="lb-device__note">
                Die 16-mm²-Klemmen sind die harte Grenze. Wer 60 A will, braucht zwei Geräte, zwei Zuleitungen
                und zwei Sicherungen — nicht einfach ein dickeres Kabel.
              </p>
              <div className="lb-device__links">
                <a href="https://www.victronenergy.de/upload/documents/Datasheet-Orion-Tr-Smart-DC-DC-chargers-non-isolated-360-400W-DE.pdf">
                  Datenblatt
                </a>
                <a href="https://communityarchive.victronenergy.com/questions/78315/warum-arbeitet-nur-eins-der-beiden-parallel-gescha.html">
                  Forum: Parallelbetrieb
                </a>
              </div>
            </article>

            <article className="lb-device" data-lb-class="60">
              <div className="lb-device__head">
                <div>
                  <p className="lb-device__brand">ECTIVE</p>
                  <h4>BB 60</h4>
                </div>
                <span className="lb-pill lb-pill--accent">60 A</span>
              </div>
              <dl className="lb-specs">
                <div>
                  <dt>Ladestrom</dt>
                  <dd>60 A</dd>
                </div>
                <div>
                  <dt>LiFePO4</dt>
                  <dd>90–560 Ah</dd>
                </div>
                <div>
                  <dt>Starter</dt>
                  <dd>min. 100 Ah</dd>
                </div>
                <div>
                  <dt>D+</dt>
                  <dd>8–16 V, erforderlich</dd>
                </div>
                <div>
                  <dt>Ladespannungen</dt>
                  <dd>13,9 / 14,2 / 14,4 / 14,6 V</dd>
                </div>
                <div>
                  <dt>Maße / Gewicht</dt>
                  <dd>215 × 190 × 70 mm / 1,6–1,7 kg</dd>
                </div>
                <div>
                  <dt>Zulassung</dt>
                  <dd>ECE R10</dd>
                </div>
                <div>
                  <dt>Preis</dt>
                  <dd>292 €, ab ca. 260 €</dd>
                </div>
              </dl>
              <p className="lb-device__copy">
                Der Preis-Leistungs-Kandidat. 60 A an 330 Ah sind 0,18 C; für ein Setup ohne großen
                Wechselrichter reicht das. Vier LiFePO4-Spannungen, D+ und eine solide Ausstattung zu einem
                Preis, der nicht nach Experiment aussieht.
              </p>
              <p className="lb-device__note">
                D+ muss vorhanden sein oder über einen Simulator kommen. Die Produkthistorie ist jünger als
                bei Schaudt oder Votronic — das ist kein Qualitätsurteil, sondern eine Datenlage.
              </p>
              <div className="lb-device__links">
                <a href="https://www.ective.de/ladetechnik/ladebooster/bb-60-12v-auf-12v-ladebooster-60a">
                  Herstellerseite
                </a>
                <a href="https://www.ective.de/mediafiles/Datenblatt/ective/ladebooster/ECTIVE-BB%2BSBB-Bedienungsanleitung-DE-2026-02-27.pdf">
                  Handbuch
                </a>
              </div>
            </article>

            <article className="lb-device" data-lb-class="60">
              <div className="lb-device__head">
                <div>
                  <p className="lb-device__brand">Schaudt / Lippert</p>
                  <h4>WA 121545</h4>
                </div>
                <span className="lb-pill">45–70 A</span>
              </div>
              <dl className="lb-specs">
                <div>
                  <dt>Ladestrom</dt>
                  <dd>45 / 55 / 63 / 70 A</dd>
                </div>
                <div>
                  <dt>Batterie</dt>
                  <dd>80–700 Ah</dd>
                </div>
                <div>
                  <dt>Eingang</dt>
                  <dd>12–15 V</dd>
                </div>
                <div>
                  <dt>Wirkungsgrad</dt>
                  <dd>93 %</dd>
                </div>
                <div>
                  <dt>Lithium</dt>
                  <dd>14,4 V konstant</dd>
                </div>
                <div>
                  <dt>D+</dt>
                  <dd>bei Euro 6 erforderlich</dd>
                </div>
                <div>
                  <dt>Maße / Gewicht</dt>
                  <dd>160 × 79 × 160 mm / 1,15 kg</dd>
                </div>
                <div>
                  <dt>Preis</dt>
                  <dd>575 €</dd>
                </div>
              </dl>
              <p className="lb-device__copy">
                OEM-Qualität, in vielen Reisemobilen ab Werk. 70 A an 330 Ah sind 0,21 C. Wer mit 14,4 V
                konstant leben kann, bekommt ein solides Gerät mit Temperaturfühler und klarer D+-Steuerung.
              </p>
              <p className="lb-device__note">
                Wer 14,6 V für seine Zellen braucht, ist hier falsch. Preis pro Ampere: rund 8,20 € bei 70 A —
                deutlich über dem Votronic.
              </p>
              <div className="lb-device__links">
                <a href="https://www.ivt-hirschau.de/media/products/920000_Bedienungsanleitung_Ladebooster-SCHAUDT-WA121545.pdf">
                  Handbuch
                </a>
                <a href="https://www.ivt-hirschau.de/de/Ladebooster-SCHAUDT-WA-121545-inkl-Anschluss-und-Temperaturfuehler-Set::1217.html">
                  Preis / Händler
                </a>
              </div>
            </article>

            <article className="lb-device" data-lb-class="90">
              <div className="lb-device__head">
                <div>
                  <p className="lb-device__brand">Votronic</p>
                  <h4>VCC 1212-90</h4>
                </div>
                <span className="lb-pill lb-pill--accent">90 A</span>
              </div>
              <dl className="lb-specs">
                <div>
                  <dt>Ladestrom</dt>
                  <dd>90 A, drosselbar auf 75 A</dd>
                </div>
                <div>
                  <dt>Eingang</dt>
                  <dd>1.350 W, max. 125 A</dd>
                </div>
                <div>
                  <dt>Batterie</dt>
                  <dd>150–600 Ah (optional 800)</dd>
                </div>
                <div>
                  <dt>LiFePO4</dt>
                  <dd>13,9 / 14,2 / 14,4 / 14,6 V</dd>
                </div>
                <div>
                  <dt>Temperatur</dt>
                  <dd>Fühler dabei, bei LiFePO4 Pflicht</dd>
                </div>
                <div>
                  <dt>Steuerung</dt>
                  <dd>D+ / Zündung / Spannung</dd>
                </div>
                <div>
                  <dt>Maße / Gewicht</dt>
                  <dd>234 × 139 × 74 mm / 1,48 kg</dd>
                </div>
                <div>
                  <dt>Preis</dt>
                  <dd>500–555 €; mein Kauf: 380 €</dd>
                </div>
              </dl>
              <p className="lb-device__copy">
                Mein Gerät. 90 A an 330 Ah sind 0,27 C; mit 75 A Drosselung bleiben 0,23 C. Ein Gerät, ein
                Kabelweg, ein Temperaturfühler. Der Preis ist nicht der billigste, aber gegenüber zwei Orion
                plus Verkabelung auch kein Ausreißer.
              </p>
              <p className="lb-device__note">
                Der 90er braucht 25/35 mm² und Luft. Wer die alten 16-mm²-Kabel vom 30-A-Booster behält, hat
                das eigentliche Problem — nicht das Gerät.
              </p>
              <div className="lb-device__links">
                <a href="https://www.offgridtec.com/media/product_attachements/Votronic_VCC_3326-3328-3329_Bedienungsanleitung.pdf">
                  Handbuch
                </a>
                <a href="https://www.sprinter-forum.de/viewtopic.php?t=23955">
                  Forum: 70-A-Langzeiterfahrung
                </a>
              </div>
            </article>
          </div>

          <div className="mt-5">
            <h4 className="font-display text-lg font-semibold text-ink">
              Weitere Konzepte, kurz eingeordnet
            </h4>
            <div className="lb-compact-grid mt-3">
              <article className="lb-compact">
                <h4>2 × Victron Orion parallel</h4>
                <p>
                  60 A für rund 300–450 € plus Verkabelung. Victron erlaubt es, aber die Last verteilt sich
                  nicht von selbst. Gleiche Leitungslängen, ein Sternpunkt und eine stillgelegte EBL-Ladung
                  sind Pflicht.
                </p>
                <span className="lb-compact__meta">Aufwand: hoch · Lichtmaschine prüfen</span>
              </article>
              <article className="lb-compact">
                <h4>Büttner MT BCB</h4>
                <p>
                  3-in-1 aus 230-V-Lader und Booster, 20–60 A. Beim 40/40/30 muss in Fahrzeugen mit EBL auf 30
                  A begrenzt werden; der 30/30/20 braucht ein Hochlastrelais. Einen 90-A-Booster gibt es
                  nicht.
                </p>
                <span className="lb-compact__meta">702–1.289 € · kein 90-A-Modell</span>
              </article>
              <article className="lb-compact">
                <h4>Renogy 50 A DC/DC mit MPPT</h4>
                <p>
                  50 A sind die Gesamtleistung über beide Quellen. Im Hybridbetrieb liefert jede Quelle
                  maximal 25 A. Wer 50 A aus der Lichtmaschine erwartet, während Solar läuft, wird enttäuscht.
                </p>
                <span className="lb-compact__meta">ab 169 € · kombiniert, nicht additiv</span>
              </article>
              <article className="lb-compact">
                <h4>Sterling Saturn BB12120</h4>
                <p>
                  Die Produktseite nennt 120 A und 1.620 W; das Handbuch nennt 110 A bei 14,41 V. Beides ist
                  nicht dasselbe. In Deutschland kostet das Gerät rund 711–747 €. Ein deutscher
                  BB12120-Einbaubericht war nicht auffindbar.
                </p>
                <span className="lb-compact__meta">110–120 A · Angaben prüfen</span>
              </article>
              <article className="lb-compact">
                <h4>Victron Buck-Boost 100 A</h4>
                <p>
                  100 A, programmierbar, ab ca. 795 €. Für ein gewachsenes Victron-System mit Monitoring
                  interessant. Für eine einfache Nachrüstung ist es zu teuer und zu komplex.
                </p>
                <span className="lb-compact__meta">100 A · Victron-System</span>
              </article>
            </div>
          </div>

          <div className="lb-callout mt-5">
            <p>
              <strong>Der 180-€-Fund, den ich nicht genommen habe.</strong> Ich habe Angebote gesehen, die
              äußerlich und laut Datenblatt einem 110–120-A-Wandler entsprechen, für rund 180 €. Rechnerisch
              war das das günstigste Angebot im ganzen Vergleich.
            </p>
            <p>
              Ich habe es trotzdem nicht genommen. Ich konnte Datenblatt, Firmware und Dauerleistung nicht
              prüfen, hatte keinen Ansprechpartner und im Fehlerfall keine realistische Rücksendung. Das war
              eine Risikoentscheidung, keine technische. Einen unabhängigen Test zu diesen Geräten habe ich
              nicht gefunden; die Aussage bleibt deshalb meine Beobachtung, kein Messergebnis.
            </p>
          </div>
        </section>

        <section id="vergleich-foren" aria-labelledby="vergleich-foren-titel" className="scroll-mt-20">
          <div className="lb-dark">
            <p className="lb-eyebrow">Nischenwissen // Foren</p>
            <h3 id="vergleich-foren-titel" className="mt-2">
              Was in Foren wirklich steht
            </h3>
            <div className="prose-measure mt-3 text-md leading-relaxed">
              <p>
                Foren sind keine Messlabore. Aber sie zeigen Fälle, die in keinem Datenblatt stehen: zwei
                Geräte, die sich die Last nicht teilen; ein Booster, der bei Euro 6 immer wieder abschaltet;
                eine Lichtmaschine, die bei 90 A an ihre Temperaturgrenze kommt. Ich habe die Threads gelesen
                und auf das reduziert, was sich wiederholt.
              </p>
            </div>
            <div className="lb-insights">
              <article className="lb-insight">
                <span className="lb-insight__num">01</span>
                <div>
                  <h4>Parallel ist erlaubt — aber nicht automatisch verteilt</h4>
                  <p>
                    Victron schreibt im Datenblatt, dass sich beliebig viele Orion parallel schalten lassen.
                    In der Praxis berichten Nutzer, dass im Teillastbetrieb nur ein Gerät die Arbeit macht.
                    Die Erklärung im Victron-Forum: Der Booster regelt seine Ausgangsspannung; kleine
                    Toleranzen entscheiden, welches Gerät zuerst in die Strombegrenzung läuft. Abhilfe sind
                    gleiche Leitungslängen, ein anderer Abgreifpunkt und ausreichender Querschnitt — keine
                    Einstellung.{' '}
                    <a href="https://communityarchive.victronenergy.com/questions/78315/warum-arbeitet-nur-eins-der-beiden-parallel-gescha.html">
                      Thread
                    </a>
                    , <a href="https://www.wohnmobilforum.de/w-t157920.html">Einbaubericht</a>.
                  </p>
                </div>
              </article>
              <article className="lb-insight">
                <span className="lb-insight__num">02</span>
                <div>
                  <h4>D+ ist bei Euro 6 oft der Unterschied</h4>
                  <p>
                    Intelligente Lichtmaschinen regeln die Spannung fahrzustandsabhängig. Reine
                    Spannungserkennung kann den Booster abschalten lassen, obwohl der Motor läuft. Der Orion
                    hat keinen D+-Eingang; Schaudt und ECTIVE verlangen D+; Votronic kann D+, Zündung oder
                    Spannung. Wer Euro 6 fährt, sollte die Steuerleitung genauso planen wie den Querschnitt.{' '}
                    <a href="https://www.vanovizen.de/ladebooster-bei-euro-6-ducato-baujahr-2022-mit-intelligenter-lichtmaschine/">
                      Fallbericht Ducato
                    </a>
                    ,{' '}
                    <a href="https://www.sprinter-forum.de/viewtopic.php?t=27536&amp;start=30">
                      Sprinter-Forum
                    </a>
                    .
                  </p>
                </div>
              </article>
              <article className="lb-insight">
                <span className="lb-insight__num">03</span>
                <div>
                  <h4>Die Lichtmaschine ist die Grenze, nicht das Gerät</h4>
                  <p>
                    Ein 90-A-Booster zieht eingangsseitig rund 100 A, plus Fahrzeuglast. In einem Segelforum
                    drosseln Nutzer einen VCC 1212-90 an einer 90-A-Lichtmaschine bewusst auf 60–65 A, weil
                    die Lima bis 100 °C warm wird. Ein 70-A-Votronic an einer 180-A-Lima läuft seit zwei
                    Jahren mit 71 A. Die Kombination muss zur Lichtmaschine passen, nicht nur zur Batterie.{' '}
                    <a href="https://www.segeln-forum.de/thread/83239-votronic-ladebooster-vcc-1212-70-an-115a-lichtmaschine-z-b-vp-d1-20-oder-d1-30/">
                      Segeln-Forum
                    </a>
                    , <a href="https://www.sprinter-forum.de/viewtopic.php?t=23955">Sprinter-Forum</a>.
                  </p>
                </div>
              </article>
              <article className="lb-insight">
                <span className="lb-insight__num">04</span>
                <div>
                  <h4>Renogys 50 A sind geteilt, nicht additiv</h4>
                  <p>
                    Das Handbuch ist eindeutig: Im Hybridbetrieb liefert jede Quelle maximal 25 A, die
                    Gesamtleistung bleibt bei 50 A. Ein Nutzer im DIY-Solarforum beschreibt genau das: Bei
                    Solarertrag kommen aus der Lichtmaschine keine vollen 50 A. Wer beides gleichzeitig
                    braucht, muss die Aufteilung verstehen, bevor er kauft.{' '}
                    <a href="https://de.renogy.com/cdn/shop/files/RBC30D1S-G3_G4_RBC50D1S-G6_DC-DC_with_MPPT_EN__UM_B4.pdf">
                      Handbuch
                    </a>
                    ,{' '}
                    <a href="https://diysolarforum.com/threads/renogy-50a-dc-dc-mppt-charging-profile-w-engine-on.65496/">
                      Thread
                    </a>
                    .
                  </p>
                </div>
              </article>
              <article className="lb-insight">
                <span className="lb-insight__num">05</span>
                <div>
                  <h4>Votronic 90: gute Marke, dünne 90-A-Langzeitdaten</h4>
                  <p>
                    Die Marke hat in deutschen Foren einen guten Ruf. Der belastbarste Langzeitbericht, den
                    ich fand, betrifft aber den 1212-70 an einer 180-A-Lima und 260 Ah LiFeYPO4: zwei Jahre,
                    71 A, 35 mm². Zum 90er gibt es Kurzberichte und viele Fragen, aber keine unabhängige
                    Messreihe. Das ist kein Warnsignal — nur eine ehrliche Datenlage.{' '}
                    <a href="https://www.sprinter-forum.de/viewtopic.php?t=23955">Langzeitbericht 70 A</a>,{' '}
                    <a href="https://www.wohnmobilforum.de/w-t126938.html">Kurzbericht 90 A</a>.
                  </p>
                </div>
              </article>
              <article className="lb-insight">
                <span className="lb-insight__num">06</span>
                <div>
                  <h4>Sterling BB12120: stark, aber die Angaben widersprechen sich</h4>
                  <p>
                    Die Produktseite nennt 120 A und 1.620 W; das Handbuch nennt 110 A bei 14,41 V. Für die
                    Praxis ist beides viel Leistung, für den Vergleich ist die Abweichung relevant. In
                    Deutschland kostet das Gerät rund 711–747 €. Einen deutschen BB12120-Einbaubericht habe
                    ich nicht gefunden — die Erfahrungsdecke ist dünn.{' '}
                    <a href="https://sterling-power.com/products/bb12120-reverse-charging-jump-start-assistance">
                      Herstellerseite
                    </a>
                    ,{' '}
                    <a href="https://www.yachtbatterie.de/de/sterling-power-batterie-batterie-lader-bidirektional.html">
                      Preis
                    </a>
                    .
                  </p>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section id="vergleich-rechnung" aria-labelledby="vergleich-rechnung-titel" className="scroll-mt-20">
          <h3 id="vergleich-rechnung-titel">Meine Rechnung: warum 90 A und nicht 60</h3>
          <div className="lb-setup mt-4">
            <div>
              <div className="prose-measure space-y-3 text-md leading-relaxed text-ink-soft">
                <p>
                  Mein Ausbau hat 330 Ah LiFePO4, ein Induktionskochfeld über Wechselrichter, Solar auf dem
                  Dach und ein Euro-6-Basisfahrzeug mit geregelter Lichtmaschine. Angefangen habe ich mit
                  einem Victron Orion-Tr Smart 12/12-30. Der lief einwandfrei. Die Rechnung ging trotzdem
                  nicht auf.
                </p>
                <p>
                  30 A an 330 Ah sind 0,09 C. Zwei Stunden Fahrt bringen damit grob 0,8 kWh in die Batterie;
                  ein Induktionskochfeld braucht je nach Nutzung 1–2 kWh am Tag. Abends kochen, zwei Stunden
                  fahren, morgens kaum höher — das war keine Einbildung, sondern Mathematik.
                </p>
                <p>
                  Die Alternativen habe ich ehrlich gerechnet. Zwei Orion parallel hätten 60 A gebracht, aber
                  zwei Geräte, zwei Kabelwege, zwei Sicherungen und die Lastverteilung gekostet. Der ECTIVE BB
                  60 war der härteste Konkurrent: 60 A für 260–292 €, 0,18 C an meiner Batterie. Der Schaudt
                  WA 121545 hätte mit 70 A fast gereicht, kostet aber 575 € und lädt Lithium mit festen 14,4
                  V. Der Sterling BB12120 wäre mit 110–120 A die stärkste Option gewesen, aber die
                  Herstellerangaben sind nicht konsistent und die deutsche Erfahrungslage für genau dieses
                  Modell ist dünn.
                </p>
                <p>
                  Geworden ist es der Votronic VCC 1212-90. Mein Kaufpreis lag bei 380 €, der Straßenpreis
                  aktuell bei 500–555 €. 90 A an 330 Ah sind 0,27 C; mit der Drosselung auf 75 A bleiben 0,23
                  C. Ich wollte die Reserve für den Winter, aber nicht dauerhaft am Limit der Lichtmaschine
                  fahren. Genau dafür ist die Drosselung da.
                </p>
              </div>
              <dl className="lb-setup__facts">
                <div className="lb-fact">
                  <dt>Batterie</dt>
                  <dd>330 Ah LiFePO4</dd>
                </div>
                <div className="lb-fact">
                  <dt>Fahrzeug</dt>
                  <dd>Euro 6, geregelte Lichtmaschine</dd>
                </div>
                <div className="lb-fact">
                  <dt>Verbraucher</dt>
                  <dd>Induktion, Solar, Heizung, Licht</dd>
                </div>
                <div className="lb-fact">
                  <dt>Booster</dt>
                  <dd>Votronic VCC 1212-90 (Art. 3329)</dd>
                </div>
                <div className="lb-fact">
                  <dt>Kaufpreis</dt>
                  <dd>380 € (10/2026)</dd>
                </div>
                <div className="lb-fact">
                  <dt>Straßenpreis</dt>
                  <dd>500–555 € (10/2026)</dd>
                </div>
              </dl>
            </div>
            <figure className="lb-figure" aria-labelledby="lb-diagram-caption">
              <svg viewBox="0 0 420 260" role="img" aria-labelledby="lb-diagram-desc">
                <desc id="lb-diagram-desc">
                  Starterbatterie, Sicherung, Ladebooster und Aufbaubatterie mit Eingangs- und Ausgangsstrom,
                  D+-Steuerleitung und Masse.
                </desc>
                <rect
                  x="8"
                  y="52"
                  width="104"
                  height="76"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                ></rect>
                <text
                  x="18"
                  y="74"
                  fontSize="8"
                  fontFamily="IBM Plex Mono, monospace"
                  fill="currentColor"
                  letterSpacing="0.08em"
                >
                  STARTER
                </text>
                <text x="18" y="90" fontSize="7" fontFamily="IBM Plex Mono, monospace" fill="currentColor">
                  12 V
                </text>
                <text x="18" y="108" fontSize="7" fontFamily="IBM Plex Mono, monospace" fill="currentColor">
                  Lichtmaschine
                </text>
                <rect
                  x="149"
                  y="42"
                  width="122"
                  height="96"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                ></rect>
                <text
                  x="160"
                  y="62"
                  fontSize="8"
                  fontFamily="IBM Plex Mono, monospace"
                  fill="currentColor"
                  letterSpacing="0.08em"
                >
                  BOOSTER
                </text>
                <text x="160" y="80" fontSize="7" fontFamily="IBM Plex Mono, monospace" fill="currentColor">
                  VCC 1212-90
                </text>
                <text x="160" y="96" fontSize="7" fontFamily="IBM Plex Mono, monospace" fill="currentColor">
                  90 A Ausgang
                </text>
                <text x="160" y="112" fontSize="7" fontFamily="IBM Plex Mono, monospace" fill="currentColor">
                  0–75 A drosselbar
                </text>
                <rect
                  x="308"
                  y="52"
                  width="104"
                  height="76"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                ></rect>
                <text
                  x="318"
                  y="74"
                  fontSize="8"
                  fontFamily="IBM Plex Mono, monospace"
                  fill="currentColor"
                  letterSpacing="0.08em"
                >
                  AUFBAU
                </text>
                <text x="318" y="90" fontSize="7" fontFamily="IBM Plex Mono, monospace" fill="currentColor">
                  330 Ah
                </text>
                <text x="318" y="108" fontSize="7" fontFamily="IBM Plex Mono, monospace" fill="currentColor">
                  LiFePO4
                </text>
                <line x1="112" y1="90" x2="149" y2="90" stroke="currentColor" strokeWidth="1.4"></line>
                <polygon points="149,90 142,86 142,94" fill="currentColor"></polygon>
                <line x1="271" y1="90" x2="308" y2="90" stroke="currentColor" strokeWidth="1.4"></line>
                <polygon points="308,90 301,86 301,94" fill="currentColor"></polygon>
                <text x="116" y="82" fontSize="6.5" fontFamily="IBM Plex Mono, monospace" fill="currentColor">
                  ≈ 100 A
                </text>
                <text x="275" y="82" fontSize="6.5" fontFamily="IBM Plex Mono, monospace" fill="currentColor">
                  90 A
                </text>
                <line x1="60" y1="128" x2="60" y2="170" stroke="currentColor" strokeWidth="1"></line>
                <line x1="60" y1="170" x2="210" y2="170" stroke="currentColor" strokeWidth="1"></line>
                <line x1="210" y1="170" x2="210" y2="138" stroke="currentColor" strokeWidth="1"></line>
                <text x="68" y="164" fontSize="6.5" fontFamily="IBM Plex Mono, monospace" fill="currentColor">
                  Masse in gleichem Querschnitt
                </text>
                <line
                  x1="210"
                  y1="42"
                  x2="210"
                  y2="18"
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                ></line>
                <text x="218" y="22" fontSize="6.5" fontFamily="IBM Plex Mono, monospace" fill="currentColor">
                  D+ / Zündung
                </text>
                <circle cx="149" cy="90" r="2.2" fill="currentColor"></circle>
                <circle cx="308" cy="90" r="2.2" fill="currentColor"></circle>
                <text x="8" y="212" fontSize="6.5" fontFamily="IBM Plex Mono, monospace" fill="currentColor">
                  Sicherung am Batteriepol, nicht am Booster.
                </text>
                <text x="8" y="226" fontSize="6.5" fontFamily="IBM Plex Mono, monospace" fill="currentColor">
                  Querschnitte folgen der Leitung, nicht dem Gerät.
                </text>
                <text x="8" y="246" fontSize="6.5" fontFamily="IBM Plex Mono, monospace" fill="currentColor">
                  Skizze, keine Einbauanleitung.
                </text>
              </svg>
              <figcaption id="lb-diagram-caption">
                Prinzipskizze meines Ladepfads. Der Eingangsstrom ist höher als der Ausgangsstrom; deshalb
                wird die Zuleitung von der Starterbatterie mit dem Eingangsstrom bemessen. Die Skizze ersetzt
                keine Einbauanleitung.
              </figcaption>
            </figure>
          </div>

          <div className="lb-crate mt-5">
            <div className="lb-crate__head">
              <h4>C-Rate: 90 A an 330 Ah sind 0,27 C</h4>
              <div className="lb-crate__legend">
                <span>
                  <i></i>LiFePO4-Fenster 0,2–0,5 C
                </span>
              </div>
            </div>
            <div className="lb-bars" aria-label="C-Rate verschiedener Ladeströme an 330 Ah">
              <div className="lb-bar-row">
                <span className="lb-bar-row__label">30 A</span>
                <div className="lb-track">
                  <span className="lb-track__band"></span>
                  <span className="lb-track__fill" style={{ width: '18%' }}></span>
                </div>
                <span className="lb-bar-row__value">0,09 C</span>
              </div>
              <div className="lb-bar-row">
                <span className="lb-bar-row__label">60 A</span>
                <div className="lb-track">
                  <span className="lb-track__band"></span>
                  <span className="lb-track__fill" style={{ width: '36%' }}></span>
                </div>
                <span className="lb-bar-row__value">0,18 C</span>
              </div>
              <div className="lb-bar-row">
                <span className="lb-bar-row__label">70 A</span>
                <div className="lb-track">
                  <span className="lb-track__band"></span>
                  <span className="lb-track__fill" style={{ width: '42%' }}></span>
                </div>
                <span className="lb-bar-row__value">0,21 C</span>
              </div>
              <div className="lb-bar-row is-strong">
                <span className="lb-bar-row__label">90 A</span>
                <div className="lb-track">
                  <span className="lb-track__band"></span>
                  <span className="lb-track__fill" style={{ width: '54%' }}></span>
                </div>
                <span className="lb-bar-row__value">0,27 C</span>
              </div>
              <div className="lb-bar-row">
                <span className="lb-bar-row__label">120 A</span>
                <div className="lb-track">
                  <span className="lb-track__band"></span>
                  <span className="lb-track__fill" style={{ width: '72%' }}></span>
                </div>
                <span className="lb-bar-row__value">0,36 C</span>
              </div>
            </div>
            <div className="lb-scale">
              <span>0</span>
              <span>0,1</span>
              <span>0,2</span>
              <span>0,3</span>
              <span>0,4</span>
              <span>0,5 C</span>
            </div>
            <p className="caption-xs mt-2 text-ink-soft">
              C-Rate = Ladestrom geteilt durch Kapazität. Die Bänder sind Herstellerangaben, keine Norm. Das
              Datenblatt und das BMS deiner Batterie gelten.
            </p>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div className="lb-photo-slot" data-photo-slot="booster">
              <span className="lb-photo-slot__tag">Foto-Slot 01 · 3:2</span>
              <strong>Votronic VCC 1212-90 im Einbau</strong>
              <span>
                Eigenes Foto folgt. Alt-Text: Votronic VCC 1212-90 neben der Aufbaubatterie im Camper, Kabel
                und Sicherung sichtbar.
              </span>
            </div>
            <div className="lb-photo-slot" data-photo-slot="sicherung">
              <span className="lb-photo-slot__tag">Foto-Slot 02 · 3:2</span>
              <strong>Absicherung am Batteriepol</strong>
              <span>
                Eigenes Foto folgt. Alt-Text: 100-A-Sicherung und 35-mm²-Leitung am Batteriepol, sauber
                verpresst und angezogen.
              </span>
            </div>
          </div>
          <p className="lb-note mt-2">
            Ich habe den Ladestrom nicht mit einer Stromzange gemessen. Die Zahlen in diesem Abschnitt sind
            Herstellerangaben und Rechnung. Wer nachmisst, sieht häufig weniger, weil Temperatur,
            Spannungsfall und Batteriezustand dazwischenkommen. Genau deshalb stehen die Annahmen hier offen.
          </p>
        </section>

        <section id="vergleich-rechner" aria-labelledby="vergleich-rechner-titel" className="scroll-mt-20">
          <h3 id="vergleich-rechner-titel">Ladestrom-Rechner: Welche Klasse passt?</h3>
          <div className="prose-measure mt-3 space-y-3 text-md leading-relaxed text-ink-soft">
            <p>
              Der Rechner ist eine Faustregel, keine Auslegung. Er zeigt dir, in welchem C-Fenster deine
              Batterie liegt, welche Geräteklasse daraus folgt und wie stark die Lichtmaschine dabei belastet
              wird. Er empfiehlt kein Produkt und verkauft nichts.
            </p>
          </div>
          <form className="lb-calc mt-4" id="lb-calc-form" noValidate>
            <div className="lb-calc__grid">
              <div className="lb-field">
                <label htmlFor="lb-ah">Batteriekapazität (Ah)</label>
                <input
                  id="lb-ah"
                  name="lb-ah"
                  type="number"
                  inputMode="numeric"
                  min="50"
                  max="1200"
                  step="10"
                  defaultValue="330"
                />
              </div>
              <div className="lb-field">
                <label htmlFor="lb-chem">Batteriechemie</label>
                <select id="lb-chem" name="lb-chem" defaultValue="lifepo4">
                  <option value="lifepo4">LiFePO4</option>
                  <option value="lead">AGM / Gel / Blei</option>
                </select>
              </div>
              <div className="lb-field">
                <label htmlFor="lb-hours">Gewünschte Fahrzeit (h)</label>
                <input
                  id="lb-hours"
                  name="lb-hours"
                  type="number"
                  inputMode="decimal"
                  min="1"
                  max="24"
                  step="0.5"
                  defaultValue="5"
                />
              </div>
              <div className="lb-field">
                <label htmlFor="lb-alt">Lichtmaschine (A)</label>
                <input
                  id="lb-alt"
                  name="lb-alt"
                  type="number"
                  inputMode="numeric"
                  min="40"
                  max="400"
                  step="5"
                  defaultValue="180"
                />
              </div>
            </div>
            <div className="lb-calc__actions">
              <button className="lb-button" type="submit">
                Berechnen
              </button>
              <span className="lb-calc__hint">
                90 % Wirkungsgrad, 20 A Fahrzeuglast, 20 % Zuschlag für die Konstantspannungsphase.
              </span>
            </div>
            <dl className="lb-results" id="lb-result" aria-live="polite">
              <div className="lb-result" data-lb-result="current">
                <dt>Bedarf für deine Fahrzeit</dt>
                <dd id="lb-out-current">–</dd>
              </div>
              <div className="lb-result" data-lb-result="class">
                <dt>Geräteklasse</dt>
                <dd id="lb-out-class">–</dd>
              </div>
              <div className="lb-result" data-lb-result="load">
                <dt>Lichtmaschinenlast</dt>
                <dd id="lb-out-load">–</dd>
              </div>
            </dl>
            <p className="lb-result-note" id="lb-result-note"></p>
          </form>
          <noscript>
            <p className="lb-note mt-2">
              Der Rechner benötigt JavaScript. Die Tabelle und die Entscheidungsfragen oben funktionieren
              ohne.
            </p>
          </noscript>
          <p className="lb-note mt-2">
            Der Rechner ist bewusst konservativ. Er ersetzt weder das Datenblatt deiner Batterie noch die
            Prüfung der Lichtmaschine. Wenn die Last über 80 % liegt, ist das ein Prüfauftrag, keine Freigabe.
          </p>
        </section>

        <section aria-labelledby="vergleich-fragen-titel" className="scroll-mt-20">
          <h3 id="vergleich-fragen-titel">Die Entscheidung in fünf Fragen</h3>
          <ol className="lb-decision">
            <li>
              <div>
                <strong>Wie groß ist deine Batterie, und was zieht daran?</strong>
                <p>
                  Rechne mit 0,2–0,3 C bei Blei und 0,3–0,5 C bei LiFePO4. 330 Ah LiFePO4 vertragen 99–165 A;
                  90 A liegen mit 0,27 C mitten im Fenster. Große Verbraucher verschieben die Entscheidung
                  nach oben, Solar nach unten.
                </p>
              </div>
            </li>
            <li>
              <div>
                <strong>Wie viel Strom liefert deine Lichtmaschine dauerhaft?</strong>
                <p>
                  Ein 90-A-Booster zieht rund 100 A Eingangsstrom plus Fahrzeuglast. Eine 180-A-Lima hat
                  Reserve; eine 90-A-Lima nicht. Prüfe Nennstrom, Leerlaufdrehzahl und die bestehende
                  Verkabelung, bevor du bestellst.
                </p>
              </div>
            </li>
            <li>
              <div>
                <strong>Hat dein Fahrzeug D+ oder eine intelligente Lichtmaschine?</strong>
                <p>
                  Bei Euro 6 ist D+ oder ein Zündsignal die zuverlässigere Steuerung. Der Orion kommt ohne D+
                  aus, Schaudt und ECTIVE verlangen es, Votronic kann beides. Reine Spannungserkennung ist
                  kein Ausschlusskriterium, aber ein Risiko.
                </p>
              </div>
            </li>
            <li>
              <div>
                <strong>Wie lang ist der Weg von der Starterbatterie zum Booster?</strong>
                <p>
                  Der Querschnitt folgt der Leitung, nicht dem Gerät. Beim Votronic 90 sind 25 mm² bis 6 m und
                  35 mm² bis 9 m vorgesehen; der Orion endet bei 16 mm². Sicherungen gehören an den
                  Batteriepol, nicht an den Booster.
                </p>
              </div>
            </li>
            <li>
              <div>
                <strong>Willst du ein Gerät oder ein Projekt?</strong>
                <p>
                  Ein einzelner 60–90-A-Booster ist ein Gerät. Zwei parallel, ein Kombigerät mit EBL oder ein
                  Import ohne Support sind Projekte. Der Aufwand ist kein Argument gegen das Projekt — aber er
                  gehört in die Rechnung.
                </p>
              </div>
            </li>
          </ol>
        </section>

        <section id="vergleich-quellen" aria-labelledby="vergleich-quellen-titel" className="scroll-mt-20">
          <h3 id="vergleich-quellen-titel">Quellen, Preise und Transparenz</h3>
          <div className="prose-measure mt-3 space-y-3 text-md leading-relaxed text-ink-soft">
            <p>
              Preisstand: 23.10.2026. Alle Preise inklusive MwSt., sofern der Händler nichts anderes angibt.
              Es sind Momentaufnahmen, keine Live-Preise. Diese Seite enthält keine Affiliate-Links und keine
              Shop-Empfehlung. Herstellerdaten stammen aus den verlinkten Handbüchern; Forenstimmen sind als
              solche gekennzeichnet und keine Messwerte.
            </p>
          </div>
          <div className="lb-sources mt-4">
            <div>
              <h4>Hersteller</h4>
              <ol>
                <li>
                  <a href="https://www.victronenergy.de/upload/documents/Datasheet-Orion-Tr-Smart-DC-DC-chargers-non-isolated-360-400W-DE.pdf">
                    Victron Orion-Tr Smart, Datenblatt
                  </a>
                </li>
                <li>
                  <a href="https://www.offgridtec.com/media/product_attachements/Votronic_VCC_3326-3328-3329_Bedienungsanleitung.pdf">
                    Votronic VCC 1212-50/70/90, Montageanleitung
                  </a>
                </li>
                <li>
                  <a href="https://www.ective.de/mediafiles/Datenblatt/ective/ladebooster/ECTIVE-BB%2BSBB-Bedienungsanleitung-DE-2026-02-27.pdf">
                    ECTIVE BB/SBB, Bedienungsanleitung
                  </a>
                </li>
                <li>
                  <a href="https://www.ivt-hirschau.de/media/products/920000_Bedienungsanleitung_Ladebooster-SCHAUDT-WA121545.pdf">
                    Schaudt WA 121545, Bedienungsanleitung
                  </a>
                </li>
                <li>
                  <a href="https://www.ivt-hirschau.de/de/Ladebooster-SCHAUDT-WA-121525::1216.html">
                    Schaudt WA 121525, Produktseite
                  </a>
                </li>
                <li>
                  <a href="https://www.buettner-elektronik.de/produkte/lade-booster/produkt/show/mt-bcb-30-40-60.html">
                    Büttner MT BCB 30/40/60, Produktseite
                  </a>
                </li>
                <li>
                  <a href="https://de.renogy.com/cdn/shop/files/RBC30D1S-G3_G4_RBC50D1S-G6_DC-DC_with_MPPT_EN__UM_B4.pdf">
                    Renogy RBC30/50, Handbuch
                  </a>
                </li>
                <li>
                  <a href="https://sterling-power.com/products/bb12120-reverse-charging-jump-start-assistance">
                    Sterling BB12120, Produktseite
                  </a>
                </li>
                <li>
                  <a href="https://cdn.shopify.com/s/files/1/0658/7343/files/Collated_manual_6fe055ef-bac9-46fd-bb51-662f1bfe0d15.pdf">
                    Sterling Saturn, Handbuch
                  </a>
                </li>
                <li>
                  <a href="https://www.victronenergy.com/dc-dc-converters/buck-boost-dc-dc-converter-25a-50a">
                    Victron Buck-Boost 25/50/100 A, Produktseite
                  </a>
                </li>
              </ol>
            </div>
            <div>
              <h4>Foren &amp; Praxis</h4>
              <ol start={11}>
                <li>
                  <a href="https://communityarchive.victronenergy.com/questions/78315/warum-arbeitet-nur-eins-der-beiden-parallel-gescha.html">
                    Victron Community: zwei Orion parallel
                  </a>
                </li>
                <li>
                  <a href="https://www.wohnmobilforum.de/w-t157920.html">
                    Wohnmobilforum: zwei Orion einbauen
                  </a>
                </li>
                <li>
                  <a href="https://diysolarforum.com/threads/victron-orion-tr-smart-12-12-30-chargers-hooked-in-parallel.36336/">
                    DIY Solar: Orion parallel, keine 60 A
                  </a>
                </li>
                <li>
                  <a href="https://www.vanovizen.de/ladebooster-bei-euro-6-ducato-baujahr-2022-mit-intelligenter-lichtmaschine/">
                    Vanovizen: Euro-6-Ducato und D+
                  </a>
                </li>
                <li>
                  <a href="https://www.sprinter-forum.de/viewtopic.php?t=27536&amp;start=30">
                    Sprinter-Forum: D+ abgreifen
                  </a>
                </li>
                <li>
                  <a href="https://www.wohnmobilforum.de/w-t141571.html">
                    Wohnmobilforum: Schaudt WA 121525 und LiFePO4
                  </a>
                </li>
                <li>
                  <a href="https://diysolarforum.com/threads/renogy-50a-dc-dc-mppt-charging-profile-w-engine-on.65496/">
                    DIY Solar: Renogy 50 A geteilt
                  </a>
                </li>
                <li>
                  <a href="https://www.segeln-forum.de/thread/83239-votronic-ladebooster-vcc-1212-70-an-115a-lichtmaschine-z-b-vp-d1-20-oder-d1-30/">
                    Segeln-Forum: Votronic 90 an 90-A-Lima
                  </a>
                </li>
                <li>
                  <a href="https://www.sprinter-forum.de/viewtopic.php?t=23955">
                    Sprinter-Forum: Votronic 70, zwei Jahre
                  </a>
                </li>
                <li>
                  <a href="https://www.wohnmobilforum.de/w-t126938.html">
                    Wohnmobilforum: Votronic 90 im Ducato
                  </a>
                </li>
                <li>
                  <a href="https://www.digicamper.com/forum/index.php?thread/42674-ladebooster-sterling-power-bbw12120/">
                    Digicamper: Sterling BB12120 ohne Antwort
                  </a>
                </li>
              </ol>
            </div>
            <div>
              <h4>Preise</h4>
              <ol start={22}>
                <li>
                  <a href="https://www.camping-factory.com/votronic-ladewandler-vcc-1212-90">
                    Camping-Factory: Votronic 90, 500,59 €
                  </a>
                </li>
                <li>
                  <a href="https://voltimax.de/en/Votronic-3329-VCC-1212-90-12V-to-12V-90A-charging-booster-charging-converter/V3363">
                    VoltiMax: Votronic 90, 555,50 €
                  </a>
                </li>
                <li>
                  <a href="https://www.ivt-hirschau.de/de/Ladebooster-SCHAUDT-WA-121545-inkl-Anschluss-und-Temperaturfuehler-Set::1217.html">
                    IVT: Schaudt 121545, 575 €
                  </a>
                </li>
                <li>
                  <a href="https://www.ivt-hirschau.de/de/Ladebooster-SCHAUDT-WA-121525::1216.html">
                    IVT: Schaudt 121525, 232,35 €
                  </a>
                </li>
                <li>
                  <a href="https://www.ective.de/ladetechnik/ladebooster/bb-60-12v-auf-12v-ladebooster-60a">
                    ECTIVE: BB 60, 292 €
                  </a>
                </li>
                <li>
                  <a href="https://www.idealo.de/preisvergleich/OffersOfProduct/201945849_-bb-60-tn4545-ective-batteries.html">
                    idealo: ECTIVE BB 60 ab 260,30 €
                  </a>
                </li>
                <li>
                  <a href="https://www.campingwagner.de/de/p/buettner-elektronik-bcb-iuou-lader-booster-kombination-batterie-control-booster_m7469">
                    CampingWagner: Büttner 25/20, 702 €
                  </a>
                </li>
                <li>
                  <a href="https://de.renogy.com/products/dc-zu-dc-laderegler-mppt-12v-50a-fur-batterie">
                    Renogy: 50 A, 209,99 €
                  </a>
                </li>
                <li>
                  <a href="https://www.yachtbatterie.de/de/sterling-power-batterie-batterie-lader-bidirektional.html">
                    Yachtbatterie: Sterling BB12120, 710,91 €
                  </a>
                </li>
                <li>
                  <a href="https://lepper-marine.de/Sterling-Hochleistungs-B2B-Ladegeraet-Typ-BB12120-Batterie-zu-Batterie/7170-9">
                    Lepper Marine: Sterling BB12120, 746,90 €
                  </a>
                </li>
                <li>
                  <a href="https://shop4akku.de/hersteller/victron-energy/dc-dc-wandler/">
                    shop4akku: Victron Buck-Boost 100 A, 794,99 €
                  </a>
                </li>
                <li>
                  <a href="https://geizhals.de/victron-energy-orion-tr-smart-dc-dc-ladebooster-isoliert-12-12-30-ori121236120-a2523163.html">
                    Geizhals: Orion 30 A isoliert
                  </a>
                </li>
                <li>
                  <a href="https://www.idealo.at/preisvergleich/OffersOfProduct/202088593_-orion-tr-smart-12-12-30a-360-w-victron.html">
                    idealo.at: Orion 30 A nicht isoliert
                  </a>
                </li>
              </ol>
            </div>
          </div>
          <p className="lb-note mt-4">
            Hinweis zur Datenlage: Die Geräte wurden nicht unter identischen Bedingungen gemessen. Die
            Preisvergleiche sind keine Angebote, die Forenzitate sind keine Tests. Wer eine Kaufentscheidung
            trifft, sollte Datenblatt, BMS, Lichtmaschine und die eigene Verkabelung prüfen — nicht nur diese
            Seite.
          </p>
        </section>
      </div>
      <LadeboosterVergleichBehavior />
    </section>
  );
}
