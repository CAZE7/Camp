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
      <div className="max-w-6xl w-full grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Card 1: 2D Elektrik-Planer */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 flex flex-col h-full">
          <div className="p-8 flex-grow">
            <div className="uppercase tracking-wide text-sm text-blue-600 font-semibold mb-2">Elektrik</div>
            <h2 className="block mt-1 text-2xl leading-tight font-bold text-gray-900">2D Elektrik-Planer</h2>
            <p className="mt-4 text-gray-600 text-lg">
              Zeichne und plane deine 12V Anlage interaktiv. Wähle Komponenten und verbinde sie auf einer visuellen 2D-Fläche.
            </p>
          </div>
          <div className="p-8 pt-0 mt-auto">
             <Link href="/elektrik-planung" className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 md:py-4 md:text-lg">
                Planer starten
             </Link>
          </div>
        </div>

        {/* Card 2: KI-Ausbau-Assistent */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 flex flex-col h-full">
           <div className="p-8 flex-grow">
            <div className="uppercase tracking-wide text-sm text-blue-600 font-semibold mb-2">Hilfe & Beratung</div>
            <h2 className="block mt-1 text-2xl leading-tight font-bold text-gray-900">KI-Ausbau-Assistent</h2>
            <p className="mt-4 text-gray-600 text-lg">
              Hast du Fragen zum Ausbau? Unser KI-Assistent kennt sich mit DIN VDE Normen und Camper-Komponenten bestens aus.
            </p>
          </div>
          <div className="p-8 pt-0 mt-auto">
             <Link href="/ki-assistent" className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 md:py-4 md:text-lg">
                Chat starten
             </Link>
          </div>
        </div>

        {/* Card 3: Ausbau-Guides */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 flex flex-col h-full">
           <div className="p-8 flex-grow">
            <div className="uppercase tracking-wide text-sm text-blue-600 font-semibold mb-2">Wissen</div>
            <h2 className="block mt-1 text-2xl leading-tight font-bold text-gray-900">Ausbau-Guides</h2>
            <p className="mt-4 text-gray-600 text-lg">
              Schritt-für-Schritt Anleitungen und Fachwissen. Aktuell verfügbar: unser umfassender Guide zum Holzausbau.
            </p>
          </div>
          <div className="p-8 pt-0 mt-auto">
             <Link href="/guides/holzausbau" className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 md:py-4 md:text-lg">
                Guides lesen
             </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
