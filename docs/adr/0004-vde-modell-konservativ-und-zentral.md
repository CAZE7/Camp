# ADR 0004 — VDE-Modell: konservativ, zentral, typsicher

**Status:** angenommen · **Datum:** 2026-08 (erweitert in K1/K2)

## Kontext

Die Anwendung schlägt Kabelquerschnitte und Sicherungen vor. Das ist
sicherheitsrelevant: eine zu große Sicherung schützt das Kabel nicht, ein zu
kleiner Querschnitt wird heiß. Gleichzeitig ist das Publikum kein
Fachpublikum — die Vorschläge müssen auf der sicheren Seite liegen.

## Entscheidung

1. **Eine Quelle je Norm-Tabelle.** `lib/electrical.ts` hält die thermische
   Basis (`VDE_SIZES`, `VDE_AMPACITY`, `FUSE_MAP`, `DERATE_FACTOR`),
   `lib/vde-standards.ts` die erweiterten Werte (Spannungsfall, Leerrohr,
   Wirkungsgrade). Ein Konsistenztest (`lib/vde-consistency.test.ts`)
   verhindert, dass Magic Numbers zurückwandern.
2. **Konservative Annahmen.** Derating 0.70, ρ(Kupfer) = 0.0175 Ω·mm²/m,
   Wechselrichter-Wirkungsgrad 0.85, Spannungsfall-Ziel 3 % im DC-Pfad.
3. **Sicherung schützt das Kabel, nicht das Gerät.** `selectFuseSize` gibt
   niemals einen Wert über `FUSE_MAP[Querschnitt]` zurück. Trägt selbst die
   größte zulässige Sicherung den Nennstrom nicht, wird der Querschnitt
   erhöht — nicht die Sicherung.
4. **Typsichere Einheiten.** Seit K1 sind Watt, Ampere, Volt, mm², Meter und
   Millivolt Branded Types (`lib/units.ts`). Vertauschte Argumente sind
   Compilezeit-Fehler.
5. **Gesetze statt Beispiele.** Seit K2 sichern Property-Tests die Regeln
   (Sandwich, Monotonien, Idempotenz, AC/DC-Trennung) über 1.000 Fälle je
   Gesetz ab.

## Konsequenzen

**Gut**

- Auslegung und Live-Validierung rechnen mit denselben Werten; „Sicherung zu
  klein“-Widersprüche zwischen Auto-Wire und Prüfung sind ausgeschlossen.
- Falsche Einheiten kompilieren nicht.
- Unbrauchbare gespeicherte Werte (negativ, NaN, Text) werden an benannten
  Grenzen abgefangen statt als `NaN` durch die Rechnung zu laufen.

**Schlecht / Preis**

- Konservative Werte führen gelegentlich zu einem größeren Querschnitt als
  nötig — bewusst in Kauf genommen.
- Zwei Tabellensätze (thermisch vs. Validierung) sind erklärungsbedürftig;
  der Konsistenztest hält sie zusammen.
- Das Modell ist eine Vereinfachung auf den Camper-Anwendungsfall. Es ersetzt
  keine Fachplanung; der Hinweis darauf gehört in die Oberfläche.

## Alternativen

- **Vollständige VDE-Implementierung mit Verlegearten, Häufung und
  Umgebungstemperatur:** genauer, aber für die Zielgruppe unbedienbar.
- **Keine Empfehlung, nur Dokumentation:** ehrlicher, nimmt der Anwendung
  aber ihren Zweck.
