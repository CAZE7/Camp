import Link from 'next/link';

/**
 * Vorlagen-Text unter dem Heizlast-Rechner. Gleicher Grund wie beim
 * Dach-Explainer: Der Rechner ist Client-Component, die Suchbegriffe sollen aber
 * im ausgelieferten HTML stehen.
 */
export function HeizungsExplainer() {
  return (
    <section aria-labelledby="heizungserklaerung-heading" className="border-t border-rule py-12">
      <div className="container-page prose-measure">
        <h2
          id="heizungserklaerung-heading"
          className="font-display text-xl font-semibold text-ink md:text-2xl"
        >
          Heizlast für den Camper: Woher die Wattzahl kommt
        </h2>
        <p className="mt-3 text-sm text-ink-soft">
          Der Rechner bestimmt die benötigte Heizleistung aus zwei Verlustströmen: Transmission — also Wärme,
          die durch Böden, Wände, Fenster und Dach entweicht — und Lüftungsverlust durch den Luftaustausch im
          Innenraum. Aus beidem entsteht Q_total in Watt, das gegen das Leistungs-Raster der verfügbaren
          Geräte abgeglichen wird.
        </p>

        <h3 className="panel-title mt-6">Drei Bereiche des Ergebnisses</h3>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-ink-soft">
          <li>
            <strong className="font-medium text-ink">Unterdimensioniert</strong> — die Heizung bleibt unter
            der benötigten Leistung und hält die Wunschtemperatur nicht.
          </li>
          <li>
            <strong className="font-medium text-ink">Passend</strong> — Gerät und Verlustleistung laufen in
            einem realistischen Dauerlastbereich.
          </li>
          <li>
            <strong className="font-medium text-ink">Überdimensioniert</strong> — das Gerät taktet und kann
            verkoksen, weil es nie auf Temperatur kommt.
          </li>
        </ul>

        <p className="mt-4 text-sm text-ink-soft">
          Als Dauerlast orientiert sich der Rechner an etwa 80 bis 90 Prozent der Nennleistung — eine Heizung,
          die ständig unter Volllast läuft, ist genauso fehlgedeutet wie eine mit zu viel Reserve.
        </p>

        <h3 className="panel-title mt-6">Wo die Heizlast weiterreicht</h3>
        <p className="mt-3 text-sm text-ink-soft">
          Der Strombedarf von Gebläse und Steuergerät landet in der{' '}
          <Link href="/elektrik-planung">12-V-Anlage</Link>. Die benötigte Wärme hängt an{' '}
          <Link href="/guides/ausbau-fahrplan">Dämmung und Fenster</Link> aus dem Ausbau-Fahrplan und an der{' '}
          <Link href="/tools/dach">Dachfläche</Link>, wenn du zusätzlich Solar rechnest.
        </p>

        <p className="caption-xs mt-6 text-ink-soft">
          Die Heizlast ist eine Näherung auf Basis deiner Eingaben. Abgasführung, Kraftstoffanschluss und
          CO-Warnanlage sind Einbauten, die nach Herstellervorgaben und durch Fachpersonal gehören.
        </p>
      </div>
    </section>
  );
}
