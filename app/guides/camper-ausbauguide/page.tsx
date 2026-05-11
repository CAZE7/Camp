import React from "react";
import ScrollSidebar from "./ScrollSidebar";

export const metadata = {
  title: "Der ultimative Camper Ausbauguide",
  description: "Von der leeren Blechbüchse zum rollenden Zuhause. Technik, Normen und Profi-Tipps.",
};

export default function CamperAusbauguide() {
  const headings = [
    { id: "gesamtstrategie", text: "1. Gesamtstrategie", level: 2 },
    { id: "planung", text: "2. Planung & Vorbereitung", level: 2 },
    { id: "karosserie", text: "3. Karosserie", level: 2 },
    { id: "daemmung", text: "4. Isolierung & Dämmung", level: 2 },
    { id: "elektrik", text: "5. Elektrik", level: 2 },
    { id: "wasser", text: "6. Wasser & Sanitär", level: 2 },
    { id: "gas", text: "7. Gasinstallation", level: 2 },
    { id: "klima", text: "8. Klima & Heizung", level: 2 },
    { id: "innenausbau", text: "9. Innenausbau", level: 2 },
    { id: "zulassung", text: "10. Zulassung", level: 2 },
    { id: "faq", text: "11. FAQ", level: 2 },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] pt-24 pb-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-12">
        {/* Sidebar */}
        <div className="hidden lg:block lg:w-1/4">
          <ScrollSidebar headings={headings} />
        </div>

        {/* Content */}
        <div className="lg:w-3/4 bg-white p-8 md:p-14 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
          
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 mb-8 leading-tight">
            Der ultimative Camper-Ausbau-Guide:<br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
              Von der leeren Blechbüchse zum rollenden Zuhause
            </span>
          </h1>

          <div className="bg-indigo-50 border-l-4 border-indigo-500 p-6 rounded-r-2xl mb-12">
            <p className="text-indigo-900 font-medium text-sm md:text-base leading-relaxed">
              <strong>Technisches Setup für die Sidebar-Navigation (Scroll-Camper):</strong><br/>
              Dieser Text ist für eine Webseite mit &quot;Scrollspy&quot;-Navigation optimiert. Die Inhaltsverzeichniselemente in der fixierten Sidebar verlinken auf die entsprechenden H2/H3-IDs im Text. Ein kleines Camper-SVG-Icon ist in der Sidebar absolut positioniert. Mittels JavaScript wird beim Scrollen erkannt, welcher Abschnitt gerade im Sichtfeld ist. Der Camper &quot;fährt&quot; optisch exakt zu dem Thema, das der User gerade liest.
            </p>
          </div>

          <div className="space-y-6 text-slate-600 text-lg leading-relaxed">
            <h2 className="text-2xl font-bold text-slate-800 mt-12 mb-4">Die Reise beginnt: Dein Traum vom Vanlife</h2>
            <p>
              Stell dir vor: Du wachst auf, öffnest die Hecktüren deines Vans und blickst direkt auf einen nebelverhangenen Bergsee. Der Kaffee brüht bereits auf dem Gasherd, und du weißt: Alles um dich herum hast du selbst mit deinen eigenen Händen erschaffen. Der Weg zum fertigen Camper ist lang, manchmal frustrierend und voller Überraschungen – aber er ist auch eines der erfüllendsten Projekte, die du je angehen wirst.
            </p>
            <p>
              Dieser Guide ist dein Co-Pilot. Wir gehen nicht nur durch die <em>Was</em>-Schritte, sondern klären vor allem das <em>Warum</em> und das <em>Wie</em>. Schluss mit Halbwissen: Hier gibt es handfeste Normen, exakte Materialstärken und das geballte Wissen, das du brauchst, um teure Anfängerfehler zu vermeiden.
            </p>

            <div className="w-full aspect-video bg-slate-100 rounded-2xl flex items-center justify-center my-8 border border-slate-200">
               <span className="text-slate-400 font-medium">[Bild/Infografik: Vorher-Nachher-Bild eines Vans]</span>
            </div>

            <hr className="border-slate-200 my-12" />

            <h2 id="gesamtstrategie" className="text-3xl font-black text-slate-900 mt-16 mb-6">1. Gesamtstrategie und Bauphasen</h2>
            <p>
              Ein Ausbau ohne Plan ist wie eine Fahrt ohne Navi: Man kommt irgendwo an, aber selten dort, wo man hinwollte. Wer die Reihenfolge der Gewerke missachtet, baut am Ende Dinge doppelt ab.
            </p>

            <h3 className="text-xl font-bold text-slate-800 mt-8 mb-4">1.1 Der perfekte Bauablauf (Chronologisch)</h3>
            <ol className="list-decimal pl-6 space-y-3 font-medium text-slate-700">
              <li><strong>Planung & Fahrzeugkauf:</strong> Budget, Layout, Gewichtsplanung.</li>
              <li><strong>Entkernung & Rostvorsorge:</strong> Das Fundament muss gesund sein.</li>
              <li><strong>Karosseriearbeiten:</strong> Fenster, Dachluken, Landstromanschluss (Flexen tut nur beim ersten Mal weh!).</li>
              <li><strong>Kabel- und Rohrwege planen:</strong> Leerrohre und Trassen VOR der Dämmung setzen.</li>
              <li><strong>Dämmung & Isolierung:</strong> Alubutyl und Armaflex (oder Alternativen).</li>
              <li><strong>Unterkonstruktion & Boden:</strong> Lattung, Holme verkleiden, Bodenplatte.</li>
              <li><strong>Technik-Installation (Rohbau):</strong> Elektrik-Verkabelung, Wasserleitungen, Standheizung.</li>
              <li><strong>Innenausbau (Hülle):</strong> Wand- und Deckenverkleidung.</li>
              <li><strong>Möbelbau & Technik-Endmontage:</strong> Schränke, Bett, Anschließen der Geräte.</li>
              <li><strong>TÜV & Abnahme:</strong> Wohnmobilzulassung und Gasprüfung.</li>
            </ol>

            <div className="bg-amber-50 p-6 rounded-2xl border border-amber-200 my-8">
              <p className="mb-3 text-amber-900"><strong>💡 Profi-Tipp:</strong> Mach dir einen digitalen &quot;Schattenriss&quot; deines Vans (z.B. in SketchUp oder Vanspace3D) und plane jeden Millimeter, besonders die Kabelwege und Leerrohre.</p>
              <p className="text-amber-900"><strong>⚠️ Häufiger Anfängerfehler:</strong> Kabel lose in der Dämmung verlegen. Später willst du einen Schrank anschrauben, triffst ein unsichtbares Kabel und darfst die halbe Wand wieder aufreißen. Nutze immer Wellrohre und befestige sie am Blech!</p>
            </div>

            <hr className="border-slate-200 my-12" />

            <h2 id="planung" className="text-3xl font-black text-slate-900 mt-16 mb-6">2. Planung, Basis & Vorbereitung</h2>
            
            <h3 className="text-xl font-bold text-slate-800 mt-8 mb-4">2.1 Das richtige Fahrzeug finden</h3>
            <p>
              Die Fahrzeugklasse bestimmt den gesamten Ausbau. <strong>H2/L2</strong> (Höhe 2, Länge 2 - z.B. Fiat Ducato, ca. 5,40m lang) ist der Sweetspot für Alltagstauglichkeit und Platz.
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-4 mb-6">
              <li><strong>Stehhöhe:</strong> Achte auf H2 (ca. 1,90m - 1,93m Innenhöhe im Rohzustand). Vergiss nicht: Bodenkonstruktion (ca. 3-4cm) und Deckenverkleidung (ca. 2-3cm) fressen Höhe!</li>
              <li><strong>Breite:</strong> Fiat Ducato / Peugeot Boxer / Citroën Jumper sind die einzigen gängigen Kastenwagen, die Querbetten für Menschen bis 1,85m zulassen, ohne dass man die Karosserie mit seitlichen GfK-Verbreiterungen (&quot;Flares&quot;) aufschneiden muss. Ein Sprinter verjüngt sich nach oben stark.</li>
            </ul>

            <div className="bg-rose-50 p-6 rounded-2xl border border-rose-200 my-6">
              <p className="text-rose-900">
                <strong>Was passiert, wenn... du die Stehhöhe falsch berechnest?</strong><br/>
                Du musst jahrelang in deinem rollenden Zuhause den Kopf einziehen. Das führt unweigerlich zu Nackenproblemen und Frust. Plane immer mit mindestens 5-7 cm Verlust durch Dämmung, Boden und Decke.
              </p>
            </div>

            <h3 className="text-xl font-bold text-slate-800 mt-8 mb-4">2.2 Material- & Werkzeug-Checkliste</h3>
            <p>Ohne das richtige Spezialwerkzeug wird der Ausbau zur Qual.</p>
            <div className="grid md:grid-cols-2 gap-8 mt-6 mb-8">
              <div>
                <h4 className="font-bold text-slate-800 mb-3">Must-Have Werkzeuge:</h4>
                <ul className="list-disc pl-5 space-y-2 text-sm">
                  <li><strong>Blechknabber / Nibbler:</strong> Für saubere Fensterausschnitte ohne das Blech zu verbiegen.</li>
                  <li><strong>Crimpzange (Hydraulisch für 16-50mm²):</strong> Unerlässlich für dicke Batteriekabel.</li>
                  <li><strong>Crimpzange (für 0,5-6mm²):</strong> Für Flachsteckerhülsen und Aderendhülsen (niemals Löten!).</li>
                  <li><strong>Nietmutternzange (M4-M8):</strong> Gewinde sicher im Blech verankern.</li>
                  <li><strong>Multimeter:</strong> Für Elektrik-Checks und Fehlersuche.</li>
                </ul>
              </div>
              <div>
                 <h4 className="font-bold text-slate-800 mb-3">Wichtige Materialien:</h4>
                 <ul className="list-disc pl-5 space-y-2 text-sm">
                  <li><strong>Holz:</strong> Siebdruckplatte (12-15mm) für den Boden, Pappelsperrholz (12-15mm) für Möbel.</li>
                  <li><strong>Kleber:</strong> SikaFlex 552 AT oder Dekasyl MS-5 (Konstruktionskleber).</li>
                  <li><strong>Dichtmasse:</strong> Dekaseal 8936 (Abtupfbare, elastische Masse für Fenster).</li>
                  <li><strong>Rostschutz:</strong> Brantho-Korrux 3in1.</li>
                </ul>
              </div>
            </div>

            <hr className="border-slate-200 my-12" />

            <h2 id="karosserie" className="text-3xl font-black text-slate-900 mt-16 mb-6">3. Karosserie & Außenhülle</h2>
            <p>Hier wird aus dem Transporter ein Camper. Löcher ins Blech zu schneiden kostet Überwindung, ist aber mit der richtigen Vorbereitung machbar.</p>

            <h3 className="text-xl font-bold text-slate-800 mt-8 mb-4">3.1 Fenstereinbau & Dachluken</h3>
            <ul className="list-disc pl-6 space-y-2 mb-6">
              <li><strong>Wie:</strong> Ausschnitt großflächig mit Kreppband abkleben. Vorbohren an den Ecken (10mm Bohrer). Mit Stichsäge schneiden.</li>
              <li><strong>Das Wichtigste:</strong> Die Schnittkante MUSS sofort entgratet, gereinigt und mit Rostschutz versiegelt werden.</li>
              <li><strong>Abdichten:</strong> Fenster immer mit <strong>Dekaseal 8936</strong> einsetzen. Niemals Konstruktionskleber verwenden!</li>
            </ul>

            <div className="bg-amber-50 p-6 rounded-2xl border border-amber-200 my-6">
              <p className="text-amber-900">
                <strong>⚠️ Häufiger Anfängerfehler:</strong> Den Holz-Hilfsrahmen vergessen. Das Blech ist nur ~1mm dick, Fensterklemmen brauchen aber oft 26-34mm. Du musst einen passenden Holzrahmen von innen gegen das Blech kleben, bevor du das Fenster verschraubst.
              </p>
            </div>

            <h3 className="text-xl font-bold text-slate-800 mt-8 mb-4">3.2 Dachdurchführungen & Landstrom</h3>
            <p>
              Nutze für Solarkabel eine wasserdichte Dachdurchführungs-Dose. Diese wird aufs Dach geklebt. Die CEE-Landstromsteckdose (230V) wird in die Seitenwand eingebaut, meist hinter einer unauffälligen Klappe.
            </p>

            <hr className="border-slate-200 my-12" />

            <h2 id="daemmung" className="text-3xl font-black text-slate-900 mt-16 mb-6">4. Isolierung & Dämmung</h2>
            <p>Warum dämmen wir? Nicht nur, damit es warm bleibt, sondern um <strong>Kondenswasser</strong> und damit unweigerlich Rost und Schimmel zu verhindern.</p>

            <h3 className="text-xl font-bold text-slate-800 mt-8 mb-4">4.1 Die Physik dahinter</h3>
            <p className="mb-4">
              <strong>Warum:</strong> Menschen dünsten nachts Feuchtigkeit aus. Trifft warme Innenluft auf das kalte Karosserieblech, wird der &quot;Taupunkt&quot; unterschritten und das Wasser kondensiert flüssig am Blech.<br/>
              <strong>Wie verhindern:</strong> Dämmung vollflächig und luftdicht verkleben, um eine Barriere zu schaffen.
            </p>

            <h3 className="text-xl font-bold text-slate-800 mt-8 mb-4">4.2 Materialkunde & Stärken</h3>
            <ul className="list-disc pl-6 space-y-2 mb-6">
              <li><strong>Alubutyl (Entdröhnung):</strong> Nimmt die Schwingungen aus dem Blech. Es reicht, <strong>30-50%</strong> der Flächen zu bekleben. Mehr bringt akustisch kaum Vorteile, addiert aber massiv Gewicht.</li>
              <li><strong>Armaflex XG oder AF (Wärmedämmung):</strong> 19mm stark für Wände und Decke, 9mm für Boden und Holme. Hohlräume mit Schafwolle ausstopfen.</li>
            </ul>

            <div className="bg-rose-50 p-6 rounded-2xl border border-rose-200 my-6">
              <p className="text-rose-900">
                <strong>Was passiert, wenn... du Lücken in der Dämmung lässt?</strong><br/>
                An diesen &quot;Wärmebrücken&quot; kondensiert das gesamte Wasser des Innenraums. Langfristig rosten dir dort die Holme von innen nach außen durch.
              </p>
            </div>

            <hr className="border-slate-200 my-12" />

            <h2 id="elektrik" className="text-3xl font-black text-slate-900 mt-16 mb-6">5. Elektrik – Das Nervenzentrum</h2>

            <h3 className="text-xl font-bold text-slate-800 mt-8 mb-4">5.1 Normen & Sicherheit (DIN VDE 0100-721)</h3>
            <p>Der Einbau von 230V-Anlagen (Landstrom) unterliegt zwingend der Norm DIN VDE 0100-721.</p>
            <ul className="list-disc pl-6 space-y-2 mb-6">
              <li><strong>Pflicht:</strong> Ein 2-poliger FI/LS-Schutzschalter (RCBO, 30mA, 10A-16A).</li>
              <li><strong>Pflicht:</strong> Kabel vom Typ <strong>H07RN-F</strong> (Gummischlauchleitung). Starrkabel (NYM) brechen durch Vibrationen!</li>
              <li><strong>Pflicht:</strong> Aderendhülsen an den Litzenenden. Niemals verzinnen (Brandgefahr durch Kaltfließen).</li>
            </ul>

            <h3 className="text-xl font-bold text-slate-800 mt-8 mb-4">5.2 Batterien & Ladekonzepte</h3>
            <p>Wir raten heute fast ausnahmslos zu <strong>LiFePO4-Batterien (Lithium)</strong>. Sie wiegen nur ein Drittel einer AGM, halten 10x länger und sind zu fast 100% entladbar.</p>

            <h3 className="text-xl font-bold text-slate-800 mt-8 mb-4">5.3 Kabelquerschnitte berechnen</h3>
            <p>Je weiter der Weg und je höher der Strom, desto dicker das Kabel. Nutze zwingend Online-Kabelrechner. Ein Kühlschrank auf 5 Meter benötigt bereits mind. 2,5mm²!</p>

            <div className="bg-amber-50 p-6 rounded-2xl border border-amber-200 my-8">
              <p className="text-amber-900"><strong>💡 Profi-Tipp:</strong> Setze Sicherungen so nah wie möglich an die Batterie. Die Sicherung schützt das KABEL vor dem Durchschmoren, nicht das Endgerät!</p>
            </div>

            <hr className="border-slate-200 my-12" />

            <h2 id="wasser" className="text-3xl font-black text-slate-900 mt-16 mb-6">6. Wasser & Sanitär</h2>
            
            <h3 className="text-xl font-bold text-slate-800 mt-8 mb-4">6.1 Druck- vs. Tauchpumpe</h3>
            <div className="grid md:grid-cols-2 gap-8 mb-6">
               <div>
                  <h4 className="font-bold text-slate-800 mb-2">Tauchpumpe</h4>
                  <p className="text-sm">Hängt im Tank, läuft an durch Mikroschalter im Hahn. Günstig, simpel, wenig Druck.</p>
               </div>
               <div>
                  <h4 className="font-bold text-slate-800 mb-2">Druckwasserpumpe</h4>
                  <p className="text-sm">Sitzt außerhalb. Baut permanent Druck auf. Wichtig: Druckausgleichsbehälter verbauen, sonst stottert die Pumpe.</p>
               </div>
            </div>

            <hr className="border-slate-200 my-12" />

            <h2 id="gas" className="text-3xl font-black text-slate-900 mt-16 mb-6">7. Gasinstallation (DIN EN 1949)</h2>
            <p>Gas erfordert höchsten Respekt. Der Gaskasten muss luftdicht zum Innenraum verschlossen sein und eine Entlüftungsöffnung (mind. 100 cm²) im Boden haben. Lass die Anlage zwingend vom TÜV prüfen (G607-Prüfung)!</p>

            <hr className="border-slate-200 my-12" />

            <h2 id="klima" className="text-3xl font-black text-slate-900 mt-16 mb-6">8. Klima & Heizung</h2>
            <p>Die <strong>Diesel-Standheizung (z.B. Autoterm Air 2D)</strong> ist der Favorit. Zieht Diesel direkt aus dem Tank. Warum 2kW und nicht 4kW? Eine 4kW-Heizung taktet in kleinen Vans zu oft, verrußt und geht kaputt. 2kW reichen für H2L2 völlig aus.</p>
            
            <hr className="border-slate-200 my-12" />

            <h2 id="innenausbau" className="text-3xl font-black text-slate-900 mt-16 mb-6">9. Innenausbau (Boden, Wände, Möbel)</h2>
            <p>Verwende für Möbelbau <strong>Pappelsperrholz</strong> (oft mit CPL-Beschichtung, da kratzfest). Nutze Pocketholes oder Alu-Profile. Schrauben reißen bei Erschütterung sonst schnell aus.</p>

            <hr className="border-slate-200 my-12" />

            <h2 id="zulassung" className="text-3xl font-black text-slate-900 mt-16 mb-6">10. Zulassung & Sicherheit</h2>
            <p>Um dein Fahrzeug als Wohnmobil zuzulassen, fordert der TÜV: Bett, Tisch, Sitzgelegenheit, Stauraum und einen fest verbauten Kocher.</p>
            
            <div className="bg-rose-50 p-6 rounded-2xl border border-rose-200 my-6">
              <p className="text-rose-900">
                <strong>⚠️ Achtung:</strong> Ein 3,5-Tonner darf max. 3.500 kg wiegen (inkl. Passagiere). Fahre VOR dem endgültigen Möbelbau auf eine Waage!
              </p>
            </div>

            <hr className="border-slate-200 my-12" />

            <h2 id="faq" className="text-3xl font-black text-slate-900 mt-16 mb-6">11. FAQ: Die brennendsten Fragen</h2>
            
            <div className="space-y-6">
               <div>
                 <h4 className="font-bold text-slate-800 text-lg">Wie lange dauert ein kompletter Camper-Ausbau?</h4>
                 <p>Realistisch für absolute Anfänger neben einem Vollzeitjob: 6 bis 12 Monate (ca. 400 - 800 Arbeitsstunden).</p>
               </div>
               <div>
                 <h4 className="font-bold text-slate-800 text-lg">Was kostet ein Van-Ausbau?</h4>
                 <p>Abgesehen vom Basisfahrzeug solltest du für einen autarken Ausbau zwischen 7.000 € und 15.000 € einplanen.</p>
               </div>
               <div>
                 <h4 className="font-bold text-slate-800 text-lg">Brauche ich wirklich eine Dampfsperre?</h4>
                 <p>Im Van-Bereich scheiden sich die Geister. Der Konsens ist heute: Eine 100% perfekte Dampfsperre ist unmöglich. Setze auf vollflächiges Armaflex und ein exzellentes Lüftungskonzept.</p>
               </div>
            </div>

            <div className="bg-slate-900 text-white p-8 md:p-12 rounded-[2rem] mt-16 text-center">
              <h3 className="text-2xl font-black mb-4">Bereit für den ersten Roadtrip?</h3>
              <p className="text-slate-300 mb-8 max-w-lg mx-auto">
                Der Ausbau wird dich Schweiß, zerschnittene Finger und Nerven kosten. Aber der Moment, in dem du abends am Bergsee die Hecktüren öffnest, ist unbezahlbar.
              </p>
              <button className="bg-indigo-500 hover:bg-indigo-400 text-white font-bold py-4 px-8 rounded-xl transition-colors">
                Tritt unserer Vanlife Community bei
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
