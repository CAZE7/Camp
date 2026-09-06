import React from 'react';

export default function HolzausbauGuide() {
  return (
    <div className="max-w-4xl mx-auto p-8 font-sans text-gray-800">
      <h1 className="text-4xl font-bold mb-6 text-gray-900">Camper Holzausbau nach dem BEDMAS-Prinzip</h1>
      <p className="text-lg mb-8 text-gray-600">
        Ein professioneller und effizienter Camper-Ausbau erfordert eine gut durchdachte Reihenfolge.
        Das BEDMAS-Prinzip hilft dir dabei, typische Fehler zu vermeiden und Zeit zu sparen.
      </p>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-3 border-b pb-2">1. Bulkhead removal and base prep (Trennwand entfernen, Rost behandeln)</h2>
        <p className="leading-relaxed">
          Bevor der eigentliche Ausbau beginnen kann, muss das Fahrzeug komplett entkernt werden. Entferne die Trennwand,
          falls vorhanden, um ein offenes Raumgefühl zu schaffen. Reinige den Innenraum gründlich und überprüfe alle
          Blechteile auf Rost. Vorhandener Rost muss abgeschliffen und mit Rostumwandler sowie Grundierung behandelt werden.
          Schließe alle nicht benötigten Löcher im Boden, um spätere Feuchtigkeitsprobleme zu vermeiden.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-3 border-b pb-2">2. Electrical planning and rough-in (Kabel ziehen vor der Isolation)</h2>
        <p className="leading-relaxed">
          Plane deine gesamte 12V- und 230V-Elektrik im Voraus. Ziehe Leerrohre und verlege die Kabelstränge dorthin, wo
          später Lampen, Steckdosen und Verbraucher installiert werden sollen. Dieser Schritt muss vor der Isolierung
          erfolgen, da die Kabel hinter der Dämmung und Verkleidung verschwinden. Denke daran, die Kabelquerschnitte
          entsprechend der erwarteten Stromstärke korrekt zu dimensionieren.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-3 border-b pb-2">3. Doors, windows, and roof vents (Löcher in die Karosserie schneiden)</h2>
        <p className="leading-relaxed">
          Der Einbau von Fenstern, Dachluken und Belüftungssystemen ist ein kritischer Schritt. Miss alles doppelt aus,
          bevor du die Karosserie zerschneidest. Behandle die Schnittkanten zwingend mit Rostschutzfarbe.
          Setze die Fenster und Dachluken mit geeignetem Dichtmittel (z.B. Dekalin Dekaseal) ein, um eine dauerhaft
          wasserdichte Verbindung zu gewährleisten. Ein Holzrahmen auf der Innenseite sorgt für zusätzliche Stabilität.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-3 border-b pb-2">4. More metalwork and mounting points (Verstärkungen für schwere Möbel anbringen)</h2>
        <p className="leading-relaxed">
          Plane, wo schwere Gegenstände wie Küchenzeile, Hängeschränke oder Wassertanks befestigt werden sollen.
          Bringe Nietmuttern (Blindnietmuttern) in den Karosseriestreben an oder klebe/niete zusätzliche Holz- oder
          Metallprofile ein. Diese Verankerungspunkte sind essenziell, da spätere Möbelkästen während der Fahrt extremen
          Belastungen standhalten müssen.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-3 border-b pb-2">5. Appliances and plumbing systems (Wassertanks und Geräte installieren)</h2>
        <p className="leading-relaxed">
          Lege die Position von Frisch- und Abwassertanks fest. Oftmals werden Wassertanks über den Radkästen oder als
          Unterflurtanks installiert. Verlege die Wasserleitungen (z.B. UniQuick-System) und schließe die Wasserpumpe
          sowie den Druckausgleichsbehälter an. Plane auch den Platz für Kühlschrank, Herd und Standheizung und bereite
          die entsprechenden Anschlüsse (Gas, Strom) vor.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-3 border-b pb-2">6. Structure, walls, and interior finish (Wandverkleidung und Möbelbau)</h2>
        <p className="leading-relaxed">
          Nachdem Kabel und Rohre verlegt sowie die Isolierung angebracht ist, wird der Camper mit Profilholz oder
          Sperrholzplatten verkleidet. Nutze leichtes, aber stabiles Holz (z.B. Pappelsperrholz) für den Möbelbau.
          Baue das Bettgerüst, die Küchenzeile und die Sitzbänke und verankere sie an den zuvor vorbereiteten
          Montagepunkten. Zum Schluss folgen die kosmetischen Details, Bodenbelag und Polsterarbeiten.
        </p>
      </section>
    </div>
  );
}
