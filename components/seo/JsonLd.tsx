/**
 * Rendert den Structured-Data-Graph einer Seite als ein `application/ld+json`.
 *
 * Der Ersatz von `<` in die JSON-Escape-Form verhindert, dass ein Antworttext
 * mit der Zeichenfolge `</script>` das Skript vorzeitig beendet und das
 * Dokument aufbricht.
 */
export function JsonLd({ graph }: { graph: Record<string, unknown> }) {
  const payload = JSON.stringify(graph).replace(/</g, '\\u003c');

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: payload }} />;
}
