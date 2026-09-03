# ADR 0005 — Dark Engineering Theme als geprüftes Token-System

**Status:** angenommen · **Datum:** 2026-08 (Mission 7, gehärtet in der
Review-Kampagne)

## Kontext

Der Elektroplaner ist eine Arbeitsfläche für lange Sitzungen (CAD-artig),
kein Marketing-Auftritt. Frühe Versionen trugen die üblichen Stil-Bugs mit
sich: generöse Radien (Consumer-Look), Kontraste per Augenmaß,
dezentral verteilte Farbwerte (unter anderem eine eigene MiniMap-Palette,
die vom Rest des Themes abwich).

Gleichzeitig gab es keine technische Hürde, das Theme „nebenbei" zu
beschädigen: nichts außer einem manuellen Lighthouse-Lauf (ohne
Aufzeichnung) hätte einen Kontrastbruch bemerkt.

## Entscheidung

1. **Ein Token-System als einzige Farbquelle.** Alle Planer-Farben leben
   als Custom Properties in `app/globals.css` (`--surface-*`, `--text-*`,
   `--accent-line`, `--ok/--warn/--error`, `--wire-*`), definiert in
   `:root` (hell) und `.dark` (dunkel). Komponenten referenzieren ausschließlich
   Tokens; harte Hex-Werte in Komponenten sind ein Review-Fehler
   (Ausnahme: dokumentierte Rendering-Sonderfälle wie die
   MiniMap-Palette, `components/planner/FlowCanvas.tsx` — bewusst
   hell-dunkel-agnostisch, weil der Canvas-Hintergrund fix ist).
2. **Erzwingbare Grenzen statt Stil-Appell:**
   - Radius der Ingenieurs-Oberfläche ≤ 4 px,
   - Textkontrast ≥ 4,5:1 (WCAG 1.4.3), Leitungen auf Canvas ≥ 3:1
     (grafische Objekte, WCAG 1.4.11).
3. **CSS wird per Parser geprüft, nicht per Regex.** Der Gate-Test
   `lib/designTokens.test.ts` liest `globals.css` mit postcss und prüft
   Vollständigkeit (jedes Token in hell UND dunkel), Radius-Grenze und
   alle Kontrastpaare gegen die aufgelösten var()-Ketten.
4. **Seriöser a11y-Beleg im Browser.** Statische heuristische JSX-Regeln
   ersetzen wir durch axe-Scans des gebauten Exports
   (`tests/e2e/a11y.spec.ts`, Seiten Start/Dach/Heizlast/Elektrik) —
   der React-Flow-Canvas ist als Editor-Surface gezielt ausgenommen.

## Konsequenzen

- Theme-Änderungen sind klein (ein Block in `globals.css`), aber laut:
  wer ein Token verschlechtert, lässt 46 Token-Tests rot werden.
- Die dunkle Variante ist gleichberechtigt — sie ist kein nachträglicher
  Modus, sondern die Primärankunft (Planersessions abends; Helle bleibt
  vollständig gegengeprüft).
- Verstoß-Beispiel mit Nachbarschaftsnutzen: die MiniMap weicht seit der
  Härtung nicht mehr vom Theme ab (ADR-übergreifendes Beispiel, siehe
  Commit 1791d6a).
