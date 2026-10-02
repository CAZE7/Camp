/**
 * components/elektrik/electricContent.ts — Texte und Fachdaten der Seite
 * „Elektrik-Planung" an genau einer Stelle.
 *
 * Warum als Modul und nicht im JSX: Die Fragen und Antworten erscheinen
 * zweimal in unterschiedlicher Form — einmal sichtbar im Akkordeon und
 * einmal maschinenlesbar als `FAQPage`. Zwei getrennte Textquellen würden
 * unweigerlich auseinanderlaufen; hier ist die sichtbare Antwort dieselbe
 * Zeichenkette wie die strukturierte.
 */

/** Titel der Seite — bleibt innerhalb der üblichen Länge für Suchergebnisse. */
export const PAGE_TITLE = 'Camper Elektrik berechnen: 12V Kabelquerschnitt & Batterie-Planer';

/** Beschreibung der Seite für Inhaltsverzeichnisse und Vorschaukarten. */
export const PAGE_DESCRIPTION =
  'Wohnmobil-Elektrik präzise dimensionieren: Leitungsquerschnitt nach DIN berechnen, Batteriekapazität bestimmen und autarkes 12V-System sicher planen.';

/** Einleitungssatz unter der Überschrift. */
export const PAGE_LEAD =
  'Ob Kühlbox, Standheizung oder Wechselrichter: Jede 12-V-Leitung wird über Spannungsfall und Strombelastbarkeit dimensioniert und direkt an der Batterie abgesichert. Der Rechner liefert die Normgröße für deine Leitung, der Planer zeichnet daraus die vollständige 12-V- und 230-V-Anlage mit Stückliste.';

/** Merkmalsliste der Anwendung (maschinenlesbare Beschreibung, `WebApplication`). */
export const APPLICATION_FEATURES: readonly string[] = [
  'Leitungsquerschnitt nach Spannungsfall und Strombelastbarkeit berechnen',
  'Schaltplan für 12-V- und 230-V-Kreise zeichnen und automatisch verdrahten',
  'Leitungen automatisch absichern und gegen Überlast prüfen',
  'Stückliste mit Kabelquerschnitten, Sicherungen und Längen erzeugen',
  'Batterie- und Verbraucherbilanz für autarke Standzeiten abschätzen',
];

export type FaqEntry = {
  question: string;
  answer: string;
};

/**
 * Fachliche Fragen mit den Antworten, die auch das Akkordeon zeigt.
 *
 * Die Werte sind die des Modells: Spannungsfall-Grenze 3 % der Nennspannung
 * (0,36 V bei 12 V, `VOLTAGE_DROP_PCT_PLAN_LIMIT`), Kupfer-Leitfähigkeit
 * κ = 58 m/(Ω·mm²) bei 20 °C (`lib/materials.ts`), Entladetiefen je Chemie
 * (`VDE_BATTERY_DOD`), Schutzorgan innerhalb von 0,2 m ab der Quelle
 * (`FUSE_MAX_UNPROTECTED_LENGTH_M`, ISO 10133:2000 §8.1).
 */
export const ELEKTRIK_FAQ: readonly FaqEntry[] = [
  {
    question: 'Wie hoch darf der Spannungsabfall in einem 12-V-Kreis sein?',
    answer:
      'Der Rechner dimensioniert mit 3 % der Nennspannung, bei 12 V also mit 0,36 V. Für empfindliche Verbraucher wie Kompressor-Kühlschränke, Funkgeräte oder Laderegler sind 2 % (0,24 V, in Tabellen häufig auf 0,25 V gerundet) die bessere Zielmarke: Bei 10 A über 5 m Leitung ergibt die 3-%-Grenze 6 mm², die 2-%-Grenze bereits 10 mm². Beide Prozentwerte sind Planungsannahmen — DIN VDE 0298-4 nennt Strombelastbarkeiten, keine Spannungsfall-Grenzwerte.',
  },
  {
    question: 'Wie berechnet man den Kabelquerschnitt für Kupferleitungen?',
    answer:
      'Mit A = (2 · L · I) / (κ · ΔU): A ist der Querschnitt in mm², L die einfache Leitungslänge in Metern, der Faktor 2 steht für Hin- und Rückleitung, I der Betriebsstrom in Ampere, ΔU der zulässige Spannungsfall in Volt und κ die Leitfähigkeit des Leiters. Für Kupfer rechnet der Planer mit κ = 58 m/(Ω·mm²) bei 20 °C; ältere Tabellenwerke verwenden 56 m/(Ω·mm²), was den rechnerischen Querschnitt um knapp 4 % erhöht. Das Ergebnis wird immer auf die nächste Normgröße aufgerundet: 1,5 · 2,5 · 4 · 6 · 10 · 16 · 25 · 35 · 50 · 70 mm².',
  },
  {
    question: 'Wie tief dürfen LiFePO4- und AGM-Batterien entladen werden?',
    answer:
      'LiFePO4 bis 90 % Entladetiefe, AGM und Gel bis 50 %, Nassblei bis 30 %. Aus einer 100-Ah-Batterie werden damit 90 Ah (LiFePO4) beziehungsweise 50 Ah (AGM) nutzbare Kapazität. Der Planer hinterlegt diese Entladetiefen je Chemie und rechnet zusätzlich den Peukert-Effekt: Bei hohen Strömen sinkt die entnehmbare Kapazität weiter, weshalb die nutzbare Kapazität nicht allein aus der Nennkapazität folgt.',
  },
  {
    question: 'Wo muss die Sicherung in der 12-V-Anlage sitzen?',
    answer:
      'Unmittelbar am Pluspol der Batterie, vor der ersten ungeschützten Leitungsstrecke. Der Planer prüft 0,2 m ab der Quelle (ISO 10133:2000 §8.1); DIN VDE 0100-721 verlangt den Überstromschutz nahe der Batterie, ohne eine Länge zu nennen. Die Sicherung schützt die Leitung, nicht das Gerät: Ihre Größe folgt der Belastbarkeit des Querschnitts — im Modell 70 % der Tabellenwerte nach DIN VDE 0298-4, Verlegeart B2 — und nicht dem Verbraucher.',
  },
];
