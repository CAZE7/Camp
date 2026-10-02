import Link from 'next/link';

import Planner from '../../components/Planner';
import { JsonLd } from '@/components/seo/JsonLd';
import { FAQS, jsonLdGraph, pageMetadata } from '@/lib/seo/pages';

export const metadata = pageMetadata('/elektrik-planung');

/**
 * Der Canvas ist client-only (`components/Planner.tsx:7`, `ssr: false`) —
 * React Flow braucht ein Window. Dieser Abschnitt liegt außerhalb des Canvas
 * und trägt die Fachbegriffe der Route in das ausgelieferte HTML.
 *
 * Jede Zahl hier ist dem Code entnommen: `lib/units.ts:465`
 * (A = I · 2L / (κ · ΔU)), `lib/materials.ts:39` (ρ Kupfer = 0,0175 Ω·mm²/m),
 * `lib/electrical.ts:404-408` (ΔU-Stufen 1/3/4 %, dokumentiert als
 * Planungsannahme ohne Normzitat), `AGENTS.md` §4.3 (I_B ≤ I_n ≤ I_z).
 */
export default function ElektrikPlanung() {
  const faq = FAQS['/elektrik-planung'] ?? [];

  return (
    <main id="main" className="relative flex min-h-0 w-full flex-1 flex-col bg-paper font-sans">
      <JsonLd graph={jsonLdGraph('/elektrik-planung')} />
      <Planner />

      <article className="container-page prose-measure border-t border-rule py-12">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink md:text-2xl">
          Camper-Elektrik planen: Kabelquerschnitt, Sicherung und Spannungsfall im 12-V-Bordnetz
        </h1>
        <p className="mt-3 text-base text-ink-soft">
          Der Werft-Planer ist ein Zeichenwerkzeug für die 12-V- und 230-V-Anlage im Kastenwagen. Du setzt
          Bauteile, verbindest sie zu Kabeln und siehst an jeder Leitung, welcher Querschnitt, welche
          Sicherung und welcher Spannungsfall daraus folgt — bis zur Stückliste für den Einkauf.
        </p>

        <h2 className="panel-title mt-8">1. Leitungsquerschnitt berechnen: Formel und Dimensionierung</h2>
        <p className="mt-3 text-sm text-ink-soft">
          Der Querschnitt ergibt sich aus Strom, Kabellänge und dem Spannungsfall, den du zulassen willst:
        </p>
        <p className="mt-3 border border-rule bg-bone px-4 py-3 font-mono text-sm text-ink">
          A = I · 2L / (κ · ΔU)
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-ink-soft">
          <li>
            <strong className="font-medium text-ink">I</strong> — Strom der Leitung in Ampere.
          </li>
          <li>
            <strong className="font-medium text-ink">2L</strong> — einfache Länge mal zwei, denn Hin- und
            Rückleitung fallen zusammen.
          </li>
          <li>
            <strong className="font-medium text-ink">κ</strong> — Leitwert des Kupfers. Aus dem im Projekt
            hinterlegten spezifischen Widerstand ρ = 0,0175 Ω·mm²/m folgt κ ≈ 57.
          </li>
          <li>
            <strong className="font-medium text-ink">ΔU</strong> — zulässiger Spannungsfall in Volt.
          </li>
        </ul>
        <p className="mt-4 text-sm text-ink-soft">
          Beispiel: 20 A über 5 m bei 0,36 V zulässigem Fall — das sind 3 % von 12 V — ergeben A = 20 · 10 /
          (57 · 0,36) ≈ 9,7 mm², also die nächste gängige Größe 10 mm².
        </p>

        <h3 className="mt-6 text-base font-semibold text-ink">Zulässiger Spannungsabfall im 12-V-Bordnetz</h3>
        <p className="mt-2 text-sm text-ink-soft">
          Der Planer ordnet jede Leitung in Stufen ein: bis 1 % Zielband, bis 3 % Planungsgrenze, darüber
          Verstoß, über 4 % kritisch. Diese Schwellen sind Planungsannahmen von Werft und als solche im Code
          dokumentiert. Eine Spannungsfallgrenze aus einer Norm lässt sich daraus nicht ableiten — die
          Stromtragwert-Tabelle steht in DIN VDE 0298-4, Spannungsfallgrenzen kennt sie nicht.
        </p>

        <h2 className="panel-title mt-8">2. Was der Planer außerdem je Kabel ausweist</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-ink-soft">
          <li>
            <strong className="font-medium text-ink">Sicherungsgröße</strong> — mit demselben Derating-Faktor
            wie die Stromtragwert-Betrachtung, damit die Kette I_B ≤ I_n ≤ I_z hält: Der Leitungsstrom bleibt
            unter dem Nennwert der Sicherung, und die Sicherung löst innerhalb dessen aus, was die Leitung
            dauerhaft trägt.
          </li>
          <li>
            <strong className="font-medium text-ink">Warnliste nach Severity</strong> — zum Beispiel
            Polarität, domänenübergreifende Verbindungen zwischen 12 V und 230 V oder fehlende
            Sicherungsangaben.
          </li>
          <li>
            <strong className="font-medium text-ink">Stückliste</strong> — alle gesetzten Bauteile mit ihren
            Werten als Liste für den Einkauf.
          </li>
        </ul>

        <h2 className="panel-title mt-8">3. Reihenfolge, die sich bewährt</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-ink-soft">
          <li>
            Erst den <Link href="/guides/ausbau-fahrplan">Ausbau-Fahrplan</Link> lesen — Elektrik vor Boden
            und Wänden verlegen, sonst wird jedes Kabel zum Rückbau.
          </li>
          <li>
            Die <Link href="/tools/dach">Dachfläche planen</Link>: Die Solarleistung bestimmt, wie groß
            Laderegler und Batteriebank dimensioniert werden müssen.
          </li>
          <li>Verbraucher setzen, Massepunkte und Sammelschienen verbinden, automatisch verdrahten.</li>
          <li>
            Die <Link href="/tools/heizung">Heizlast prüfen</Link> — der Strombedarf von Gebläse und
            Steuergerät landet im Bordnetz.
          </li>
        </ol>

        <h2 className="panel-title mt-8">4. Häufige Fragen</h2>
        <div className="mt-3 divide-y divide-rule border border-rule bg-bone">
          {faq.map((entry) => (
            <details key={entry.question} className="px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oxide">
                <h3 className="inline">{entry.question}</h3>
              </summary>
              <p className="mt-2 text-sm text-ink-soft">{entry.answer}</p>
            </details>
          ))}
        </div>

        <p className="caption-xs mt-8 text-ink-soft">
          Die Berechnungen sind Näherungen für die Planung und ersetzen keine Elektrofachkraft. Anlagen mit
          Wechselrichter, Landstrom oder mehr als einer Batteriebank gehören vor der Inbetriebnahme durch
          qualifiziertes Personal geprüft.
        </p>
      </article>
    </main>
  );
}
