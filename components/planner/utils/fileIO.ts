/**
 * Datei-Ein- und -Ausgabe im Browser (Download und Dateiauswahl).
 *
 * Bewusst klein gehalten: keine Abhängigkeit, kein Backend. Die Projektdatei
 * und die Stückliste werden lokal erzeugt und lokal geöffnet.
 */

/** Löst einen Textdownload aus. */
export function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Erst nach dem Start des Downloads freigeben.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Öffnet den Dateidialog und liefert Name und Textinhalt. `null`, wenn der
 * Nutzer abbricht. Lesefehler werden als Ablehnung gemeldet, nicht verschluckt.
 */
export function pickTextFile(accept: string): Promise<{ name: string; text: string } | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    let settled = false;
    const finish = (value: { name: string; text: string } | null | Error) => {
      if (settled) return;
      settled = true;
      input.remove();
      if (value instanceof Error) reject(value);
      else resolve(value);
    };
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) {
        finish(null);
        return;
      }
      file
        .text()
        .then((text) => finish({ name: file.name, text }))
        .catch((error: unknown) =>
          finish(error instanceof Error ? error : new Error('Die Datei konnte nicht gelesen werden.'))
        );
    });
    // `cancel` feuert, wenn der Dialog ohne Auswahl geschlossen wird.
    input.addEventListener('cancel', () => finish(null));
    document.body.appendChild(input);
    input.click();
  });
}
