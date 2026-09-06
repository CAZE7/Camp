import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#f1f5f9] flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8 font-sans selection:bg-blue-100 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[50vh] bg-gradient-to-b from-blue-600/10 to-transparent pointer-events-none" />
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-400/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-400/20 rounded-full blur-[120px] pointer-events-none" />

      {/* Hero Section */}
      <div className="max-w-5xl w-full text-center mb-20 mt-16 relative z-10">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-sm font-bold mb-8 shadow-sm">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
          </span>
          VanLife Engineering Plattform
        </div>
        <h1 className="text-5xl tracking-tight font-black text-slate-900 sm:text-6xl md:text-7xl leading-tight">
          <span className="block drop-shadow-sm">Willkommen auf der</span>
          <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600">
            DIY Camper-Ausbau Plattform
          </span>
        </h1>
        <p className="mt-6 max-w-2xl mx-auto text-lg text-slate-600 sm:text-xl md:mt-8 md:text-2xl font-medium leading-relaxed">
          Plane deinen Camper-Ausbau wie ein Profi. Von der Elektrik bis zum Holzausbau, wir begleiten dich auf deinem Weg zum Traum-Camper.
        </p>
      </div>

      {/* Features Grid */}
      <div className="max-w-7xl w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
        {/* Card 1: 2D Elektrik-Planer */}
        <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgb(37,99,235,0.1)] transition-all duration-300 flex flex-col h-full border border-white hover:-translate-y-2 overflow-hidden group">
          <div className="h-2 w-full bg-gradient-to-r from-yellow-400 to-orange-500" />
          <div className="p-8 flex-grow">
            <div className="text-5xl mb-6 bg-yellow-50 w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">⚡</div>
            <h2 className="block mt-1 text-2xl leading-tight font-black text-slate-800">Elektrik-Planer</h2>
            <p className="mt-3 text-slate-500 text-sm font-medium leading-relaxed">
              Zeichne und plane deine 12V Anlage interaktiv. Verbinde Komponenten auf einer 2D-Fläche.
            </p>
          </div>
          <div className="p-8 pt-0 mt-auto">
             <Link href="/elektrik-planung" className="w-full flex items-center justify-center px-6 py-4 border border-transparent text-sm font-bold rounded-xl text-white bg-slate-900 hover:bg-blue-600 transition-colors shadow-md">
                Planer starten
             </Link>
          </div>
        </div>

        {/* Card 2: Dachflächen-Planer */}
        <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgb(37,99,235,0.1)] transition-all duration-300 flex flex-col h-full border border-white hover:-translate-y-2 overflow-hidden group">
          <div className="h-2 w-full bg-gradient-to-r from-sky-400 to-blue-500" />
          <div className="p-8 flex-grow">
            <div className="text-5xl mb-6 bg-sky-50 w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">🚐</div>
            <h2 className="block mt-1 text-2xl leading-tight font-black text-slate-800">Dach-Planer</h2>
            <p className="mt-3 text-slate-500 text-sm font-medium leading-relaxed">
              Plane die Anordnung von Solarpanels und Dachfenstern auf deinem Fahrzeugdach.
            </p>
          </div>
          <div className="p-8 pt-0 mt-auto">
             <Link href="/tools/dach" className="w-full flex items-center justify-center px-6 py-4 border border-transparent text-sm font-bold rounded-xl text-white bg-slate-900 hover:bg-blue-600 transition-colors shadow-md">
                Planer starten
             </Link>
          </div>
        </div>

        {/* Card 3: Heizlast-Rechner */}
        <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgb(37,99,235,0.1)] transition-all duration-300 flex flex-col h-full border border-white hover:-translate-y-2 overflow-hidden group">
          <div className="h-2 w-full bg-gradient-to-r from-red-400 to-rose-500" />
          <div className="p-8 flex-grow">
            <div className="text-5xl mb-6 bg-red-50 w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">🔥</div>
            <h2 className="block mt-1 text-2xl leading-tight font-black text-slate-800">Heizlast-Rechner</h2>
            <p className="mt-3 text-slate-500 text-sm font-medium leading-relaxed">
              Berechne den Wärmebedarf basierend auf Fahrzeuggröße und Dämmung in Premium-Qualität.
            </p>
          </div>
          <div className="p-8 pt-0 mt-auto">
             <Link href="/tools/heizung" className="w-full flex items-center justify-center px-6 py-4 border border-transparent text-sm font-bold rounded-xl text-white bg-slate-900 hover:bg-blue-600 transition-colors shadow-md">
                Rechner starten
             </Link>
          </div>
        </div>

        {/* Card 4: KI-Ausbau-Assistent */}
        <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgb(37,99,235,0.1)] transition-all duration-300 flex flex-col h-full border border-white hover:-translate-y-2 overflow-hidden group">
           <div className="h-2 w-full bg-gradient-to-r from-purple-400 to-indigo-500" />
           <div className="p-8 flex-grow">
            <div className="text-5xl mb-6 bg-purple-50 w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">🤖</div>
            <h2 className="block mt-1 text-2xl leading-tight font-black text-slate-800">KI-Assistent</h2>
            <p className="mt-3 text-slate-500 text-sm font-medium leading-relaxed">
              Hast du Fragen zum Ausbau? Unser KI-Assistent kennt sich mit DIN VDE Normen bestens aus.
            </p>
          </div>
          <div className="p-8 pt-0 mt-auto">
             <Link href="/ki-assistent" className="w-full flex items-center justify-center px-6 py-4 border border-transparent text-sm font-bold rounded-xl text-white bg-slate-900 hover:bg-blue-600 transition-colors shadow-md">
                Chat starten
             </Link>
          </div>
        </div>
      </div>

      {/* Guides Section */}
      <div className="max-w-7xl w-full mt-16 bg-white/60 backdrop-blur-md rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-10 md:p-14 border border-white relative z-10">
         <div className="flex items-center gap-4 mb-8">
           <div className="bg-indigo-100 p-3 rounded-2xl text-2xl">📚</div>
           <h2 className="text-3xl font-black text-slate-800">Ausbau-Guides & Wissen</h2>
         </div>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <Link href="/guides/ausbau-fahrplan" className="group flex items-center justify-between p-6 bg-white rounded-2xl shadow-sm border border-slate-100 hover:border-indigo-300 hover:shadow-md transition-all">
                <span className="font-bold text-slate-700 group-hover:text-indigo-600 transition-colors text-lg">Der komplette Ausbau-Fahrplan</span>
                <span className="text-indigo-400 group-hover:translate-x-1 transition-transform">➔</span>
             </Link>
             <Link href="/guides/holzausbau" className="group flex items-center justify-between p-6 bg-white rounded-2xl shadow-sm border border-slate-100 hover:border-amber-300 hover:shadow-md transition-all">
                <span className="font-bold text-slate-700 group-hover:text-amber-600 transition-colors text-lg">Holzausbau-Guide für Anfänger</span>
                <span className="text-amber-400 group-hover:translate-x-1 transition-transform">➔</span>
             </Link>
         </div>
      </div>
    </div>
  );
}
