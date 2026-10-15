# ROUTING-ARCHITECTURE: Die globale hybride Routing-Engine

**Datum:** 2026-10-14  
**Status:** In Umsetzung / Produktionsreif  
**Komponenten-Zielgröße:** Pläne mit bis zu 50 elektrischen Komponenten

---

## 1. Systemübersicht

Die Routing-Engine ist eine zustandslose, pure TypeScript-Pipeline. Sie nimmt ein normalisiertes Modell aus Komponenten (Nodes) und elektrischen Verbindungen (Edges) entgegen und erzeugt deterministische, kollisionsfreie, orthogonale Trassenverläufe.

```text
┌────────────────────────────────────────────────────────┐
│              Normalisiertes Eingabemodell               │
│        (PlannerNodes, RouteEdgeRefs, Constraints)       │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│            Phase 1: Port- & Stub-Planung                │
│    - Bündel-Identifikation je Port (PortFanOut)        │
│    - Deterministische Lane-Staffelung (16 px Grid)     │
│    - Hindernis-Freigabe-Kappung (StubCap)               │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│            Phase 2: Initiales Detail-Routing            │
│    - Hanan-Grid & A*-Suche mit Sperrflächen (Tubes)    │
│    - Fixierte Routen (Locked Snapshot) bleiben starr    │
│    - Dynamische Hindernisfenster (Bounding-Box)        │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│      Phase 3: Globale Konfliktoptimierung (RRR)        │
│    - Konflikt-Analyse (Kreuzungen, Engpässe, Umwege)   │
│    - Deterministische Auswahl konfliktträchtiger Kanten│
│    - Iteratives Rip-Up & Re-Route (Budget-limitiert)   │
│    - Nur strikte Verbesserungen werden übernommen      │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│          Phase 4: Geometrisches Postprocessing         │
│    - Nudge-Engine (Auflösen paralleler Überdeckungen)  │
│    - Bend-Merge (Treppenmuster-Beseitigung für I7)     │
│    - Clearance-Separation (Garantie für I3)            │
│    - Hop-Berechnung (Bögen an echten Kreuzungen)       │
│    - Label-Chip-Platzierung (Clear of Nodes & Labels)  │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│            Phase 5: Validierung & Publikation           │
│    - Mathematische Prüfung: I1, I2, I3, I4, I5, I6, I7  │
│    - Atomare Publikation im Store                      │
│    - Status: VALID / INVALID / CONVERGED               │
└────────────────────────────────────────────────────────┘
```

---

## 2. Mathematisches Modell & Invarianten

### Ebene 1: Unverhandelbare Bedingungen (Harte Invarianten)

- **I1 (Hindernisfreiheit):** Kein Kabelsegment schneidet ein fremdes Bauteilrechteck.
  $$\forall s \in \text{Segments}(e), \forall B \in \text{Obstacles} \setminus \{B_{\text{src}}, B_{\text{tgt}}\}: s \cap B = \emptyset$$
- **I2 (Keine Überlappung):** Kein Kabelsegment überdeckt ein anderes Kabelsegment kollinear mit Länge $> 0$, außer im definierten Port-Bündel-Bereich.
  $$\forall e_1 \neq e_2: \text{Overlap}(e_1, e_2) = 0$$
- **I3 (Mindestabstand / Clearance):** Jedes Segment hält mindestens `cableClearance` (12 px) zu unbeteiligten Bauteilen und fremden Kabeln ein (außerhalb der Port-Zonen).
  $$\text{Dist}(s, B) \ge c_{\text{clearance}}, \quad \text{Dist}(s_1, s_2) \ge c_{\text{clearance}}$$
- **I4 (Kein Handle-U-Turn):** Keine 180°-Kehre direkt am Anschluss.
- **I5 (Mindest-Stub):** Erstes und letztes Segment halten die geforderte Ausklinklänge `stubMin` ein.
- **I6 (Mindest-Segmentlänge):** Segmente sind mindestens `segmentMin` (16 px) lang.
- **I7 (Treppen-Eliminierung):** Keine redundanten Doppel-Biegungen auf engstem Raum.

### Ebene 2: Globale Zielfunktion

Für einen Plan $\mathcal{P} = \{e_1, \dots, e_n\}$ minimiert die Engine die Kostenfunktion:
$$\mathcal{C}(\mathcal{P}) = \sum_{e \in \mathcal{P}} \left( \text{Länge}(e) + w_{\text{bend}} \cdot \text{Biegungen}(e) \right) + w_{\text{cross}} \cdot \text{Kreuzungen}(\mathcal{P}) + w_{\text{conflict}} \cdot \text{Konflikte}(\mathcal{P})$$
mit den Tokens:

- $w_{\text{bend}} = 80\,\text{px}$
- $w_{\text{cross}} = 120\,\text{px}$
- $w_{\text{conflict}} = 1000\,\text{px}$

---

## 3. Deterministisches Rip-Up-and-Reroute (RRR)

Das RRR-Verfahren verhindert das gierige Festfahren der sequenziellen Suche:

1. **Konflikterkennung:** Nach dem initialen Routing werden Kanten identifiziert, die Kreuzungen mit hoher Priorität oder ungünstige Ausweichwege verursachen.
2. **Kandidaten-Ranking:** Sortierung nach berechnetem Konflikt-Score (absteigend) mit striktem Tie-Breaker (`compareIds`).
3. **Neu-Routing im Kontext:** Kanten werden einzeln herausgenommen. Die verbleibenden Kanten dienen als dynamische Sperrkörper. Die Kante sucht einen alternativen Trassenverlauf.
4. **Akzeptanzkriterium:** Eine alternative Trasse wird **nur** akzeptiert, wenn:
   - Alle harten Invarianten (I1–I3) erfüllt bleiben,
   - Der globale Gesamtscore $\mathcal{C}(\mathcal{P})$ streng sinkt.
5. **Budgetierung:** Maximal 2 Iterationsrunden über die Top-Konfliktkanten. Dadurch bleibt die Laufzeit garantiert unter 30 ms auf 50-Komponenten-Plänen.
