/**
 * scripts/seo/pdf.ts — ein kleiner PDF-Setzer für die Berichte.
 *
 * Warum selbst geschrieben und nicht über eine Bibliothek: Der Bericht ist ein
 * Erzeugnis für Menschen (Text, Listen, Tabellen) — kein Layout mit Grafiken.
 * Eine Abhängigkeit mit hundert Megabyte Browser-Binary nur zum Drucken von
 * Absätzen wäre unverhältnismäßig, und ein externer Dienst scheidet aus, weil
 * die Berichte das Haus nicht verlassen sollen.
 *
 * Umfang: A4, Helvetica (Grundschrift) und Helvetica-Bold (Auszeichnung),
 * Fließtext mit Umbruch, Listen, Tabellen, Kopf- und Fußzeile. Zeichen außerhalb
 * von Windows-1252 werden transliteriert (Ω → Ohm, · → -), damit die Ausgabe
 * ohne eingebettete Schriftdateien lesbar bleibt.
 *
 * Die Erzeugung ist deterministisch: gleiche Blöcke ⇒ gleiche Bytes. Das ist
 * Absicht — ein Bericht, der sich ohne inhaltliche Änderung unterscheidet,
 * wäre als Artefakt wertlos.
 */

/** Ein Absatz oder ein Block des Berichts. */
export type PdfBlock =
  | { kind: 'title'; text: string; subtitle?: string }
  | { kind: 'heading'; text: string }
  | { kind: 'subheading'; text: string }
  | { kind: 'paragraph'; text: string; size?: number }
  | { kind: 'list'; items: readonly string[]; ordered?: boolean }
  | {
      kind: 'table';
      head: readonly string[];
      rows: readonly (readonly string[])[];
      widths?: readonly number[];
    }
  | { kind: 'code'; text: string }
  | { kind: 'spacer'; height?: number };

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 56;
const MARGIN_TOP = 64;
const MARGIN_BOTTOM = 64;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

const FONT_REGULAR = 'F1';
const FONT_BOLD = 'F2';
const FONT_MONO = 'F3';

/** Breite eines Zeichens in Vielfachen der Schriftgröße (Helvetica, grob). */
const NARROW = new Set([
  'i',
  'j',
  'l',
  't',
  'f',
  'r',
  'I',
  '.',
  ',',
  ':',
  ';',
  "'",
  '|',
  '(',
  ')',
  '[',
  ']',
  ' ',
]);

function charWidth(char: string, mono: boolean): number {
  if (mono) return 0.6;
  if (char === ' ') return 0.28;
  if (NARROW.has(char)) return 0.3;
  if (char >= 'A' && char <= 'Z') return 0.67;
  if (char >= '0' && char <= '9') return 0.556;
  if (char === 'm' || char === 'w' || char === 'M' || char === 'W') return 0.83;
  return 0.52;
}

function textWidth(text: string, size: number, mono = false): number {
  return [...text].reduce((sum, char) => sum + charWidth(char, mono) * size, 0);
}

/** Ersatzdarstellung für Zeichen außerhalb von Windows-1252. */
const TRANSLITERATION: Record<string, string> = {
  Ω: 'Ohm',
  '·': '-',
  Δ: 'Delta ',
  '≈': '~',
  '≥': '>=',
  '≤': '<=',
  '→': '->',
  '←': '<-',
  '✓': 'ok',
  '×': 'x',
  '—': '-',
  '–': '-',
  '„': '"',
  '“': '"',
  '‚': "'",
  '‘': "'",
  '’': "'",
  κ: 'k',
  µ: 'u',
  ' μ': 'u',
  '‰': 'o/oo',
};

/** Zeichenkette PDF-tauglich machen (Windows-1252, Maskierung). */
export function pdfEscape(text: string): string {
  let out = '';
  for (const char of text) {
    const replacement = TRANSLITERATION[char] ?? (/[\u0000-\u00ff]/.test(char) ? char : '?');
    out += replacement;
  }
  return out.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/** Zeilenumbruch auf eine Spaltenbreite; berücksichtigt keine Trennung. */
export function wrapText(text: string, size: number, maxWidth: number, mono = false): string[] {
  const words = text.split(/\s+/).filter((word) => word.length > 0);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current === '' ? word : `${current} ${word}`;
    if (textWidth(candidate, size, mono) <= maxWidth || current === '') {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current !== '') lines.push(current);
  return lines.length === 0 ? [''] : lines;
}

type Page = {
  /** Ausgabeanweisungen je Seite. */
  content: string[];
  number: number;
};

class PdfDocument {
  private readonly pages: Page[] = [];
  private current: Page;
  private cursorY = PAGE_HEIGHT - MARGIN_TOP;
  private readonly footerText: string;

  constructor(footerText: string) {
    this.footerText = footerText;
    this.current = { content: [], number: 1 };
    this.pages.push(this.current);
  }

  private ensureSpace(height: number): void {
    if (this.cursorY - height >= MARGIN_BOTTOM) return;
    this.newPage();
  }

  private newPage(): void {
    this.current = { content: [], number: this.pages.length + 1 };
    this.pages.push(this.current);
    this.cursorY = PAGE_HEIGHT - MARGIN_TOP;
  }

  private write(text: string, x: number, y: number, size: number, font: string): void {
    this.current.content.push(
      `BT /${font} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${pdfEscape(text)}) Tj ET`
    );
  }

  title(text: string, subtitle?: string): void {
    const size = 21;
    for (const line of wrapText(text, size, CONTENT_WIDTH)) {
      this.ensureSpace(size * 1.35);
      this.write(line, MARGIN_X, this.cursorY - size, size, FONT_BOLD);
      this.cursorY -= size * 1.35;
    }
    if (subtitle) {
      const subSize = 11;
      this.cursorY -= 4;
      for (const line of wrapText(subtitle, subSize, CONTENT_WIDTH)) {
        this.ensureSpace(subSize * 1.5);
        this.write(line, MARGIN_X, this.cursorY - subSize, subSize, FONT_REGULAR);
        this.cursorY -= subSize * 1.5;
      }
    }
    this.cursorY -= 14;
  }

  heading(text: string): void {
    const size = 14;
    this.ensureSpace(size * 2.2 + 20);
    this.cursorY -= 12;
    this.write(text, MARGIN_X, this.cursorY - size, size, FONT_BOLD);
    this.cursorY -= size + 8;
    // Trennlinie unter der Überschrift.
    this.current.content.push(
      `0.85 0.85 0.85 RG 0.8 w ${MARGIN_X} ${this.cursorY.toFixed(2)} m ${(PAGE_WIDTH - MARGIN_X).toFixed(2)} ${this.cursorY.toFixed(2)} l S`
    );
    this.cursorY -= 8;
  }

  subheading(text: string): void {
    const size = 11.5;
    this.ensureSpace(size * 1.6 + 12);
    this.cursorY -= 8;
    this.write(text, MARGIN_X, this.cursorY - size, size, FONT_BOLD);
    this.cursorY -= size * 1.6;
  }

  paragraph(text: string, size = 10): void {
    const lineHeight = size * 1.5;
    for (const line of wrapText(text, size, CONTENT_WIDTH)) {
      this.ensureSpace(lineHeight);
      this.write(line, MARGIN_X, this.cursorY - size, size, FONT_REGULAR);
      this.cursorY -= lineHeight;
    }
    this.cursorY -= 5;
  }

  list(items: readonly string[], ordered = false): void {
    const size = 10;
    const lineHeight = size * 1.5;
    items.forEach((item, index) => {
      const marker = ordered ? `${index + 1}.` : '-';
      const markerWidth = 18;
      const lines = wrapText(item, size, CONTENT_WIDTH - markerWidth);
      lines.forEach((line, lineIndex) => {
        this.ensureSpace(lineHeight);
        if (lineIndex === 0) this.write(marker, MARGIN_X, this.cursorY - size, size, FONT_REGULAR);
        this.write(line, MARGIN_X + markerWidth, this.cursorY - size, size, FONT_REGULAR);
        this.cursorY -= lineHeight;
      });
      this.cursorY -= 2;
    });
    this.cursorY -= 4;
  }

  table(head: readonly string[], rows: readonly (readonly string[])[], widths?: readonly number[]): void {
    const size = 9;
    const padding = 4;
    const columns = head.length;
    const fractions =
      widths && widths.length === columns ? widths : Array.from({ length: columns }, () => 1 / columns);
    const columnWidths = fractions.map((fraction) => fraction * CONTENT_WIDTH);

    const drawRow = (cells: readonly string[], bold: boolean): void => {
      const cellLines = cells.map((cell, index) =>
        wrapText(cell, size, columnWidths[index]! - padding * 2, false)
      );
      const lineCount = Math.max(...cellLines.map((lines) => lines.length));
      const rowHeight = lineCount * size * 1.3 + padding * 2;

      if (this.cursorY - rowHeight < MARGIN_BOTTOM) {
        this.newPage();
        this.drawHeaderRow(head, columnWidths, size, padding);
      }

      const top = this.cursorY;
      if (bold) {
        this.current.content.push(
          `0.94 0.94 0.94 rg ${MARGIN_X} ${(top - rowHeight).toFixed(2)} ${CONTENT_WIDTH.toFixed(2)} ${rowHeight.toFixed(2)} re f 0 g`
        );
      }
      let x = MARGIN_X;
      cellLines.forEach((lines, index) => {
        lines.forEach((line, lineIndex) => {
          this.write(
            line,
            x + padding,
            top - padding - size * (lineIndex + 1) - lineIndex * size * 0.3,
            size,
            bold ? FONT_BOLD : FONT_REGULAR
          );
        });
        x += columnWidths[index]!;
      });
      this.current.content.push(
        `0.8 0.8 0.8 RG 0.5 w ${MARGIN_X} ${(top - rowHeight).toFixed(2)} m ${(PAGE_WIDTH - MARGIN_X).toFixed(2)} ${(top - rowHeight).toFixed(2)} l S`
      );
      this.cursorY -= rowHeight;
    };

    drawRow(head, true);
    for (const row of rows) drawRow(row, false);
    this.cursorY -= 10;
  }

  private drawHeaderRow(
    head: readonly string[],
    columnWidths: readonly number[],
    size: number,
    padding: number
  ): void {
    const top = this.cursorY;
    const rowHeight = size * 1.3 + padding * 2;
    this.current.content.push(
      `0.94 0.94 0.94 rg ${MARGIN_X} ${(top - rowHeight).toFixed(2)} ${CONTENT_WIDTH.toFixed(2)} ${rowHeight.toFixed(2)} re f 0 g`
    );
    let x = MARGIN_X;
    head.forEach((cell, index) => {
      this.write(cell, x + padding, top - padding - size, size, FONT_BOLD);
      x += columnWidths[index]!;
    });
    this.cursorY -= rowHeight;
  }

  code(text: string): void {
    const size = 9;
    const lineHeight = size * 1.4;
    // Einrückung: Codezeilen bleiben ohne Umbruch, Überlanges wird beschnitten.
    for (const line of text.split('\n')) {
      this.ensureSpace(lineHeight);
      this.write(line, MARGIN_X + 8, this.cursorY - size, size, FONT_MONO);
      this.cursorY -= lineHeight;
    }
    this.cursorY -= 6;
  }

  spacer(height = 10): void {
    this.cursorY -= height;
  }

  /** Bytes des fertigen Dokuments. */
  build(meta: { title: string; author: string; createdAt?: Date }): Buffer {
    const objects: string[] = [];
    const addObject = (body: string): number => {
      objects.push(body);
      return objects.length;
    };

    const fontRegular = addObject(
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'
    );
    const fontBold = addObject(
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'
    );
    const fontMono = addObject(
      '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>'
    );

    const contentsIds: number[] = [];
    const pageIds: number[] = [];

    for (const page of this.pages) {
      const parts = [...page.content];
      // Fußzeile: Berichtstitel links, Seitenzahl rechts.
      parts.push(
        `0.5 0.5 0.5 rg BT /${FONT_REGULAR} 8 Tf 1 0 0 1 ${MARGIN_X} 40 Tm (${pdfEscape(this.footerText)}) Tj ET 0 g`
      );
      const pageLabel = `Seite ${page.number} von ${this.pages.length}`;
      const labelWidth = textWidth(pageLabel, 8);
      parts.push(
        `0.5 0.5 0.5 rg BT /${FONT_REGULAR} 8 Tf 1 0 0 1 ${(PAGE_WIDTH - MARGIN_X - labelWidth).toFixed(2)} 40 Tm (${pdfEscape(pageLabel)}) Tj ET 0 g`
      );

      const stream = parts.join('\n');
      const contentId = addObject(
        `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`
      );
      contentsIds.push(contentId);
    }

    const pagesId = objects.length + this.pages.length + 1; // Platzhalter, wird unten korrigiert
    void pagesId;

    const pagesObjectNumber = objects.length + 1;
    for (let index = 0; index < this.pages.length; index += 1) {
      pageIds.push(
        addObject(
          `<< /Type /Page /Parent ${pagesObjectNumber} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
            `/Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R /F3 ${fontMono} 0 R >> >> ` +
            `/Contents ${contentsIds[index]} 0 R >>`
        )
      );
    }

    const pagesObject = addObject(
      `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`
    );
    const catalogId = addObject(`<< /Type /Catalog /Pages ${pagesObject} 0 R >>`);
    const infoId = addObject(
      `<< /Title (${pdfEscape(meta.title)}) /Author (${pdfEscape(meta.author)}) /Producer (Camp SEO-Bericht) ` +
        `/CreationDate (D:${(meta.createdAt ?? new Date()).toISOString().slice(0, 10).replace(/-/g, '')}000000Z) >>`
    );

    let pdf = '%PDF-1.7\n%\u00e2\u00e3\u00cf\u00d3\n';
    const offsets: number[] = [];
    objects.forEach((body, index) => {
      offsets.push(Buffer.byteLength(pdf, 'latin1'));
      pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
    });

    const xrefOffset = Buffer.byteLength(pdf, 'latin1');
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const offset of offsets) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

    return Buffer.from(pdf, 'latin1');
  }
}

/** Setzt Blöcke zu einem PDF. */
export function renderPdf(
  blocks: readonly PdfBlock[],
  meta: { title: string; author: string; createdAt?: Date }
): Buffer {
  const document = new PdfDocument(meta.title);
  for (const block of blocks) {
    switch (block.kind) {
      case 'title':
        document.title(block.text, block.subtitle);
        break;
      case 'heading':
        document.heading(block.text);
        break;
      case 'subheading':
        document.subheading(block.text);
        break;
      case 'paragraph':
        document.paragraph(block.text, block.size ?? 10);
        break;
      case 'list':
        document.list(block.items, block.ordered ?? false);
        break;
      case 'table':
        document.table(block.head, block.rows, block.widths);
        break;
      case 'code':
        document.code(block.text);
        break;
      case 'spacer':
        document.spacer(block.height);
        break;
    }
  }
  return document.build(meta);
}

/** Wandelt Blöcke in Markdown — dieselbe Quelle für Datei und PDF. */
export function renderMarkdown(blocks: readonly PdfBlock[]): string {
  const out: string[] = [];
  for (const block of blocks) {
    switch (block.kind) {
      case 'title':
        out.push(`# ${block.text}`, block.subtitle ? `\n_${block.subtitle}_` : '');
        break;
      case 'heading':
        out.push(`\n## ${block.text}`);
        break;
      case 'subheading':
        out.push(`\n### ${block.text}`);
        break;
      case 'paragraph':
        out.push(`\n${block.text}`);
        break;
      case 'list':
        out.push(
          ...block.items.map((item, index) => (block.ordered ? `${index + 1}. ${item}` : `- ${item}`))
        );
        break;
      case 'table':
        out.push(
          `\n| ${block.head.join(' | ')} |`,
          `| ${block.head.map(() => '---').join(' | ')} |`,
          ...block.rows.map((row) => `| ${row.join(' | ')} |`)
        );
        break;
      case 'code':
        out.push('\n```', block.text, '```');
        break;
      case 'spacer':
        out.push('');
        break;
    }
  }
  return out.join('\n');
}
