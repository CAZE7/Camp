import Link from 'next/link';

/**
 * Vorlagen-Text unter dem Dach-Canvas. Der Canvas selbst bleibt Client-Component;
 * dieser Block wird in den Static Export hinein gerendert und liefert die
 * Begriffe, nach denen Leute suchen (Solarkollektiven, Dachluke, Abstände, Watt).
 */
export function DachExplainer() {
  return (
    <section aria-labelledby="dacherklaerung-heading" className="container-page border-t border-rule py-12">
      <h2 id="dacherklaerung-heading" className="font-display text-xl font-semibold text-ink md:text-2xl">
        Dachfläche planen: Solarpaneele und Dachluken richtig setzen
      </h2>
      <p className="mt-3 text-sm text-ink-soft">
        Der Planer arbeitet auf der nutzbaren Fläche deines Fahrzeugs. Nach der Modellwahl stehen die
        Maßangaben in Zentimetern fest, und jede Platzierung wird gegen die Safe Zone geprüft — also gegen die
        Abstände zu Vorderkante, Heck, linken und rechten Rand.
      </p>

      <h3 className="panel-title mt-6">Was du ablesen kannst</h3>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-ink-soft">
        <li>
          <strong className="font-medium text-ink">Gesamt-Watt</strong> — die Summe aller gesetzten
          Solarmodule, direkt oben im Kopf des Planers.
        </li>
        <li>
          <strong className="font-medium text-ink">Randabstände</strong> — ein Element, das über die Safe Zone
          hinausragt, wird mit der Überschreitung in Zentimetern gemeldet.
        </li>
        <li>
          <strong className="font-medium text-ink">Überlappungen</strong> — zwei Module an derselben Stelle
          erzeugen Abschattung; der Planer weist sie einzeln aus.
        </li>
      </ul>

      <h3 className="panel-title mt-6">Reihenfolge</h3>
      <p className="mt-3 text-sm text-ink-soft">
        Erst die Dachluken setzen, weil sie Lüftung und damit die Heizlast mitbestimmen; danach die Module auf
        die verbleibende Fläche. Die Gesamtleistung übergibst du mit „Im Schaltplan öffnen“ an den{' '}
        <Link href="/elektrik-planung">Schaltplan-Editor</Link>, wo Laderegler und Batteriebank dazu passen.
      </p>

      <p className="caption-xs mt-6 text-ink-soft">
        Die Platzierung ist eine Planungshilfe. Traglast, Dachhaut-Arbeiten und die Dichtheit nach dem Schnitt
        prüfst du am Fahrzeug — oder über eine Fachwerkstatt.
      </p>
    </section>
  );
}
