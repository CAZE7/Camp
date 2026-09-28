import type { Rect } from './types';

/**
 * Exakte separierbare euklidische Distanztransformierte (EDT) als $d^2$ in px².
 *
 * Spezifikation: `docs/ai/GPU-ROUTING-ARCH.md` §2.2″ (Mission Stufe 1) —
 * Felzenszwalb–Huttenlocher, Unterhülle der Parabeln; 1D-Sweep je Zeile
 * $O(W)$ über $H$ Zeilen, danach analog je Spalte — Gesamtarbeit
 * $O(W \cdot H)$.
 *
 * Warum Ganzzahlen: Gespeichert wird $d^2 \in \mathbb{Z}_{\ge 0}$; Vergleiche
 * laufen wurzelffrei als $d^2 < c^2$ (z. B. $c =$ `cableClearance` →
 * $12^2 = 144$). Parabelzentren sind Pixel-Indizes, Faktoren $f_i$ sind
 * u32-Werte — die Pop-Entscheidung der Enveloppe wird per Kreuzvergleich
 * $(a_1 b_2 \le a_2 b_1)$ **exakt** in Double-Arithmetik gerechnet
 * (Betragsobergrenze $(2^{31} + 46341^2) \cdot 46341 \approx 4 \cdot 10^{14}
 * < 2^{53}$, also ohne Rundungsfehler). Die Schnittpunkte selbst dürfen als
 * Double gespeichert werden: eine Rundung nahe einer Ganzzahl wechselt nur
 * bei exakten Ties die Parabel — beide liefern dort denselben Wert.
 *
 * Hart-Assertion (§2.2″, „Fehler statt Wraparound"): jeder endliche
 * $d^2$ ist strikt $< 2^{31}$ (entspricht $d < 46{,}341$ px). Der Sentinel
 * `EDT_MAX_D2 = 2³¹ − 1` ist zugleich der „kein Hindernis erreichbar"-
 * beziehungsweise „außerhalb des Feldes"-Wert; das Feld-Guard wirft, bevor
 * ein endlicher Wert den Sentinel erreichen könnte (sonst wäre INF und
 * echter Maximum-Wert nicht mehr unterscheidbar).
 *
 * Konservative Rasterisierung (Underestimate-Garantie §2.2″): Jede Zelle,
 * deren **abgeschlossenes** Gebiet die Hindernis-Box berührt oder schneidet,
 * gilt als belegt — äquivalent zur Aufblähung um die halbe Zelldiagonale.
 * „Weit weg" kann die Rasterwelt nur behaupten, wenn tatsächlich weit ist;
 * eine berührte Zelle hat $d^2 = 0$ wie das Hindernis selbst.
 *
 * Rein, deterministisch (R5): keine Zeit-/Zufallsquellen, feste
 * Schleifenordnung, bitidentisches Ergebnis bei identischer Eingabe.
 * `edt.test.ts` vergleicht gegen ein Brute-Force-Orakel über **derselben**
 * Rasterisierung (§2.2″, Orakel-Definition).
 */

/**
 * Sentinel für „kein Hindernis erreichbar" bzw. „außerhalb des Feldes":
 * $2^{31} - 1$. Strikt innerhalb der Hart-Assertion $d^2 < 2^{31}$ und
 * strikt größer als jeder im Feld erreichbare endliche Wert, sodass
 * wurzelfreie Vergleiche `d2 < c²` für alle reellen Freigaben $c$ korrekt
 * „größer" liegen.
 */
export const EDT_MAX_D2 = 0x7fff_ffff;

/**
 * Maximale Feldkante in Pixeln. Zwischen den Ecken eines $w \times h$-Feldes
 * liegt $d^2 = (w-1)^2 + (h-1)^2$; das muss $< 2^{31}$ (§2.2″) **und**
 * $<$ Sentinel bleiben. 46341 px folgt aus $46340^2 < 2^{31} \le 46341^2$.
 */
export const EDT_MAX_DIM = 46_341;

/** Ein gerastertes EDT-Feld: Pixel-Origo (Welt-px) + $d^2$-Feld (px²). */
export type EdtField = {
  /** Welt-px der linken oberen Ecke des lokalen Pixels (0,0). */
  readonly originX: number;
  readonly originY: number;
  readonly width: number;
  readonly height: number;
  /** Länge `width * height`, Index `(y - originY) * width + (x - originX)`. */
  readonly d2: Uint32Array;
};

const assertDims = (width: number, height: number): void => {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new RangeError(`edt: ungültige Feldgröße ${width}×${height}`);
  }
  if (width > EDT_MAX_DIM || height > EDT_MAX_DIM) {
    throw new RangeError(`edt: Feld ${width}×${height} überschreitet EDT_MAX_DIM ${EDT_MAX_DIM} (d² < 2³¹)`);
  }
  const maxD2 = (width - 1) * (width - 1) + (height - 1) * (height - 1);
  // Strenger als die Spec-Assertion: endliche Werte müssen strikt unter dem
  // Sentinel bleiben, sonst wären „unendlich" und „größte Distanz" gleich.
  if (maxD2 >= EDT_MAX_D2) {
    throw new RangeError(`edt: Ecken-$d^2$ ${maxD2} verletzt d² < ${EDT_MAX_D2} (§2.2″)`);
  }
};

/**
 * Enveloppen-Schnittpunkt der Parabeln $f_q + (x-q)^2$ und $f_p + (x-p)^2$
 * mit $p < q$: $s = \frac{(f_q + q^2) - (f_p + p^2)}{2(q - p)}$.
 * Als Double gesichert (siehe Kopfkommentar).
 */
const intersection = (q: number, fq: number, p: number, fp: number): number =>
  (fq + q * q - (fp + p * p)) / (2 * (q - p));

/**
 * Exakte Ungleichung $s(q,f_q \leftrightarrow p,f_p) \le
 * s(p,f_p \leftrightarrow r,f_r)$ für $r < p < q$ (Nenner $> 0$, Faktor 2
 * kürzt sich) — Ganzzahl-Kreuzvergleich, in Double exakt.
 */
const intersectionLE = (q: number, fq: number, p: number, fp: number, r: number, fr: number): boolean =>
  (fq + q * q - (fp + p * p)) * (p - r) <= (fp + p * p - (fr + r * r)) * (q - p);

/**
 * 1D-Distanztransformierte einer Zeile: $f[i] = 0$ für belegt, sonst
 * `EDT_MAX_D2`; Ergebnis $d[i] = \min_{j:\,f[j] < \infty} f[j] + (i - j)^2$.
 *
 * Unterhülle der Parabeln per doppeltem Stapel (`v` = Quellen, `z` =
 * untere Schnittpunkte). Quellen mit `EDT_MAX_D2` werden nie gestapelt
 * (ihre Parabel ist leer); bleiben keine endlichen Quellen, bleibt das
 * Ergebnis überall `EDT_MAX_D2`.
 */
function transform1D(f: Uint32Array, out: Uint32Array, n: number): void {
  if (n <= 0) return;
  // v[0..k]: Parabelquellen; z[0..k+1]: Gürtelgrenzen (halb-offen, monoton).
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  let k = -1; // leerer Stapel — nur endliche Quellen landen darauf
  z[0] = Number.NEGATIVE_INFINITY;
  z[1] = Number.POSITIVE_INFINITY;

  for (let q = 0; q < n; q++) {
    const fq = f[q] ?? EDT_MAX_D2;
    if (fq >= EDT_MAX_D2) continue; // belegungslose Position ist keine Quelle
    if (k === -1) {
      k = 0;
      v[0] = q;
      continue;
    }
    // Parabeln vom Stapel werfen, bis ihre neue Parabel rechts davon startet.
    while (
      k > 0 &&
      intersectionLE(q, fq, v[k]!, f[v[k]!] ?? EDT_MAX_D2, v[k - 1]!, f[v[k - 1]!] ?? EDT_MAX_D2)
    ) {
      k--;
    }
    const s = intersection(q, fq, v[k]!, f[v[k]!] ?? EDT_MAX_D2);
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = Number.POSITIVE_INFINITY;
  }

  // Aufwertung: jede Quelle besitzt den offenen Gürtel (z[k], z[k+1]].
  k = 0;
  for (let x = 0; x < n; x++) {
    while (z[k + 1]! < x) k++;
    const src = v[k]!;
    const fSrc = f[src] ?? EDT_MAX_D2;
    out[x] = fSrc >= EDT_MAX_D2 ? EDT_MAX_D2 : fSrc + (x - src) * (x - src);
  }
}

/**
 * Exakte separierbare EDT über ein $w \times h$-Pixelraster.
 *
 * @param blocked Länge `w * h`, Index `y * w + x`; != 0 ⇒ belegt (Quelle,
 *   $d^2 = 0$). Wird nicht verändert.
 * @returns Feld derselben Ordnung mit $d^2$ in px²; `EDT_MAX_D2`, wenn die
 *   Zeile/Spalte keine Quelle erreicht.
 * @throws RangeError wenn die Dimensionen die $d^2 < 2^{31}$-Assertion
 *   verletzen würden (§2.2″: Fehler statt Wraparound).
 */
export function squaredEdt2D(width: number, height: number, blocked: Uint8Array): Uint32Array {
  assertDims(width, height);
  if (blocked.length !== width * height) {
    throw new RangeError(`edt: blocked.length ${blocked.length} ≠ ${width}×${height}`);
  }
  const d2 = new Uint32Array(width * height);
  // Startwerte: belegt ⇒ 0, frei ⇒ INF.
  for (let i = 0; i < d2.length; i++) d2[i] = blocked[i] ? 0 : EDT_MAX_D2;

  // Pass 1: je Zeile die x-Transformation (Quellen = belegte Zellen der Zeile).
  // inBuf/outBuf getrennt — transform1D darf Quellwerte nicht überschreiben,
  // solange die Aufwertung sie noch liest (Aliasing-Paranoia, s. Testfall).
  const inBuf = new Uint32Array(Math.max(width, height));
  const outBuf = new Uint32Array(Math.max(width, height));
  for (let y = 0; y < height; y++) {
    const base = y * width;
    for (let x = 0; x < width; x++) inBuf[x] = d2[base + x]!;
    transform1D(inBuf, outBuf, width);
    for (let x = 0; x < width; x++) d2[base + x] = outBuf[x]!;
  }
  // Pass 2: je Spalte die y-Transformation (Quellen = Zwischenwerte).
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) inBuf[y] = d2[y * width + x]!;
    transform1D(inBuf, outBuf, height);
    for (let y = 0; y < height; y++) d2[y * width + x] = outBuf[y]!;
  }
  return d2;
}

/**
 * Konservative Rasterisierung (§2.2″): Eine Zelle ist belegt, gdw. ihr
 * abgeschlossenes Gebiet $[\text{origin}+i, \text{origin}+i+1] \times$
 * $[\text{origin}+j, \text{origin}+j+1]$ die Hindernis-Box schneidet oder
 * berührt — jede Überlappung, auch nur eine Ecke, zählt.
 *
 * @param originX/originY Welt-px des lokalen Pixels (0,0) (ganzzahlig).
 */
export function rasterizeObstaclesConservative(
  originX: number,
  originY: number,
  width: number,
  height: number,
  rects: readonly Rect[]
): Uint8Array {
  assertDims(width, height);
  if (!Number.isInteger(originX) || !Number.isInteger(originY)) {
    throw new RangeError(`edt: Origos müssen ganzzahlig sein (${originX}, ${originY})`);
  }
  const blocked = new Uint8Array(width * height);
  for (let o = 0; o < rects.length; o++) {
    const r = rects[o]!;
    if (!(r.width > 0) || !(r.height > 0)) continue;
    // Zellen i mit i ≤ r.x+r.width − originX und i+1 ≥ r.x − originX
    // (abgeschlossene Schnittmenge, lokal gerechnet).
    const loX = Math.ceil(r.x - originX - 1);
    const hiX = Math.floor(r.x + r.width - originX);
    const loY = Math.ceil(r.y - originY - 1);
    const hiY = Math.floor(r.y + r.height - originY);
    const i0 = Math.max(0, loX);
    const i1 = Math.min(width - 1, hiX);
    const j0 = Math.max(0, loY);
    const j1 = Math.min(height - 1, hiY);
    for (let j = j0; j <= j1; j++) {
      const base = j * width;
      for (let i = i0; i <= i1; i++) blocked[base + i] = 1;
    }
  }
  return blocked;
}

/**
 * O(1)-Lookup $d^2(x, y)$ (px²) — der Zweck des Feldes im CPU-A\\*
 * (GPU-ROUTING-ARCH, Tabelle „genau ermöglicht $O(1)$-Proximity-Lookups").
 * Bruchkoordinaten werden auf die umschließende Pixelzelle abgerundet
 * (`floor`); außerhalb des Feldes liefert der Feld `EDT_MAX_D2` (konservativ:
 * „unbekannt = unbegrenzt entfernt", nie im schädlichen Sinn unterschätzt).
 */
export function edtSquaredAt(field: EdtField, x: number, y: number): number {
  const ix = Math.floor(x) - field.originX;
  const iy = Math.floor(y) - field.originY;
  if (ix < 0 || iy < 0 || ix >= field.width || iy >= field.height) return EDT_MAX_D2;
  return field.d2[iy * field.width + ix] ?? EDT_MAX_D2;
}

/**
 * Baut ein Feld über die abgeschlossene Box aller Hindernisse plus Rand
 * (`pad` px) — die Fläche, die ein Suchlauf überblickt. Reine Hülle um
 * `rasterizeObstaclesConservative` + `squaredEdt2D`.
 */
export function buildObstacleEdt(rects: readonly Rect[], pad: number): EdtField | null {
  if (rects.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i]!;
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.width);
    maxY = Math.max(maxY, r.y + r.height);
  }
  const originX = Math.floor(minX) - pad;
  const originY = Math.floor(minY) - pad;
  const width = Math.floor(maxX + pad) - originX + 1;
  const height = Math.floor(maxY + pad) - originY + 1;
  if (width < 1 || height < 1) return null;
  const blocked = rasterizeObstaclesConservative(originX, originY, width, height, rects);
  return { originX, originY, width, height, d2: squaredEdt2D(width, height, blocked) };
}
