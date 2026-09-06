# ARCHITECTURE-CHANGES — Change Ledger

> Revisionssicheres Verzeichnis aller Architekturentscheidungen und -änderungen
> von CAMP/Routing V2. **Konvention:** Architektur-Änderungen (Schichtenmodell,
> Contract-Prinzipien, eingefrorene Spec `docs/ROUTING-V2.md`, Routing-Regelwerk)
> nur mit Eintrag hier + ggf. neuer ADR in `docs/adr/`. PRs ohne Ledger-Eintrag,
> die den Contract berühren, werden abgelehnt (Review-Checkliste in
> `docs/ARCHITECTURE-V2.md` §2).

Format: neueste Einträge oben. Jeder Eintrag: Datum, Bezug (ADR/WP/Issue), Kurzbegründung.

---

## 2026-09-06

- **ADR-0007** React Flow bleibt UI-Adapter — RF ist Canvas + Interaktion, keine Fachlogik. (WP-0c, #403)
- **ADR-0008** Domain Model wird unabhängig von React Flow — Planner Domain nutzt RF-Typen nur als Übergangs-Datentyp, langfristig eigenes Modell. (WP-0c, #403)
- **ADR-0009** Crossings sind erlaubt, Overlaps verboten — Kollisionsmodell-Kernregel: Overlap = HARD, Crossing = SOFT/Optimierungsziel. (WP-0c, #403)
- **ADR-0010** Routing ist deterministisch — gleicher Input ⇒ identischer Output, für beide Pässe (ELK + A*); Grundlage von Golden Master, Golden Layouts und LaneRegistry. (WP-0c, #403)
- **ADR-0003 Statusvermerk** — „Orthogonales Routing statt Wegfindung“ bleibt gültig für den inkrementellen Pass, wird aber im Zuge der ELK-Adoption (WP-4, #393) als **teilweise überlagert** markiert; die endgültige Markierung + neue ELK-ADR erfolgt in WP-4 (agent.md S-5).
- **Verworfen:** Negotiated Congestion / PathFinder als Routing-Verfahren — Overkill für die Graphgröße (100–300 Kanten); ELK Layered + Hanan-A* decken das Ziel ab (ROUTING-V2.md §1, Nicht-Ziel).
- **Architecture Contract fixiert** — `docs/ARCHITECTURE-V2.md` (WP-0a, #401): Schichtenmodell, 4 Prinzipien, Dependency Map, Datei-Katalog. Reviews prüfen dagegen.
- **Golden Master eingefroren** — `knownPlans/` (WP-0b, #402): 6 Pläne, Pipeline-Fixtures des Ist-Systems (Input → AutoWire → Electrical → Routing). V2-Ergebnisse müssen identisch oder bewusst besser sein (Begründung im PR + hier).
