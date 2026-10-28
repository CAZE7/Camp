import { FaqAkkordeon } from '@/components/elektrik/FaqAkkordeon';
import type { FaqEntry } from '@/lib/seo/types';

/**
 * components/seo/ToolExplainer.tsx — der erklärende Teil unter einem Werkzeug.
 *
 * Warum es diese Komponente gibt: `/tools/dach/` und `/tools/heizung/` waren
 * die einzigen Seiten der Auslieferung ohne eine einzige Zwischenüberschrift
 * (gemessen 2026-10-27: 243 bzw. 472 Wörter, 0 × h2). Der eigene Befund vom
 * Relaunch gilt für sie unverändert: „Das Problem war nicht die Technik,
 * sondern die Sprache" (`docs/seo/ANALYSE-UND-VISION.md`). Beide Seiten sind
 * Client-Komponenten — der Text stand dort nirgends, weil das Werkzeug den
 * ganzen Bildschirm füllt, nicht weil er unerwünscht wäre.
 *
 * Aufbau: ein H2-Block mit dem Rechenmodell (H3 je Frage, Antwort zuerst),
 * darunter ein eigener H2-Block „Häufige Fragen …". Die Trennung ist keine
 * Kosmetik: Die Export-Prüfung findet den FAQ-Block über eine `<section>`,
 * deren H2 mit „Häufige Fragen" beginnt (`scripts/seo/checks.ts`), und
 * vergleicht Frage und Antwort Zeichen für Zeichen mit dem JSON-LD. Läge die
 * FAQ unter dem H2 des Erklärblocks, wäre beides nicht auffindbar.
 *
 * Kein Zustand, kein Effekt: Der Text ist Teil des vorgerenderten HTML und
 * steht ohne JavaScript. Die Komponente wird von Client-Seiten importiert und
 * deshalb mitbündelt — sie bringt aber kein Byte Logik mit.
 */
export type ToolExplainerBlock = {
  /** Fragment-Kennung des Abschnitts (Ankerziel). */
  id: string;
  /** Überschrift als Frage — darunter steht die Antwort, nicht der Kontext. */
  heading: string;
  body: readonly string[];
};

export type ToolExplainerProps = {
  /** Versalien über der Überschrift (Thema // Einordnung). */
  kicker: string;
  /** Die eine H2 des Erklärblocks. */
  title: string;
  /** Ein bis zwei Sätze: was hier erklärt wird und was nicht. */
  intro: string;
  blocks: readonly ToolExplainerBlock[];
  /** Überschrift des Fragenblocks — muss mit „Häufige Fragen" beginnen. */
  faqTitle: string;
  faq: readonly FaqEntry[];
};

export function ToolExplainer({ kicker, title, intro, blocks, faqTitle, faq }: ToolExplainerProps) {
  return (
    <div className="border-t border-rule bg-paper">
      <div className="mx-auto max-w-3xl px-5 py-12">
        <section aria-labelledby="werkzeug-hintergrund" className="scroll-mt-20">
          <p className="kicker">{kicker}</p>
          <h2 id="werkzeug-hintergrund" className="h2 mt-2">
            {title}
          </h2>
          <p className="prose-measure mt-4 text-base leading-relaxed text-ink-soft">{intro}</p>

          <div className="mt-8 space-y-8">
            {blocks.map((block) => (
              <section key={block.id} id={block.id} className="scroll-mt-20">
                <h3 className="h3">{block.heading}</h3>
                {block.body.map((paragraph, index) => (
                  <p key={index} className="prose-measure mt-3 text-base leading-relaxed text-ink-soft">
                    {paragraph}
                  </p>
                ))}
              </section>
            ))}
          </div>
        </section>

        <section aria-labelledby="werkzeug-fragen" className="mt-12 scroll-mt-20">
          <h2 id="werkzeug-fragen" className="h2">
            {faqTitle}
          </h2>
          <div className="mt-4">
            <FaqAkkordeon entries={faq} />
          </div>
        </section>
      </div>
    </div>
  );
}
