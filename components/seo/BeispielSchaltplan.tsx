import Link from 'next/link';

/**
 * components/seo/BeispielSchaltplan.tsx — der anschaubare Beispiel-Schaltplan
 * auf `/camper-elektrik/schaltplan-beispiel/`.
 *
 * Warum eine Inline-SVG-Skizze und kein Foto: Die Fotostrecke der Website ist
 * rechte-gegated und noch leer (`lib/seo/bildSitemap.ts`,
 * `docs/design-2026-11/BILDRECHTE.md` — keine KI-Bilder im Versand). Eine
 * Prinzipskizze als Inline-SVG folgt dem Vorbild `LadeboosterVergleich`:
 * Sie steht im ausgelieferten HTML, ist für Antwortmaschinen als Bild mit
 * Beschreibung (`role="img"` + `<desc>`) lesbar und behauptet nicht, ein
 * Einbau- oder Verdrahtungsplan zu sein.
 *
 * Alle Werte auf der Skizze — Bauteile, Querschnitte, Längen, Sicherungen —
 * sind die Werte der Planer-Vorlage „Großes Autark-Setup"
 * (`TEMPLATE_AUTARK` in `components/planner/templates.ts`), die der
 * „im Planer öffnen"-Verweis lädt. Der zugehörige Test
 * (`BeispielSchaltplan.test.tsx`) hält Skizze und Vorlage aneinander fest,
 * damit hier keine Zahl steht, die der geöffnete Plan nicht enthält.
 *
 * Layout-Regel der Skizze: Leitungen laufen nur in den Gassen zwischen den
 * Bauteil-Kästen, Beschriftungen stehen ÜBER ihrer Leitung in freier Gasse,
 * und die Kästen sind deckend gefüllt (`--color-paper`), damit keine Leitung
 * durch einen Kasten hindurchscheint.
 */
export function BeispielSchaltplan() {
  return (
    <figure aria-labelledby="beispiel-schaltplan-caption" className="max-w-3xl">
      <div className="overflow-x-auto">
        <svg
          viewBox="0 0 1000 590"
          role="img"
          aria-labelledby="beispiel-schaltplan-desc"
          className="w-full min-w-[760px] border border-rule bg-paper p-2 text-ink"
        >
          <desc id="beispiel-schaltplan-desc">
            Beispiel-Schaltplan eines Campers: 400-W-Solarmodul über einen 35-A-MPPT-Regler, Starterbatterie
            über einen 20-A-Ladebooster und Landstrom über einen 600-W-Wechselrichter speisen eine
            200-Ah-LiFePO4-Bordbatterie. Die Batterie hängt über eine 100-A-Class-T-Hauptsicherung an Plus-
            und Minus-Sammelschiene; ein Sicherungskasten versorgt Kühlschrank, Standheizung und MaxxFan, der
            Wechselrichter einen 230-V-Verbraucher.
          </desc>

          {/* Leitungen zuerst — die deckenden Bauteil-Kästen liegen darüber. */}
          <g stroke="currentColor" strokeWidth="1.4" fill="none">
            {/* Solar → MPPT → Plus-Sammelschiene */}
            <path d="M210 68 H290" />
            <path d="M470 68 H630 V140" />
            {/* Starterbatterie → Ladebooster → Plus-Sammelschiene */}
            <path d="M210 188 H290" />
            <path d="M470 188 H600 V166" />
            {/* Bordbatterie → Hauptsicherung → Plus-Sammelschiene (Plus) */}
            <path d="M210 296 H500 V153 H550" />
            {/* Bordbatterie → Minus-Sammelschiene (Minus, gestrichelt) */}
            <path d="M210 340 H520 V203 H550" strokeDasharray="5 4" />
            {/* Plus-Sammelschiene → Sicherungskasten */}
            <path d="M720 153 H740 V68 H760" />
            {/* Sicherungskasten → Verbraucher: Rückenleitung links, Abzweig je Kasten */}
            <path d="M750 68 V324" />
            <path d="M750 164 H760" />
            <path d="M750 244 H760" />
            <path d="M750 324 H760" />
            {/* Sammelschienen → Wechselrichter */}
            <path d="M600 166 V300" />
            <path d="M680 216 V300" strokeDasharray="5 4" />
            {/* Landstrom → Wechselrichter → 230-V-Verbraucher (230 V, gepunktet) */}
            <path d="M210 468 H480 V356 H550" strokeDasharray="2 3" />
            <path d="M720 356 H745 V468 H760" strokeDasharray="2 3" />
          </g>

          {/* Bauteil-Kästen (deckend, damit keine Leitung durchscheint) */}
          <g fill="var(--paper)" stroke="currentColor" strokeWidth="1.2">
            <rect x="30" y="36" width="180" height="64" />
            <rect x="290" y="36" width="180" height="64" />
            <rect x="760" y="36" width="210" height="64" />
            <rect x="30" y="156" width="180" height="64" />
            <rect x="290" y="156" width="180" height="64" />
            <rect x="550" y="140" width="170" height="26" />
            <rect x="550" y="190" width="170" height="26" />
            <rect x="760" y="136" width="210" height="56" />
            <rect x="760" y="216" width="210" height="56" />
            <rect x="760" y="296" width="210" height="56" />
            <rect x="30" y="262" width="180" height="96" />
            <rect x="550" y="300" width="170" height="76" />
            <rect x="30" y="436" width="180" height="64" />
            <rect x="760" y="436" width="210" height="64" />
          </g>

          {/* Sicherungs-Symbole auf den Plus-Leitungen */}
          <g fill="var(--paper)" stroke="currentColor" strokeWidth="1.4">
            <rect x="237" y="60" width="26" height="16" />
            <rect x="237" y="180" width="26" height="16" />
            <rect x="330" y="288" width="26" height="16" />
            <rect x="592" y="225" width="16" height="26" />
          </g>

          <g fontFamily="IBM Plex Mono, monospace" fill="currentColor" fontSize="12">
            <text x="42" y="62">
              Solar 400 W
            </text>
            <text x="42" y="82" fontSize="10">
              Modul, Dach
            </text>
            <text x="302" y="62">
              MPPT-Regler
            </text>
            <text x="302" y="82" fontSize="10">
              35 A
            </text>
            <text x="772" y="62">
              Sicherungskasten
            </text>
            <text x="772" y="82" fontSize="10">
              40 A MIDI
            </text>
            <text x="42" y="182">
              Starterbatterie
            </text>
            <text x="42" y="202" fontSize="10">
              90 Ah AGM
            </text>
            <text x="302" y="182">
              Ladebooster
            </text>
            <text x="302" y="202" fontSize="10">
              DC-DC, 20 A
            </text>
            <text x="560" y="157" fontSize="11">
              Plus-Sammelschiene
            </text>
            <text x="560" y="207" fontSize="11">
              Minus-Sammelschiene
            </text>
            <text x="772" y="158">
              Kühlschrank
            </text>
            <text x="772" y="176" fontSize="10">
              60 W · 3 m · 4 mm² · 10 A
            </text>
            <text x="772" y="238">
              Standheizung
            </text>
            <text x="772" y="256" fontSize="10">
              40 W · 4 m · 4 mm² · 15 A
            </text>
            <text x="772" y="318">
              MaxxFan
            </text>
            <text x="772" y="336" fontSize="10">
              40 W · 3 m · 2,5 mm² · 10 A
            </text>
            <text x="42" y="292">
              Bordbatterie
            </text>
            <text x="42" y="312" fontSize="10">
              200 Ah LiFePO4
            </text>
            <text x="42" y="330" fontSize="10">
              mit BMS
            </text>
            <text x="562" y="330">
              Wechselrichter
            </text>
            <text x="562" y="350" fontSize="10">
              600 W
            </text>
            <text x="42" y="462">
              Landstrom
            </text>
            <text x="42" y="482" fontSize="10">
              230 V, 16 A, RCD
            </text>
            <text x="772" y="462">
              230-V-Verbraucher
            </text>
            <text x="772" y="482" fontSize="10">
              500 W, z. B. Lader
            </text>
          </g>

          {/* Leitungsbeschriftungen: Länge · Querschnitt · Sicherung */}
          <g fontFamily="IBM Plex Mono, monospace" fill="currentColor" fontSize="10">
            <text x="214" y="54">
              4 m · 10 mm²
            </text>
            <text x="214" y="88">
              25 A
            </text>
            <text x="478" y="54">
              1 m · 16 mm² · 40 A
            </text>
            <text x="214" y="174">
              5 m · 16 mm²
            </text>
            <text x="214" y="208">
              40 A
            </text>
            <text x="478" y="174">
              1 m · 10 mm² · 25 A
            </text>
            <text x="230" y="282">
              0,5 m · 70 mm² · 100 A Class T
            </text>
            <text x="230" y="356">
              0,5 m · 70 mm² (Minus)
            </text>
            <text x="614" y="242">
              1 m · 35 mm² · 60 A
            </text>
            <text x="614" y="256">
              Class T
            </text>
            <text x="230" y="452">
              2 m · 2,5 mm² · RCBO 16 A (230 V)
            </text>
            <text x="752" y="392">
              2 m · 2,5 mm²
            </text>
            <text x="752" y="406">
              RCBO 10 A (230 V)
            </text>
          </g>

          <text x="30" y="540" fontSize="10" fontFamily="IBM Plex Mono, monospace" fill="currentColor">
            Prinzipskizze, keine Einbauanleitung. Plusleitungen durchgezogen, Minus gestrichelt, 230 V
            gepunktet.
          </text>
          <text x="30" y="560" fontSize="10" fontFamily="IBM Plex Mono, monospace" fill="currentColor">
            Werte: Planer-Vorlage „Großes Autark-Setup" — im Planer öffnen und an das eigene Fahrzeug
            anpassen.
          </text>
        </svg>
      </div>
      <figcaption
        id="beispiel-schaltplan-caption"
        className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-soft"
      >
        Prinzipskizze des Beispielplans: Drei Ladewege (Solar, Lichtmaschine, Landstrom) auf eine
        LiFePO4-Bordbatterie, Verteilung über Sammelschienen und Sicherungskasten, 230 V nur über den
        Wechselrichter. Die Skizze ersetzt keine Einbauanleitung; der 230-V-Teil gehört in die Hand einer
        Elektrofachkraft.
      </figcaption>
      <p className="mt-4">
        <Link
          href="/planer/?template=autark"
          className="inline-flex min-h-11 items-center font-medium text-ink underline underline-offset-2 hover:text-ink-soft"
        >
          Diesen Plan im Planer öffnen
        </Link>{' '}
        <span className="text-sm text-ink-soft">
          — die Vorlage „Großes Autark-Setup" liegt dann verkabelt auf der Zeichenfläche und lässt sich
          Bauteil für Bauteil an dein Fahrzeug anpassen.
        </span>
      </p>
    </figure>
  );
}
