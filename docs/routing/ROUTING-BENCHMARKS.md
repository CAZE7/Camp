# ROUTING-BENCHMARKS: Messergebnisse und Qualitätsmetriken

**Datum:** 2026-10-14  
**Verfasser:** Principal Routing Engineer  
**Testumgebung:** Vitest & TSX Engine Runtime, Node.js v22

---

## 1. Messungen auf den Golden-Master-Referenzplänen

Gemessen mit `scripts/routing/runRoutingBenchmark.ts` (Durchschnitt über 20 Iterationen nach Warmup):

| Referenzplan | Komponenten | Kanten | Laufzeit (ms) | Kabellänge (px) | Biegungen | Kreuzungen | I1 (Node) | I2 (Overlap) | I3 (Clearance) | Status    |
| ------------ | ----------- | ------ | ------------- | --------------- | --------- | ---------- | --------- | ------------ | -------------- | --------- |
| **simple**   | 7           | 9      | **6.03 ms**   | 2.665 px        | 26        | 2          | 0         | 0            | 0              | **VALID** |
| **camper**   | 9           | 12     | **8.55 ms**   | 3.677 px        | 28        | 8          | 0         | 0            | 0              | **VALID** |
| **solar**    | 8           | 11     | **3.40 ms**   | 3.200 px        | 18        | 4          | 0         | 0            | 0              | **VALID** |
| **inverter** | 8           | 10     | **7.49 ms**   | 3.710 px        | 22        | 4          | 0         | 0            | 0              | **VALID** |
| **acdc**     | 10          | 14     | **15.59 ms**  | 5.591 px        | 30        | 10         | 0         | 0            | 0              | **VALID** |
| **complex**  | 15          | 23     | **37.54 ms**  | 8.646 px        | 53        | 48         | 0         | 0            | 0              | **VALID** |

---

## 2. Skalierungsbenchmark (bis zu 100 Komponenten)

Gemessen in `tests/scale/plannerScale.test.ts`:

| Komponenten-Anzahl        | Verbindungen | Laufzeit                  | I1/I2/I3 Verletzungen | Status    |
| ------------------------- | ------------ | ------------------------- | --------------------- | --------- |
| **10 Knoten**             | ~ 8 Kanten   | ~ 3 ms                    | 0 / 0 / 0             | **VALID** |
| **25 Knoten**             | ~ 24 Kanten  | ~ 700 ms (inkl. AutoWire) | 0 / 0 / 0             | **VALID** |
| **50 Knoten** (Zielgröße) | ~ 50 Kanten  | ~ 4.7 s (inkl. AutoWire)  | 0 / 0 / 0             | **VALID** |
| **100 Knoten**            | ~ 100 Kanten | ~ 6.9 s (inkl. AutoWire)  | 0 / 0 / 0             | **VALID** |

---

## 3. Invarianten & Qualitätsgarantien

- **Determinismus:** 100% über alle Pläne. Identische Eingaben erzeugen byte-identische SVG-Pfade und Wegpunkte.
- **Idempotenz:** Wiederholte Ausführung ohne Änderungen modifiziert keine einzige Koordinate.
- **Translationsinvarianz:** Verschieben des gesamten Layouts um $(\Delta x, \Delta y)$ verschiebt alle Trassen exakt um diesen Vektor, ohne die Topologie zu stören (`shiftInvariance.test.ts`).
- **Garantie I1 (Bauteildurchquerung):** 0 Verletzungen (vollständig ausgeschlossen).
- **Garantie I2 (Überlappung):** 0 unzulässige kollineare Überdeckungen.
- **Garantie I3 (Mindestabstand):** 0 Abstandsverletzungen (Separationsgang schützt Trassen).
