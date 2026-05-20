import Link from "next/link";
import { BookOpen } from "lucide-react";
import { Outfit } from "next/font/google";
import { cn } from "@/lib/utils";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const outfit = Outfit({ subsets: ["latin"], display: "swap" });

/* ─── Tool Data ─── */
const tools = [
  {
    title: "Dach-Planer",
    description:
      "Plane die Anordnung von Solarpanels, Dachfenstern und Antennen auf deinem Fahrzeugdach – millimetergenau.",
    href: "/tools/dach",
    progress: 0,
    accentFrom: "from-sky-400",
    accentTo: "to-cyan-500",
    progressColor: "bg-sky-500",
    progressTrack: "bg-sky-100",
    iconBg: "bg-sky-50",
    iconColor: "text-sky-600",
    buttonLabel: "Dach planen",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-7 h-7"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2" />
        <path d="M12 20v2" />
        <path d="m4.93 4.93 1.41 1.41" />
        <path d="m17.66 17.66 1.41 1.41" />
        <path d="M2 12h2" />
        <path d="M20 12h2" />
        <path d="m6.34 17.66-1.41 1.41" />
        <path d="m19.07 4.93-1.41 1.41" />
      </svg>
    ),
  },
  {
    title: "Elektrik-Zentrale",
    description:
      "Zeichne deine komplette 12V/230V Anlage interaktiv. Verbinde Batterie, Solar, Sicherungen und Verbraucher auf einer 2D-Fläche.",
    href: "/elektrik-planung",
    progress: 0,
    accentFrom: "from-amber-400",
    accentTo: "to-orange-500",
    progressColor: "bg-amber-500",
    progressTrack: "bg-amber-100",
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
    buttonLabel: "Elektrik planen",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-7 h-7"
      >
        <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
  },
  {
    title: "Heizungs-Planer",
    description:
      "Berechne den exakten Wärmebedarf basierend auf Fahrzeuggröße, Dämmung und Zieltemperatur. Finde die passende Standheizung.",
    href: "/tools/heizung",
    progress: 0,
    accentFrom: "from-rose-400",
    accentTo: "to-red-500",
    progressColor: "bg-rose-500",
    progressTrack: "bg-rose-100",
    iconBg: "bg-rose-50",
    iconColor: "text-rose-600",
    buttonLabel: "Heizlast berechnen",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-7 h-7"
      >
        <path d="M12 12c-2-2.67-4-4-4-6a4 4 0 0 1 8 0c0 2-2 3.33-4 6z" />
        <path d="M12 21a8 8 0 0 0 4-15 8 8 0 0 0-8 0 8 8 0 0 0 4 15z" />
      </svg>
    ),
  },
];

const guides = [
  {
    title: "Der ultimative Camper Ausbauguide",
    href: "/guides/camper-ausbauguide",
    span: "lg:col-span-2",
  },
  {
    title: "Der komplette Ausbau-Fahrplan",
    href: "/guides/ausbau-fahrplan",
    span: "",
  },
  {
    title: "Holzausbau-Guide für Anfänger",
    href: "/guides/holzausbau",
    span: "",
  },
];

/* ─── Progress Bar Component ─── */
function ProgressBar({
  value,
  colorClass,
  trackClass,
}: {
  value: number;
  colorClass: string;
  trackClass: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
          Fortschritt
        </span>
        <span className="text-[11px] font-black text-stone-600 tabular-nums">
          {value}%
        </span>
      </div>
      <div
        className={cn(
          "h-2 w-full rounded-full overflow-hidden",
          trackClass
        )}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700 ease-out",
            colorClass,
            value === 0 && "w-0"
          )}
          style={{ width: `${Math.max(value, 0)}%` }}
        />
      </div>
    </div>
  );
}

/* ─── Hero Section ─── */
function HeroSection() {
  return (
    <section className="relative max-w-4xl w-full text-center mb-16 mt-12">
      {/* Status badge */}
      <div className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full bg-stone-900/5 border border-stone-200 text-stone-600 text-xs font-bold mb-8 shadow-sm backdrop-blur-sm">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        VanLife Engineering Plattform
      </div>

      {/* Headline */}
      <h1
        className={cn(
          "text-4xl sm:text-5xl md:text-6xl font-black text-stone-900 leading-[1.1] tracking-tight",
          outfit.className
        )}
      >
        Plane deinen Camper{" "}
        <span className="relative inline-block">
          <span className="relative z-10">nicht auf Papier.</span>
          <span
            className="absolute bottom-1 left-0 w-full h-3 bg-amber-300/40 -skew-x-2 rounded-sm z-0"
            aria-hidden="true"
          />
        </span>
        <br />
        <span className="text-emerald-700">
          Nutze unsere interaktiven Tools.
        </span>
      </h1>

      {/* Subline */}
      <p className="mt-6 max-w-2xl mx-auto text-base sm:text-lg text-stone-500 font-medium leading-relaxed">
        Von der ersten Skizze bis zur TÜV-Abnahme. Drei spezialisierte Werkzeuge,
        die deinen Ausbau auf Profi-Niveau heben — komplett kostenlos.
      </p>

      {/* CTA */}
      <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
        <Button
          asChild
          size="lg"
          className="rounded-2xl px-8 py-6 text-base font-bold bg-stone-900 hover:bg-stone-800 text-white shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5"
        >
          <Link href="/elektrik-planung">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5 mr-2"
            >
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
            Neues Projekt starten
          </Link>
        </Button>
      </div>

      {/* Stats ribbon */}
      <div className="mt-14 flex flex-wrap items-center justify-center gap-8 sm:gap-12 text-stone-400">
        <div className="flex flex-col items-center">
          <span
            className={cn(
              "text-2xl sm:text-3xl font-black text-stone-800",
              outfit.className
            )}
          >
            3
          </span>
          <span className="text-[11px] font-bold uppercase tracking-wider mt-0.5">
            Planungs-Tools
          </span>
        </div>
        <div className="w-px h-8 bg-stone-200" />
        <div className="flex flex-col items-center">
          <span
            className={cn(
              "text-2xl sm:text-3xl font-black text-stone-800",
              outfit.className
            )}
          >
            100%
          </span>
          <span className="text-[11px] font-bold uppercase tracking-wider mt-0.5">
            Kostenlos
          </span>
        </div>
        <div className="w-px h-8 bg-stone-200" />
        <div className="flex flex-col items-center">
          <span
            className={cn(
              "text-2xl sm:text-3xl font-black text-stone-800",
              outfit.className
            )}
          >
            DIN VDE
          </span>
          <span className="text-[11px] font-bold uppercase tracking-wider mt-0.5">
            Normgerecht
          </span>
        </div>
      </div>
    </section>
  );
}

/* ─── Tool Card Grid ─── */
function ToolGrid() {
  return (
    <section className="max-w-5xl w-full relative z-10">
      {/* Section header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-stone-800 to-stone-700 flex items-center justify-center shadow-sm">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-4 h-4"
          >
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        </div>
        <h2
          className={cn(
            "text-2xl sm:text-3xl font-black text-stone-800",
            outfit.className
          )}
        >
          Deine Werkzeuge
        </h2>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {tools.map((tool) => (
          <Card
            key={tool.href}
            className={cn(
              "relative overflow-hidden border-0 rounded-3xl",
              "bg-white/95 backdrop-blur-sm",
              "shadow-[0_8px_30px_rgb(0,0,0,0.04)]",
              "hover:shadow-[0_20px_50px_rgba(0,0,0,0.08)]",
              "hover:-translate-y-1.5",
              "transition-all duration-300 ease-out",
              "group"
            )}
          >
            {/* Top accent bar */}
            <div
              className={cn(
                "h-1.5 w-full bg-gradient-to-r rounded-t-3xl",
                tool.accentFrom,
                tool.accentTo
              )}
            />

            <CardHeader className="px-6 pt-6 pb-0">
              {/* Icon */}
              <div
                className={cn(
                  "mb-4 group-hover:scale-110 transition-all duration-300 inline-block",
                  tool.iconColor
                )}
              >
                {tool.icon}
              </div>

              <CardTitle
                className={cn(
                  "text-xl font-black text-stone-800 leading-tight",
                  outfit.className
                )}
              >
                {tool.title}
              </CardTitle>

              <CardDescription className="mt-2 text-stone-500 text-sm font-medium leading-relaxed">
                {tool.description}
              </CardDescription>
            </CardHeader>

            <CardContent className="px-6 pt-5 pb-2">
              <ProgressBar
                value={tool.progress}
                colorClass={tool.progressColor}
                trackClass={tool.progressTrack}
              />
            </CardContent>

            <CardFooter className="px-6 py-4 border-t border-stone-100 bg-stone-50/50">
              <Button
                asChild
                className={cn(
                  "w-full rounded-xl font-bold text-sm h-11",
                  "bg-stone-800 hover:bg-stone-700 text-white",
                  "shadow-sm hover:shadow-md transition-all",
                  "group-hover:bg-gradient-to-r",
                  `group-hover:${tool.accentFrom}`,
                  `group-hover:${tool.accentTo}`
                )}
              >
                <Link href={tool.href}>
                  {tool.buttonLabel}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform"
                  >
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                </Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </section>
  );
}

/* ─── Guides Section ─── */
function GuidesSection() {
  return (
    <section className="max-w-5xl w-full mt-16 mb-12 relative z-10 flex flex-col items-center opacity-80 hover:opacity-100 transition-opacity">
      <div className="flex flex-col items-center text-center mb-6">
        <h3 className={cn("text-lg font-bold text-stone-500 flex items-center gap-2", outfit.className)}>
          <BookOpen size={18} />
          Ausbau-Guides &amp; Wissen
        </h3>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        {guides.map((guide) => (
          <Link
            key={guide.href}
            href={guide.href}
            className="group flex items-center gap-2 px-4 py-2 rounded-full bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-stone-900 transition-colors text-sm font-medium"
          >
            {guide.title}
            <span className="text-stone-400 group-hover:text-stone-600 transition-colors text-xs">
              ➔
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ─── Quick-Start Tip ─── */
function QuickStartTip() {
  return (
    <section className="max-w-5xl w-full mt-10 mb-8 relative z-10">
      <div className="flex items-start gap-4 p-6 rounded-2xl bg-emerald-50/60 border border-emerald-200/60">
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-5 h-5"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
        </div>
        <div>
          <p
            className={cn(
              "text-sm font-bold text-emerald-900",
              outfit.className
            )}
          >
            Tipp: Beginne mit dem Elektrik-Planer
          </p>
          <p className="text-sm text-emerald-800/70 mt-1 leading-relaxed">
            Die Elektrik bestimmt die Kabelwege und damit den gesamten
            Innenausbau. Plane Sicherungen, Batterien und Verbraucher zuerst —
            dann baust du den Rest drumherum.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ─── Main Page ─── */
export default function Home() {
  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center py-10 px-4 sm:px-6 lg:px-8 font-sans selection:bg-emerald-100 relative overflow-hidden">
      {/* Decorative radial gradients */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 15% 20%, rgba(16,185,129,0.06), transparent 45%), radial-gradient(circle at 85% 75%, rgba(217,119,6,0.05), transparent 45%)",
        }}
      />

      {/* Subtle topographic pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <HeroSection />
      <ToolGrid />
      <QuickStartTip />
      <GuidesSection />
    </div>
  );
}
