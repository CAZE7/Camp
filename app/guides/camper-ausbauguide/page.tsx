import React from "react";
import RoadTripAnimation from "./RoadTripAnimation";
import { Outfit } from 'next/font/google';
import { cn } from "@/lib/utils";

const outfit = Outfit({ subsets: ['latin'], display: 'swap' });

export const metadata = {
  title: "Der ultimative Camper Ausbauguide",
  description: "Von der leeren Blechbüchse zum rollenden Zuhause. Technik, Normen und Profi-Tipps.",
};

export default function CamperAusbauguide() {
  return (
    <div id="ausbau-page" className="min-h-screen bg-stone-50 pt-24 pb-32 px-4 sm:px-6 relative overflow-hidden">
      
      {/* GSAP Animation Sidebar / Background track */}
      <RoadTripAnimation />

      {/* Main Content Area - Shifted slightly to the right to make room for the fixed animation on larger screens */}
      <div className="max-w-4xl mx-auto lg:ml-56 xl:ml-auto xl:mr-auto relative z-20">
        
        {/* Paper-like container */}
        <div className="bg-white/95 backdrop-blur-sm p-8 md:p-16 rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border border-stone-200">
          
          <h1 className={cn("text-4xl md:text-6xl font-black text-stone-900 mb-8 leading-tight", outfit.className)}>
            Der ultimative Camper-Ausbau-Guide:<br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-700 drop-shadow-sm">
              Von der leeren Blechbüchse zum rollenden Zuhause
            </span>
          </h1>

          <div className="bg-emerald-50/80 border-l-4 border-emerald-500 p-6 rounded-r-2xl mb-12 shadow-sm">
            <p className="text-emerald-900 font-medium text-sm md:text-base leading-relaxed">
              <strong>Technisches Setup für die Storytelling-Navigation:</strong><br/>
              Auf der linken Seite deines Bildschirms siehst du unseren Camper. Scrolle nach unten, und das Auto folgt dem kurvigen Weg bis an den Strand. Diese Animation wurde mit <strong>GSAP ScrollTrigger</strong> und dem <strong>MotionPathPlugin</strong> umgesetzt.
            </p>
          </div>

          <div className="space-y-6 text-stone-600 text-lg md:text-xl leading-relaxed">
            <h2 className={cn("text-2xl md:text-3xl font-bold text-stone-800 mt-12 mb-4", outfit.className)}>Die Reise beginnt: Dein Traum vom Vanlife</h2>
            <p>
              Stell dir vor: Du wachst auf, öffnest die Hecktüren deines Vans und blickst direkt auf einen nebelverhangenen Bergsee. Der Kaffee brüht bereits auf dem Gasherd, und du weißt: Alles um dich herum hast du selbst mit deinen eigenen Händen erschaffen. Der Weg zum fertigen Camper ist lang, manchmal frustrierend und voller Überraschungen – aber er ist auch eines der erfüllendsten Projekte, die du je angehen wirst.
            </p>
            <p>
              Dieser Guide ist dein Co-Pilot. Wir gehen nicht nur durch die <em>Was</em>-Schritte, sondern klären vor allem das <em>Warum</em> und das <em>Wie</em>. Schluss mit Halbwissen: Hier gibt es handfeste Normen, exakte Materialstärken und das geballte Wissen, das du brauchst, um teure Anfängerfehler zu vermeiden.
            </p>

            {/* Decorative Image Placeholder */}
            <div className="w-full aspect-video bg-stone-100 rounded-3xl flex items-center justify-center my-10 border-2 border-stone-200 shadow-inner relative overflow-hidden group">
               <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-40 group-hover:opacity-60 transition-opacity duration-700"></div>
               <span className="text-stone-700 font-bold tracking-widest uppercase z-10 bg-white/80 px-6 py-3 rounded-full backdrop-blur-md shadow-sm">Ausbau Impressionen</span>
            </div>

            <hr className="border-stone-200/60 my-16" />

            <h2 className={cn("text-3xl md:text-4xl font-black text-stone-800 mt-16 mb-6", outfit.className)}>1. Gesamtstrategie und Bauphasen</h2>
            <p>
              Ein Ausbau ohne Plan ist wie eine Fahrt ohne Navi: Man kommt irgendwo an, aber selten dort, wo man hinwollte. Wer die Reihenfolge der Gewerke missachtet, baut am Ende Dinge doppelt ab.
            </p>

            <h3 className={cn("text-xl md:text-2xl font-bold text-stone-700 mt-10 mb-6", outfit.className)}>1.1 Der perfekte Bauablauf (Chronologisch)</h3>
            <ol className="list-decimal pl-6 space-y-4 font-medium text-stone-600 bg-stone-50 p-8 rounded-2xl border border-stone-100">
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

            <div className="bg-amber-50/80 p-8 rounded-3xl border border-amber-200 my-10 shadow-[0_8px_30px_rgb(251,191,36,0.15)] relative overflow-hidden">
              <div className="absolute top-0 left-0 w-2 h-full bg-amber-400"></div>
              <p className="mb-4 text-amber-900 text-lg"><strong>💡 Profi-Tipp:</strong> Mach dir einen digitalen &quot;Schattenriss&quot; deines Vans (z.B. in SketchUp oder Vanspace3D) und plane jeden Millimeter, besonders die Kabelwege und Leerrohre.</p>
              <p className="text-amber-900 text-lg"><strong>⚠️ Häufiger Anfängerfehler:</strong> Kabel lose in der Dämmung verlegen. Später willst du einen Schrank anschrauben, triffst ein unsichtbares Kabel und darfst die halbe Wand wieder aufreißen. Nutze immer Wellrohre und befestige sie am Blech!</p>
            </div>

            <hr className="border-stone-200/60 my-16" />

            <h2 className={cn("text-3xl md:text-4xl font-black text-stone-800 mt-16 mb-6", outfit.className)}>2. Planung, Basis & Vorbereitung</h2>
            
            <h3 className={cn("text-xl md:text-2xl font-bold text-stone-700 mt-10 mb-6", outfit.className)}>2.1 Das richtige Fahrzeug finden</h3>
            <p>
              Die Fahrzeugklasse bestimmt den gesamten Ausbau. <strong>H2/L2</strong> (Höhe 2, Länge 2 - z.B. Fiat Ducato, ca. 5,40m lang) ist der Sweetspot für Alltagstauglichkeit und Platz.
            </p>
            <ul className="list-disc pl-6 space-y-3 mt-6 mb-8 text-stone-600">
              <li><strong>Stehhöhe:</strong> Achte auf H2 (ca. 1,90m - 1,93m Innenhöhe im Rohzustand). Vergiss nicht: Bodenkonstruktion (ca. 3-4cm) und Deckenverkleidung (ca. 2-3cm) fressen Höhe!</li>
              <li><strong>Breite:</strong> Fiat Ducato / Peugeot Boxer / Citroën Jumper sind die einzigen gängigen Kastenwagen, die Querbetten für Menschen bis 1,85m zulassen, ohne dass man die Karosserie mit seitlichen GfK-Verbreiterungen (&quot;Flares&quot;) aufschneiden muss.</li>
            </ul>

            <div className="bg-rose-50/80 p-8 rounded-3xl border border-rose-200 my-8 shadow-[0_8px_30px_rgb(244,63,94,0.1)] relative">
              <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl">🚨</div>
              <p className="text-rose-900 text-lg relative z-10">
                <strong>Was passiert, wenn... du die Stehhöhe falsch berechnest?</strong><br/><br/>
                Du musst jahrelang in deinem rollenden Zuhause den Kopf einziehen. Das führt unweigerlich zu Nackenproblemen und Frust. Plane immer mit mindestens 5-7 cm Verlust durch Dämmung, Boden und Decke.
              </p>
            </div>

            <h3 className={cn("text-xl md:text-2xl font-bold text-stone-700 mt-12 mb-6", outfit.className)}>2.2 Material- & Werkzeug-Checkliste</h3>
            <p>Ohne das richtige Spezialwerkzeug wird der Ausbau zur Qual.</p>
            
            <div className="grid md:grid-cols-2 gap-8 mt-8 mb-12">
              <div className="bg-stone-50 p-8 rounded-3xl border border-stone-200 shadow-sm">
                <h4 className={cn("font-bold text-emerald-800 text-xl mb-4", outfit.className)}>Must-Have Werkzeuge:</h4>
                <ul className="list-none space-y-3 text-base text-stone-600">
                  <li className="flex gap-3"><span className="text-emerald-500">✓</span> <span><strong>Blechknabber / Nibbler:</strong> Für saubere Fensterausschnitte ohne Blechverzug.</span></li>
                  <li className="flex gap-3"><span className="text-emerald-500">✓</span> <span><strong>Crimpzange (Hydraulisch 16-50mm²):</strong> Unerlässlich für dicke Batteriekabel.</span></li>
                  <li className="flex gap-3"><span className="text-emerald-500">✓</span> <span><strong>Crimpzange (0,5-6mm²):</strong> Für Flachsteckerhülsen (niemals Löten!).</span></li>
                  <li className="flex gap-3"><span className="text-emerald-500">✓</span> <span><strong>Nietmutternzange (M4-M8):</strong> Gewinde sicher im Blech verankern.</span></li>
                  <li className="flex gap-3"><span className="text-emerald-500">✓</span> <span><strong>Multimeter:</strong> Für Elektrik-Checks und Fehlersuche.</span></li>
                </ul>
              </div>
              <div className="bg-stone-50 p-8 rounded-3xl border border-stone-200 shadow-sm">
                 <h4 className={cn("font-bold text-amber-800 text-xl mb-4", outfit.className)}>Wichtige Materialien:</h4>
                 <ul className="list-none space-y-3 text-base text-stone-600">
                  <li className="flex gap-3"><span className="text-amber-500">📦</span> <span><strong>Holz:</strong> Siebdruckplatte (12-15mm) Boden, Pappelsperrholz (12-15mm) Möbel.</span></li>
                  <li className="flex gap-3"><span className="text-amber-500">📦</span> <span><strong>Kleber:</strong> SikaFlex 552 AT oder Dekasyl MS-5 (Konstruktion).</span></li>
                  <li className="flex gap-3"><span className="text-amber-500">📦</span> <span><strong>Dichtmasse:</strong> Dekaseal 8936 (Abtupfbare Masse für Fenster).</span></li>
                  <li className="flex gap-3"><span className="text-amber-500">📦</span> <span><strong>Rostschutz:</strong> Brantho-Korrux 3in1.</span></li>
                </ul>
              </div>
            </div>

            <hr className="border-stone-200/60 my-16" />

            <h2 className={cn("text-3xl md:text-4xl font-black text-stone-800 mt-16 mb-6", outfit.className)}>3. Karosserie & Außenhülle</h2>
            <p>Hier wird aus dem Transporter ein Camper. Löcher ins Blech zu schneiden kostet Überwindung, ist aber mit der richtigen Vorbereitung machbar.</p>

            <h3 className={cn("text-xl md:text-2xl font-bold text-stone-700 mt-10 mb-6", outfit.className)}>3.1 Fenstereinbau & Dachluken</h3>
            <ul className="list-disc pl-6 space-y-3 mb-8 text-stone-600">
              <li><strong>Wie:</strong> Ausschnitt großflächig mit Kreppband abkleben. Vorbohren an den Ecken (10mm Bohrer). Mit Stichsäge schneiden.</li>
              <li><strong>Das Wichtigste:</strong> Die Schnittkante MUSS sofort entgratet, gereinigt und mit Rostschutz versiegelt werden.</li>
              <li><strong>Abdichten:</strong> Fenster immer mit <strong>Dekaseal 8936</strong> einsetzen. Niemals Konstruktionskleber verwenden!</li>
            </ul>

            <div className="bg-amber-50/80 p-8 rounded-3xl border border-amber-200 my-8">
              <p className="text-amber-900 text-lg">
                <strong>⚠️ Häufiger Anfängerfehler:</strong> Den Holz-Hilfsrahmen vergessen. Das Blech ist nur ~1mm dick, Fensterklemmen brauchen aber oft 26-34mm. Du musst einen passenden Holzrahmen von innen gegen das Blech kleben, bevor du das Fenster verschraubst.
              </p>
            </div>

            <hr className="border-stone-200/60 my-16" />

            <h2 className={cn("text-3xl md:text-4xl font-black text-stone-800 mt-16 mb-6", outfit.className)}>4. Isolierung & Dämmung</h2>
            <p>Warum dämmen wir? Nicht nur, damit es warm bleibt, sondern um <strong>Kondenswasser</strong> und damit unweigerlich Rost und Schimmel zu verhindern.</p>

            <h3 className={cn("text-xl md:text-2xl font-bold text-stone-700 mt-10 mb-6", outfit.className)}>4.1 Materialkunde & Stärken</h3>
            <ul className="list-disc pl-6 space-y-3 mb-8 text-stone-600">
              <li><strong>Alubutyl (Entdröhnung):</strong> Nimmt die Schwingungen aus dem Blech. Es reicht, <strong>30-50%</strong> der Flächen zu bekleben. Mehr bringt akustisch kaum Vorteile, addiert aber massiv Gewicht.</li>
              <li><strong>Armaflex XG oder AF (Wärmedämmung):</strong> 19mm stark für Wände und Decke, 9mm für Boden und Holme. Hohlräume mit Schafwolle ausstopfen.</li>
            </ul>

            <hr className="border-stone-200/60 my-16" />

            <h2 className={cn("text-3xl md:text-4xl font-black text-stone-800 mt-16 mb-6", outfit.className)}>5. Elektrik – Das Nervenzentrum</h2>

            <h3 className={cn("text-xl md:text-2xl font-bold text-stone-700 mt-10 mb-6", outfit.className)}>5.1 Normen & Sicherheit (DIN VDE 0100-721)</h3>
            <p>Der Einbau von 230V-Anlagen (Landstrom) unterliegt zwingend der Norm DIN VDE 0100-721.</p>
            <ul className="list-disc pl-6 space-y-3 mt-6 mb-8 text-stone-600">
              <li><strong>Pflicht:</strong> Ein 2-poliger FI/LS-Schutzschalter (RCBO, 30mA, 10A-16A).</li>
              <li><strong>Pflicht:</strong> Kabel vom Typ <strong>H07RN-F</strong> (Gummischlauchleitung). Starrkabel (NYM) brechen durch Vibrationen!</li>
              <li><strong>Pflicht:</strong> Aderendhülsen an den Litzenenden. Niemals verzinnen (Brandgefahr durch Kaltfließen).</li>
            </ul>

            <h3 className={cn("text-xl md:text-2xl font-bold text-stone-700 mt-10 mb-6", outfit.className)}>5.2 Kabelquerschnitte berechnen</h3>
            <p>Je weiter der Weg und je höher der Strom, desto dicker das Kabel. Nutze zwingend Online-Kabelrechner. Ein Kühlschrank auf 5 Meter benötigt bereits mind. 2,5mm²!</p>

            <div className="bg-amber-50 p-8 rounded-3xl border border-amber-200 my-10">
              <p className="text-amber-900 text-lg"><strong>💡 Profi-Tipp:</strong> Setze Sicherungen so nah wie möglich an die Batterie. Die Sicherung schützt das KABEL vor dem Durchschmoren, nicht das Endgerät!</p>
            </div>

            <hr className="border-stone-200/60 my-16" />

            <h2 className={cn("text-3xl md:text-4xl font-black text-stone-800 mt-16 mb-6", outfit.className)}>6. Klima & Heizung</h2>
            <p>Die <strong>Diesel-Standheizung (z.B. Autoterm Air 2D)</strong> ist der Favorit. Zieht Diesel direkt aus dem Tank. Warum 2kW und nicht 4kW? Eine 4kW-Heizung taktet in kleinen Vans zu oft, verrußt und geht kaputt. 2kW reichen für H2L2 völlig aus.</p>
            
            <hr className="border-stone-200/60 my-16" />

            <h2 className={cn("text-3xl md:text-4xl font-black text-stone-800 mt-16 mb-6", outfit.className)}>7. Innenausbau (Boden, Wände, Möbel)</h2>
            <p>Verwende für Möbelbau <strong>Pappelsperrholz</strong> (oft mit CPL-Beschichtung, da kratzfest). Nutze Pocketholes oder Alu-Profile. Schrauben reißen bei Erschütterung sonst schnell aus.</p>

            <hr className="border-stone-200/60 my-16" />

            <h2 className={cn("text-3xl md:text-4xl font-black text-stone-800 mt-16 mb-6", outfit.className)}>8. Zulassung & Sicherheit</h2>
            <p>Um dein Fahrzeug als Wohnmobil zuzulassen, fordert der TÜV: Bett, Tisch, Sitzgelegenheit, Stauraum und einen fest verbauten Kocher.</p>
            
            <div className="bg-rose-50 p-8 rounded-3xl border border-rose-200 my-8 shadow-sm">
              <p className="text-rose-900 text-lg font-bold">
                ⚠️ Achtung: Ein 3,5-Tonner darf max. 3.500 kg wiegen (inkl. Passagiere). Fahre VOR dem endgültigen Möbelbau auf eine Waage!
              </p>
            </div>

            <hr className="border-stone-200/60 my-16" />

            <div className="bg-stone-900 text-stone-50 p-10 md:p-16 rounded-[3rem] mt-24 text-center relative overflow-hidden shadow-2xl">
              <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')]"></div>
              
              <h3 className={cn("text-3xl md:text-5xl font-black mb-6 relative z-10 text-emerald-400", outfit.className)}>Bereit für den ersten Roadtrip?</h3>
              <p className="text-stone-300 mb-10 max-w-2xl mx-auto text-lg md:text-xl relative z-10 leading-relaxed">
                Der Ausbau wird dich Schweiß, zerschnittene Finger und Nerven kosten. Aber der Moment, in dem du abends am Bergsee die Hecktüren öffnest und das Rauschen der Wellen hörst, ist unbezahlbar.
              </p>
              <button className="relative z-10 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-5 px-10 rounded-full transition-all hover:scale-105 shadow-[0_0_40px_rgba(16,185,129,0.4)] text-lg">
                Tritt unserer Vanlife Community bei
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
