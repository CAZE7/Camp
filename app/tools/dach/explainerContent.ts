import type { FaqEntry } from '@/lib/seo/types';

/**
 * app/tools/dach/explainerContent.ts — der erklärende Text des Dach-Planers.
 *
 * Warum die Texte hier und nicht in der Client-Komponente stehen: Sie werden an
 * zwei Stellen gebraucht — sichtbar unter dem Werkzeug (`page.tsx`) und als
 * `FAQPage` in der strukturierten Beschreibung (`layout.tsx`, Server-Seite).
 * Zwei Kopien derselben Frage wären zwei Gelegenheiten, sie unterschiedlich zu
 * formulieren; die Export-Prüfung vergleicht Frage und Antwort Zeichen für
 * Zeichen mit dem sichtbaren Akkordeon und würde den Unterschied melden.
 *
 * Jede Aussage stammt aus dem Code dieses Werkzeugs, nicht aus einem
 * Datenblatt: Abstände aus `validation.ts` (SAFE_MARGINS), Maße aus
 * `lib/vehicleTemplates.ts`, die Voreinstellungen aus `page.tsx` (100 × 60 cm,
 * 200 W) und der Weg der Watt-Summe aus dem Store (`calculatedSolarWatts`,
 * angezeigt als „Ladeleistung (Dach)“ im Batterie-Inspector). Bewusst KEINE
 * Ertragsprognose und keine Panel-Empfehlung — beides leistet das Werkzeug
 * nicht.
 */

/** Die Voreinstellungen, die der Planer für ein neues Panel setzt. */
export const DACH_PANEL_DEFAULTS = { watts: 200, widthCm: 100, heightCm: 60 } as const;

/** Sicherheitsabstände in Zentimetern — Spiegel von `SAFE_MARGINS`. */
export const DACH_SAFE_MARGINS_CM = { front: 15, rear: 5, left: 5, right: 5 } as const;

export const DACH_EXPLAINER_BLOCKS = [
  {
    id: 'nutzbare-flaeche',
    heading: 'Welche Fläche als Dach zählt',
    body: [
      'Der Planer belegt nicht das Fahrzeug, sondern die nutzbare Dachfläche aus der Fahrzeugvorlage. Beim Ducato/Boxer/Jumper L2H2 sind das 3,12 m in der Länge und 1,40 m in der Breite — 4,4 m² Rechteckfläche. Diese Zahl steht sichtbar in der Seitenleiste, sobald du ein Fahrzeug wählst, und ist die Fläche, gegen die jede Platzierung geprüft wird.',
      'Die Zeichenfläche rechnet im Maßstab 1 cm = 2 px. Was du verschiebst, ist deshalb immer eine Länge in Zentimetern — nicht ein Anteil der Zeichenfläche. Ein Panel, das du größer ziehst, braucht auch real mehr Dach.',
    ],
  },
  {
    id: 'sicherheitsabstand',
    heading: 'Was als „außerhalb“ gilt: 15 cm vorne, 5 cm an den anderen Kanten',
    body: [
      'Der Planer prüft gegen einen sicheren Bereich, nicht gegen die rohe Dachfläche: vorne bleiben 15 cm frei, hinten, links und rechts je 5 cm. Ein Panel, das bis an die Kante reicht, liegt damit außerhalb — auch wenn es auf dem Dach „passen“ würde.',
      'Ragt ein Element darüber hinaus, färbt der Planer es rot und nennt in der Seitenleiste die Kante und den Überstand in Zentimetern („ragt 6 cm über die vordere Kante“). Zusätzlich prüft er paarweise auf Überlappung: Zwei Panels dürfen sich nicht schneiden, ein Panel darf nicht über einer Dachluke liegen.',
    ],
  },
  {
    id: 'watt-summe',
    heading: 'Was die Gesamt-Watt-Zahl bedeutet — und was nicht',
    body: [
      'Die angezeigte Summe ist die Nennleistung der platzierten Module. Das ist eine Additionsaufgabe, keine Ertragsprognose: Einstrahlung, Ausrichtung, Verschattung durch Luken oder Reling, Reglerwirkungsgrad und die Modultemperatur stecken nicht in der Zahl.',
      'Für die weitere Planung ist die Nennsumme trotzdem die richtige Größe. Sie wird in den Schaltplan übernommen und erscheint am Batterie-Baustein als „Ladeleistung (Dach)“; daraus schätzt der Inspector die Ladezeit.',
    ],
  },
] as const;

export const DACH_FAQ: readonly FaqEntry[] = [
  {
    question: 'Warum gilt mein Panel als außerhalb, obwohl es auf das Dach passt?',
    answer:
      'Weil der Planer gegen den sicheren Bereich prüft, nicht gegen die ganze Dachfläche: vorne bleiben 15 cm frei, hinten, links und rechts je 5 cm. Ein Panel, das bis an die Kante reicht, ragt in diesen Streifen. Der Hinweis in der Seitenleiste nennt die betroffene Kante und den Überstand in Zentimetern.',
  },
  {
    question: 'Welche Maße trage ich für ein Solarpanel ein?',
    answer:
      'Die Maße aus dem Datenblatt deines Panels. Voreingestellt sind 100 × 60 cm bei 200 W; Breite, Höhe und Nennleistung lassen sich pro Element ändern. Der Planer rechnet in Zentimetern, deshalb sind die echten Abmessungen die richtige Eingabe — die Watt-Zahl brauchst du zusätzlich für die Gesamtleistung.',
  },
  {
    question: 'Landet die Solarleistung im Schaltplan?',
    answer:
      'Ja. Die Summe der Nennleistungen aller platzierten Panels wird als Ladeleistung übernommen und im Schaltplan am Batterie-Baustein als „Ladeleistung (Dach)“ angezeigt. Deshalb lohnt es, die Watt-Angabe je Panel zu pflegen und nicht nur die Fläche zu belegen.',
  },
  {
    question: 'Rechnet der Planer den Solarertrag im Winter?',
    answer:
      'Nein. Ausgegeben wird die Nennleistung der Module, keine Ertragsprognose: Einstrahlung, Ausrichtung, Verschattung und Reglerwirkungsgrad stecken nicht in der Zahl. Wie man die Auslegung für schwache Einstrahlung angeht, steht im Thema Camper-Solar.',
  },
];
