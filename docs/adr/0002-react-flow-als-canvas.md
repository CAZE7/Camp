# ADR 0002 — React Flow als Canvas

**Status:** angenommen, **erweitert durch ADR 0013** (Paketlinie `@xyflow/react` v12,
2026-09-06) · **Datum:** 2026-08 (nachträglich dokumentiert)

## Kontext

Der Schaltplan braucht verschiebbare Knoten, Anschlusspunkte, Kanten mit
eigenem Rendering, Zoom/Pan, Auswahl, Minimap — auf Maus **und** Touch.

## Entscheidung

React Flow als Canvas-Bibliothek (ursprünglich `reactflow` v11, seit ADR 0013
`@xyflow/react` v12). Knoten sind normale React-Komponenten
(`components/nodes/*`), Kanten ebenso (`components/edges/CableEdge.tsx`).
Die Interaktions-Props sind an einer Stelle gebündelt
(`components/planner/utils/flowInteraction.ts`, Mission-1-Entscheidung).

## Konsequenzen

**Gut**

- Knoten sind gewöhnliches React: Inspector-Felder, Warnfarben und
  Barrierefreiheit funktionieren mit den üblichen Mitteln.
- Handles bringen Verbindungslogik, Hit-Targets und Datenattribute mit
  (`data-nodeid`, `data-handleid`) — das sind zugleich stabile E2E-Selektoren.
- Zoom, Pan, Auswahl und Minimap mussten nicht selbst gebaut werden.

**Schlecht / Preis**

- Eine Kante kennt nur ihre eigenen Handle-Koordinaten. Die Kreuzungszählung
  des Routings arbeitet deshalb mit genäherten Mittelpunkt-Strecken
  (siehe `docs/ROUTING-INVARIANTS.md`).
- Touch-Verhalten musste explizit konfiguriert werden (Drag-Handle,
  Long-Press, Tap-to-Connect); die Standardwerte sind maus-orientiert.
- Bindung an die RF-API: der Wechsel auf v12 berührte Knoten, Kanten,
  Interaktions-Props und die Messschicht gleichzeitig (ADR 0013).

## Alternativen

- **SVG selbst zeichnen:** volle Kontrolle über das Routing, aber Zoom/Pan,
  Auswahl, Barrierefreiheit und Touch komplett in Eigenregie.
- **Schwergewichtige Diagramm-Bibliotheken (mxGraph/JointJS):** mehr
  Funktionen als nötig, schlechtere React-Integration.
