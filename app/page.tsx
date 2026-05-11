import Link from 'next/link';
import { Outfit } from 'next/font/google';
import { cn } from "@/lib/utils";

const outfit = Outfit({ subsets: ['latin'], display: 'swap' });

function HeroSection() {
  return (
    <div className="max-w-5xl w-full text-center mb-20 mt-16 relative z-10">
      <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-stone-100 border border-stone-200 text-stone-700 text-sm font-bold mb-8 shadow-sm">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
        </span>
        VanLife Engineering Plattform
      </div>
      <h1 className={cn("text-5xl tracking-tight font-black text-stone-900 sm:text-6xl md:text-7xl leading-tight", outfit.className)}>
        <span className="block drop-shadow-sm">Willkommen auf der</span>
        <span className="block text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-800">
          DIY Camper-Ausbau Plattform
        </span>
      </h1>
      <p className="mt-6 max-w-2xl mx-auto text-lg text-stone-600 sm:text-xl md:mt-8 md:text-2xl font-medium leading-relaxed">
        Plane deinen Camper-Ausbau wie ein Profi. Von der Elektrik bis zum Holzausbau, wir begleiten dich auf deinem Weg zum Traum-Camper.
      </p>
    </div>
  );
}

function FeaturesGrid() {
  return (
    <div className="max-w-7xl w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
      {/* Card 1: 2D Elektrik-Planer */}
      <div className="bg-white/95 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgba(16,185,129,0.1)] transition-all duration-300 flex flex-col h-full border border-stone-100 hover:-translate-y-2 overflow-hidden group">
        <div className="h-2 w-full bg-gradient-to-r from-amber-400 to-amber-500" />
        <div className="p-8 flex-grow">
          <div className="text-5xl mb-6 bg-amber-50 text-amber-600 w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">⚡</div>
          <h2 className={cn("block mt-1 text-2xl leading-tight font-black text-stone-800", outfit.className)}>Elektrik-Planer</h2>
          <p className="mt-3 text-stone-500 text-sm font-medium leading-relaxed">
            Zeichne und plane deine 12V Anlage interaktiv. Verbinde Komponenten auf einer 2D-Fläche.
          </p>
        </div>
        <div className="p-8 pt-0 mt-auto">
           <Link href="/elektrik-planung" className="w-full flex items-center justify-center px-6 py-4 border border-transparent text-sm font-bold rounded-2xl text-white bg-stone-800 hover:bg-emerald-600 transition-colors shadow-md">
              Planer starten
           </Link>
        </div>
      </div>

      {/* Card 2: Dachflächen-Planer */}
      <div className="bg-white/95 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgba(16,185,129,0.1)] transition-all duration-300 flex flex-col h-full border border-stone-100 hover:-translate-y-2 overflow-hidden group">
        <div className="h-2 w-full bg-gradient-to-r from-sky-400 to-sky-500" />
        <div className="p-8 flex-grow">
          <div className="text-5xl mb-6 bg-sky-50 w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">🚐</div>
          <h2 className={cn("block mt-1 text-2xl leading-tight font-black text-stone-800", outfit.className)}>Dach-Planer</h2>
          <p className="mt-3 text-stone-500 text-sm font-medium leading-relaxed">
            Plane die Anordnung von Solarpanels und Dachfenstern auf deinem Fahrzeugdach.
          </p>
        </div>
        <div className="p-8 pt-0 mt-auto">
           <Link href="/tools/dach" className="w-full flex items-center justify-center px-6 py-4 border border-transparent text-sm font-bold rounded-2xl text-white bg-stone-800 hover:bg-emerald-600 transition-colors shadow-md">
              Planer starten
           </Link>
        </div>
      </div>

      {/* Card 3: Heizlast-Rechner */}
      <div className="bg-white/95 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgba(16,185,129,0.1)] transition-all duration-300 flex flex-col h-full border border-stone-100 hover:-translate-y-2 overflow-hidden group">
        <div className="h-2 w-full bg-gradient-to-r from-rose-400 to-rose-500" />
        <div className="p-8 flex-grow">
          <div className="text-5xl mb-6 bg-rose-50 w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">🔥</div>
          <h2 className={cn("block mt-1 text-2xl leading-tight font-black text-stone-800", outfit.className)}>Heizlast-Rechner</h2>
          <p className="mt-3 text-stone-500 text-sm font-medium leading-relaxed">
            Berechne den Wärmebedarf basierend auf Fahrzeuggröße und Dämmung in Premium-Qualität.
          </p>
        </div>
        <div className="p-8 pt-0 mt-auto">
           <Link href="/tools/heizung" className="w-full flex items-center justify-center px-6 py-4 border border-transparent text-sm font-bold rounded-2xl text-white bg-stone-800 hover:bg-emerald-600 transition-colors shadow-md">
              Rechner starten
           </Link>
        </div>
      </div>

      {/* Card 4: KI-Ausbau-Assistent */}
      <div className="bg-white/95 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgba(16,185,129,0.1)] transition-all duration-300 flex flex-col h-full border border-stone-100 hover:-translate-y-2 overflow-hidden group">
         <div className="h-2 w-full bg-gradient-to-r from-emerald-400 to-emerald-600" />
         <div className="p-8 flex-grow">
          <div className="text-5xl mb-6 bg-emerald-50 w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">🤖</div>
          <h2 className={cn("block mt-1 text-2xl leading-tight font-black text-stone-800", outfit.className)}>KI-Assistent</h2>
          <p className="mt-3 text-stone-500 text-sm font-medium leading-relaxed">
            Hast du Fragen zum Ausbau? Unser KI-Assistent kennt sich mit DIN VDE Normen bestens aus.
          </p>
        </div>
        <div className="p-8 pt-0 mt-auto">
           <Link href="/ki-assistent" className="w-full flex items-center justify-center px-6 py-4 border border-transparent text-sm font-bold rounded-2xl text-white bg-stone-800 hover:bg-emerald-600 transition-colors shadow-md">
              Chat starten
           </Link>
        </div>
      </div>
    </div>
  );
}

function GuidesSection() {
  return (
    <div className="max-w-7xl w-full mt-16 bg-white/95 rounded-[3rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-10 md:p-14 border border-stone-100 relative z-10">
       <div className="flex items-center gap-4 mb-8">
         <div className="bg-stone-100 p-3 rounded-2xl text-2xl border border-stone-200 shadow-inner">📚</div>
         <h2 className={cn("text-3xl md:text-4xl font-black text-stone-800", outfit.className)}>Ausbau-Guides & Wissen</h2>
       </div>
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           <Link href="/guides/camper-ausbauguide" className="group flex items-center justify-between p-6 bg-stone-50 rounded-3xl shadow-sm border border-stone-200 hover:border-emerald-400 hover:shadow-md transition-all lg:col-span-2">
              <span className={cn("font-bold text-stone-700 group-hover:text-emerald-700 transition-colors text-lg md:text-xl", outfit.className)}>Der ultimative Camper Ausbauguide</span>
              <span className="text-emerald-500 group-hover:translate-x-1 transition-transform">➔</span>
           </Link>
           <Link href="/guides/ausbau-fahrplan" className="group flex items-center justify-between p-6 bg-stone-50 rounded-3xl shadow-sm border border-stone-200 hover:border-emerald-400 hover:shadow-md transition-all">
              <span className={cn("font-bold text-stone-700 group-hover:text-emerald-700 transition-colors text-lg", outfit.className)}>Der komplette Ausbau-Fahrplan</span>
              <span className="text-emerald-500 group-hover:translate-x-1 transition-transform">➔</span>
           </Link>
           <Link href="/guides/holzausbau" className="group flex items-center justify-between p-6 bg-stone-50 rounded-3xl shadow-sm border border-stone-200 hover:border-amber-400 hover:shadow-md transition-all">
              <span className={cn("font-bold text-stone-700 group-hover:text-amber-700 transition-colors text-lg", outfit.className)}>Holzausbau-Guide für Anfänger</span>
              <span className="text-amber-500 group-hover:translate-x-1 transition-transform">➔</span>
           </Link>
       </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8 font-sans selection:bg-emerald-100 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.05),transparent_40%),radial-gradient(circle_at_80%_80%,rgba(217,119,6,0.05),transparent_40%)] pointer-events-none" />

      <HeroSection />
      <FeaturesGrid />
      <GuidesSection />
    </div>
  );
}
