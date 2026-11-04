import type { Node } from '@xyflow/react';

import { isPresentationOnlyNode } from '../../edges/utils/routableNodes';
// Nicht den Barrel `'../../registry'` importieren: der zieht
// `builtinComponents.ts` und damit alle Node-Komponenten nach sich — ein
// Zyklus über FlowCanvas. `componentRegistry` ist die reine Datenmodule-Seite;
// die Registry ist zur Laufzeit gefüllt, weil `planner/constants.ts` (NODE_TYPES)
// den Barrel importiert. Isolierte Tests füllen ihn selbst.
import { labelOfType } from '../../registry/componentRegistry';

/**
 * §3.6 (Freigabe 2026-11-04) · Bauteil-Semantik der Zeichenfläche.
 *
 * React Flow setzt die Rolle selbst auf den tatsächlichen Node-Wrapper
 * (`node_modules/@xyflow/react/dist/esm/index.js:2366`):
 *
 * ```
 * role: node.ariaRole ?? (isFocusable ? 'group' : undefined),
 * "aria-roledescription": "node",
 * "aria-label": node.ariaLabel,
 * ...node.domAttributes,
 * ```
 *
 * Der Wrapper trägt also bereits `role="group"`, solange der Knoten fokussierbar
 * ist. Die Karten in `components/nodes/*` setzten `role="group"` zusätzlich —
 * verschachtelte Gruppen, deshalb hier die Gegenstelle: Der **Wrapper** bekommt
 * den Accessible Name, die **Karte** behält ihren Zustand (Sichttext,
 * `data-selected`) und keine eigene Rolle.
 *
 * Zwei Punkte sind an dieser Stelle gemessen, nicht aus der Doku übernommen:
 *
 * 1. `aria-roledescription` ist in der eingebauten Version **hart auf "node"
 *    geschrieben**. Ein Knoten-Prop `ariaRoleDescription` existiert nicht
 *    (`grep ariaRoleDescription node_modules/@xyflow/react/dist/esm/index.js`
 *    ergibt nichts). Der Weg zu einer deutschen Rollenbeschreibung ist
 *    `domAttributes`, weil die Bibliothek `...node.domAttributes` zuletzt
 *    spreizt und damit den harten Wert überschreibt. `role` und `aria-label`
 *    sind in `domAttributes` typseitig ausgeschlossen
 *    (`types/nodes.d.ts:24`) — Rollenname ja, Rolle nein.
 * 2. `aria-selected` bleibt fern: Die Rolle `group` kennt das Attribut nicht,
 *    und ein Attribut ohne gültige Rolle wird von Assistenztechnik
 *    übergangen. Der Auswahlzustand sitzt deshalb im Accessible Name.
 *
 * Die abgeleiteten Fachwerte (Füllgrad eines Leerrohrs, überlappende Panels)
 * stehen weiterhin als Sichttext in der Karte und damit im lesbaren Inhalt der
 * Gruppe — sie in den Gruppennamen zu ziehen wäre eine zweite Wahrheit.
 */

/** Lokalisiert für `aria-roledescription`; ersetzt den Bibliothekswert „node". */
export const BAUTEIL_ROLLENBESCHREIBUNG = 'Bauteil';

/**
 * Dachplaner-Objekte stehen nicht in der Bauteil-Registry (`app/tools/dach`) —
 * ohne diese Wörter fielen sie auf „Bauteil" zurück und verlören, was ihre
 * Karten bisher selbst benannt haben.
 */
const DACH_OBJEKT_WORT: Readonly<Record<string, string>> = {
  roofSolar: 'Solarpanel',
  roofWindow: 'Dachfenster',
  roofBackground: 'Dachfläche',
};

function text(data: Record<string, unknown>, key: string): string | null {
  const wert = data[key];
  return typeof wert === 'string' && wert.trim().length > 0 ? wert.trim() : null;
}

function zahl(data: Record<string, unknown>, key: string): number | null {
  const wert = data[key];
  return typeof wert === 'number' && Number.isFinite(wert) ? wert : null;
}

/**
 * Accessible Name eines Bauteils: Typwort, Kürzel, eigene Beschriftung,
 * Abmessungen der Dachobjekte und — getrennt durch „—" — der Zustand.
 */
export function bauteilName(node: Node, designator?: string): string {
  const data = (node.data ?? {}) as Record<string, unknown>;
  const typ = node.type ?? '';
  const typWort = DACH_OBJEKT_WORT[typ] ?? labelOfType(node.type, 'Bauteil');
  const beschriftung = text(data, 'label');

  const teilen: string[] = [`${typWort}${designator ? ` ${designator}` : ''}`];
  // Ohne Anführungszeichen: sie gehören in sichtbaren Text, aber eine
  // Screenreader-Lautsprecherin liest sie als „Anführungszeichen … zu".
  if (beschriftung && beschriftung !== typWort) teilen.push(beschriftung);

  if (typ in DACH_OBJEKT_WORT) {
    const breite = zahl(data, 'width');
    const hoehe = zahl(data, 'height');
    if (breite !== null && hoehe !== null) {
      teilen.push(`${Math.round(breite)} mal ${Math.round(hoehe)} Zentimeter`);
    }
    const watt = zahl(data, 'watts');
    if (watt !== null) teilen.push(`${watt} Watt`);
  }

  const zustand: string[] = [];
  if (node.selected) zustand.push('ausgewählt');
  if (data.isInvalid === true) zustand.push('ragt aus der Safe Zone');
  if (data.isOverlapping === true) zustand.push('überlappt ein anderes Element');

  return zustand.length > 0 ? `${teilen.join(', ')} — ${zustand.join(', ')}` : teilen.join(', ');
}

/**
 * Setzt Rollenbeschreibung und Accessible Name am Knotenobjekt — nicht an der
 * Karte. Der Rückfall auf die Bibliotheksrolle `group` bleibt unangetastet;
 * `ariaRole` wäre nur für Knoten nötig, die nicht fokussierbar sind, und das
 * sind hier ausschließlich Deko-Rahmen, die keine Bauteil-Gruppe sein sollen.
 *
 * Identitätsvertrag wie bei `withNodeInteractionState`: unveränderte Knoten
 * werden **dasselbe Objekt** zurückgegeben, damit reine Anzeige-Updates keine
 * Neuübernahme der Knotenliste auslösen.
 */
export function withBauteilAria(node: Node, designator?: string): Node {
  if (isPresentationOnlyNode(node)) return node;

  const name = bauteilName(node, designator);
  const beschriftet = node.ariaLabel === name;
  const rollenklar = node.domAttributes?.['aria-roledescription'] === BAUTEIL_ROLLENBESCHREIBUNG;
  if (beschriftet && rollenklar) return node;

  return {
    ...node,
    ariaLabel: name,
    domAttributes: {
      ...node.domAttributes,
      'aria-roledescription': BAUTEIL_ROLLENBESCHREIBUNG,
    },
  };
}
