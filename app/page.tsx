import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Hero Section */}
      <div className="max-w-4xl w-full text-center mb-16 mt-10">
        <h1 className="text-4xl tracking-tight font-extrabold text-gray-900 sm:text-5xl md:text-6xl">
          <span className="block">Willkommen auf der</span>
          <span className="block text-blue-600">DIY Camper-Ausbau Plattform</span>
        </h1>
        <p className="mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
          Plane deinen Camper-Ausbau wie ein Profi. Von der Elektrik bis zum Holzausbau, wir begleiten dich auf deinem Weg zum Traum-Camper.
        </p>
      </div>

      {/* Features Grid */}
      <div className="max-w-6xl w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {/* Card 1: 2D Elektrik-Planer */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 flex flex-col h-full border border-gray-100">
          <div className="p-6 flex-grow">
            <div className="text-4xl mb-4">⚡</div>
            <h2 className="block mt-1 text-xl leading-tight font-bold text-gray-900">Elektrik-Planer</h2>
            <p className="mt-2 text-gray-600 text-sm">
              Zeichne und plane deine 12V Anlage interaktiv. Verbinde Komponenten auf einer 2D-Fläche.
            </p>
          </div>
          <div className="p-6 pt-0 mt-auto">
             <Link href="/elektrik-planung" className="w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors">
                Planer starten
             </Link>
          </div>
        </div>

        {/* Card 2: Dachflächen-Planer */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 flex flex-col h-full border border-gray-100">
          <div className="p-6 flex-grow">
            <div className="text-4xl mb-4">☀️</div>
            <h2 className="block mt-1 text-xl leading-tight font-bold text-gray-900">Dach-Planer</h2>
            <p className="mt-2 text-gray-600 text-sm">
              Plane die Anordnung von Solarpanels und Dachfenstern auf deinem Fahrzeugdach.
            </p>
          </div>
          <div className="p-6 pt-0 mt-auto">
             <Link href="/tools/dach" className="w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors">
                Planer starten
             </Link>
          </div>
        </div>

        {/* Card 3: Heizlast-Rechner */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 flex flex-col h-full border border-gray-100">
          <div className="p-6 flex-grow">
            <div className="text-4xl mb-4">🔥</div>
            <h2 className="block mt-1 text-xl leading-tight font-bold text-gray-900">Heizlast-Rechner</h2>
            <p className="mt-2 text-gray-600 text-sm">
              Berechne den Wärmebedarf basierend auf Fahrzeuggröße und Dämmung.
            </p>
          </div>
          <div className="p-6 pt-0 mt-auto">
             <Link href="/tools/heizung" className="w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors">
                Rechner starten
             </Link>
          </div>
        </div>

        {/* Card 4: KI-Ausbau-Assistent */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 flex flex-col h-full border border-gray-100">
           <div className="p-6 flex-grow">
            <div className="text-4xl mb-4">🤖</div>
            <h2 className="block mt-1 text-xl leading-tight font-bold text-gray-900">KI-Assistent</h2>
            <p className="mt-2 text-gray-600 text-sm">
              Hast du Fragen zum Ausbau? Unser KI-Assistent kennt sich mit DIN VDE Normen bestens aus.
            </p>
          </div>
          <div className="p-6 pt-0 mt-auto">
             <Link href="/ki-assistent" className="w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors">
                Chat starten
             </Link>
          </div>
        </div>
      </div>

      {/* Guides Section */}
      <div className="max-w-6xl w-full mt-12 bg-white rounded-xl shadow-md p-8 border border-gray-100">
         <h2 className="text-2xl font-bold text-gray-900 mb-6">📚 Ausbau-Guides & Wissen</h2>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <Link href="/guides/ausbau-fahrplan" className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <span className="font-semibold text-gray-800">Der komplette Ausbau-Fahrplan</span>
                <span className="text-blue-600">➔</span>
             </Link>
             <Link href="/guides/holzausbau" className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <span className="font-semibold text-gray-800">Holzausbau-Guide für Anfänger</span>
                <span className="text-blue-600">➔</span>
             </Link>
         </div>
      </div>
    </div>
  );
}
