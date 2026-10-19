import Link from 'next/link';

import { pageByPath } from '@/lib/seo/inventory';

/**
 * app/tools/heizung/HeizungErklaerung.tsx — der erklärende Text unter dem Werkzeug.
 *
 * Der Heizlast-Rechner war bis jetzt ein Formular mit einem Ergebnis: Zahlen
 * rein, Kilowatt raus. Wer nicht nachrechnet, kann die Zahl weder prüfen noch
 * begründet nachvollziehen — und genau das ist bei einer Heizungs-Auslegung
 * der Unterschied zwischen „passt schon" und „weiß warum".
 *
 * Der Text erklärt deshalb den Rechenweg des Werkzeugs, nicht die Heizung im
 * Allgemeinen: welche Eingabe wofür eingeht, welche Formel dahintersteht und
 * welche Vereinfachungen das Modell enthält. Alle Zahlen stammen aus dem
 * Werkzeug (`app/tools/heizung/page.tsx`): die U-Werte aus dem Dämmmodell, der
 * Luftwechsel aus der Fensterfläche, der Zuschlag der Option „Schnellheizung".
 * Das Beispiel ist mit den Werten des Rechners nachgerechnet.
 */

const SEITE = pageByPath('/tools/heizung/');

export function HeizungErklaerung() {
  return (
    <section aria-labelledby="heizung-erklaerung" className="w-full border-t border-rule bg-paper">
      <div className="mx-auto w-full max-w-3xl px-5 py-10 md:py-12">
        <p className="label-eyebrow text-copper">Werkzeug erklärt</p>
        <h2 id="heizung-erklaerung" className="mt-2 font-display text-xl font-semibold text-ink">
          Der Heizlast-Rechner: Wärmeverluste, Dämmung und Heizleistung
        </h2>

        <div className="mt-4 space-y-3 text-md leading-relaxed text-ink-soft">
          <p>
            Antwort zuerst: Ein Camper braucht so viel Heizleistung, wie er im Betrieb verliert — durch die
            Hülle und durch die Luft, die du tauschst. Der Rechner rechnet genau diese beiden Wege nach und
            vergleicht das Ergebnis mit den Geräten im Katalog. Er liefert damit eine begründete Empfehlung
            statt einer Erfahrungszahl.
          </p>
        </div>

        <h3 className="mt-8 text-lg font-semibold text-ink">Die zwei Verlustwege</h3>
        <div className="mt-3 space-y-3 text-md leading-relaxed text-ink-soft">
          <p>
            <span className="font-medium text-ink">Transmission</span>: Wärme geht durch Dach, Wände, Boden
            und Fenster nach außen. Je schlechter die Dämmung und je größer die Fläche, desto mehr Leistung
            muss die Heizung nachliefern. Das ist der Weg, den die Dämmung direkt beeinflusst — und der Grund,
            warum sie im Camper-Ausbau so früh wie möglich kommt.
          </p>
          <p>
            <span className="font-medium text-ink">Lüftung</span>: Jede Stunde wird ein Teil der Innenluft
            ausgetauscht. Der Rechner leitet den Luftwechsel aus der Fensterfläche ab und rechnet ihn als
            zweiten Verlustweg — bei geschlossenen Fenstern und laufender Lüftung ist er zu hoch angesetzt,
            beim Fahren mit offenen Fenstern zu niedrig.
          </p>
        </div>

        <h3 className="mt-8 text-lg font-semibold text-ink">U-Wert und Transmission</h3>
        <div className="mt-3 space-y-3 text-md leading-relaxed text-ink-soft">
          <p>
            Der Rechner rechnet nicht mit einem gemessenen U-Wert deines Fahrzeugs, sondern mit deinen
            Eingaben: Dämmstärke, dem Anteil der gedämmten Fläche und der Fensterfläche. Daraus bildet er
            einen Mischwert über die gesamte Außenfläche. Im Modell steht eine ungedämmte Blechfläche bei 5,88
            W/(m²·K), eine mit 19 mm Armaflex gedämmte Fläche bei 1,43 W/(m²·K) und eine Fensterfläche bei 3,0
            W/(m²·K).
          </p>
          <p>
            Der Verlustweg daraus ist die Standardformel der Transmission:{' '}
            <span className="font-mono text-ink">Q̇_T = U · A · ΔT</span> — U-Wert mal Fläche mal
            Temperaturdifferenz. Je höher der Mischwert, desto größer der Verlust. Genau deshalb ist die
            Dämmstärke im Rechner keine Kosmetik: Sie bewegt die empfohlene Heizleistung unmittelbar.
          </p>
        </div>

        <h3 className="mt-8 text-lg font-semibold text-ink">Lüftung</h3>
        <div className="mt-3 space-y-3 text-md leading-relaxed text-ink-soft">
          <p>
            Der Luftverlust rechnet sich aus Volumen, Luftwechsel und Temperaturdifferenz:{' '}
            <span className="font-mono text-ink">Q̇_L = n · V · 0,34 Wh/(m³·K) · ΔT</span>. Der Faktor 0,34
            Wh/(m³·K) ist die Wärmekapazität der Luft, <span className="font-mono text-ink">n</span> der
            Luftwechsel pro Stunde. Im Modell startet er bei 0,5 und steigt mit der Fensterfläche — bis
            maximal 1,0. Heizlast und Lüftung hängen also direkt aneinander: mehr Fenster bedeuten mehr
            Wärmeverlust, aber auch mehr frische Luft.
          </p>
        </div>

        <h3 className="mt-8 text-lg font-semibold text-ink">Beispielrechnung</h3>
        <div className="mt-3 space-y-3 text-md leading-relaxed text-ink-soft">
          <p>
            Ducato L1H1, 20 °C innen und −10 °C draußen, also ΔT = 30 K. Mit 19 mm Dämmung auf 70 % der Fläche
            und 1,5 m² Fenster ergeben sich 8,29 m³ Innenvolumen und 25,06 m² Außenfläche. Daraus folgen rund
            2 090 W Transmissionsverlust und 55 W Lüftungsverlust — zusammen etwa{' '}
            <span className="font-medium text-ink">2,1 kW</span>.
          </p>
          <p>
            Zum Vergleich: Ohne Dämmung liegt derselbe Wagen bei rund 4,3 kW. In diesem Beispiel halbiert die
            Dämmung die Verlustleistung also etwa. Mit der Option „Schnellheizung" rechnet der Rechner 30 %
            obendrauf, weil ein Heizgerät dann schneller auf Temperatur bringen soll — das wären hier rund 2,8
            kW.
          </p>
        </div>

        <h3 className="mt-8 text-lg font-semibold text-ink">Was das Ergebnis bedeutet</h3>
        <div className="mt-3 space-y-3 text-md leading-relaxed text-ink-soft">
          <p>
            Der Rechner vergleicht die gerechnete Last mit den Geräten im Katalog und empfiehlt das kleinste,
            das die Last deckt. Ein 2-kW-Heizer passt im Beispiel gerade; ein 5-kW-Gerät wäre
            überdimensioniert, verbraucht im Teillastbetrieb mehr, als es kostet, und nimmt mehr Platz und
            mehr Abstand in Anspruch. Nach der Auslegung im Fahrzeug fragt die Empfehlung nicht — das bleibt
            Sache der Fachfirma und der Fahrzeugzulassung.
          </p>
        </div>

        <h3 className="mt-8 text-lg font-semibold text-ink">Grenzen</h3>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-md text-ink-soft">
          <li>
            Wärmebrücken, Blechflächen ohne Dämmung und undichte Fenster sind nicht abgebildet — das Ergebnis
            ist eine Rechnung, keine Messung.
          </li>
          <li>
            Der Luftwechsel ist eine Annahme aus der Fensterfläche, kein gemessener Wert. Wer dauerhaft
            lüftet, liegt anders.
          </li>
          <li>
            Der Rechner sagt nichts über die elektrische Versorgung des Heizgeräts aus: Leitung, Sicherung und
            Ladung gehören in den Schaltplan.
          </li>
        </ul>

        <h3 className="mt-8 text-lg font-semibold text-ink">Weiter im Schaltplan</h3>
        <div className="mt-3 space-y-3 text-md leading-relaxed text-ink-soft">
          <p>
            Die Heizung ist im Ausbau ein Verbraucher wie jeder andere: Sie braucht eine Leitung mit passendem
            Querschnitt, eine Sicherung und Platz in der Energiebilanz. Diese Seite rechnet die Leistung, der{' '}
            <Link href="/planer/" className="font-medium text-ink underline-offset-2 hover:underline">
              Camper-Elektroplaner
            </Link>{' '}
            rechnet die Verdrahtung. Wie beides in die Reihenfolge des Ausbaus gehört, zeigt der{' '}
            <Link
              href="/guides/ausbau-fahrplan/"
              className="font-medium text-ink underline-offset-2 hover:underline"
            >
              Ausbau-Fahrplan
            </Link>
            , die Grundlagen der Anlage stehen im{' '}
            <Link
              href="/camper-elektrik/"
              className="font-medium text-ink underline-offset-2 hover:underline"
            >
              Elektrik-Hub
            </Link>
            .
          </p>
        </div>

        {SEITE?.contentRevision && (
          <p className="mt-8 text-sm text-ink-soft">Inhaltlicher Stand: {SEITE.contentRevision}.</p>
        )}
      </div>
    </section>
  );
}
