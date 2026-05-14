"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { cn } from "@/lib/utils";

// Register GSAP plugins
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, MotionPathPlugin, useGSAP);
}

const navLinks = [
  {
    href: "/",
    label: "Startseite",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
        <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      </svg>
    ),
  },
  {
    href: "/elektrik-planung",
    label: "Elektrik-Planer",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
  },
  {
    href: "/tools/dach",
    label: "Dach-Planer",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="M3 9h18" />
        <path d="M9 21V9" />
      </svg>
    ),
  },
  {
    href: "/tools/heizung",
    label: "Heizlast-Rechner",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M12 12c-2-2.67-4-4-4-6a4 4 0 0 1 8 0c0 2-2 3.33-4 6z" />
        <path d="M12 21a8 8 0 0 0 4-15 8 8 0 0 0-8 0 8 8 0 0 0 4 15z" />
      </svg>
    ),
  },
  {
    href: "/ki-assistent",
    label: "KI-Assistent",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M12 8V4H8" />
        <rect width="16" height="12" x="4" y="8" rx="2" />
        <path d="M2 14h2" /><path d="M20 14h2" />
        <path d="M15 13v2" /><path d="M9 13v2" />
      </svg>
    ),
  },
  {
    href: "/guides/camper-ausbauguide",
    label: "Ausbau-Guide",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
      </svg>
    ),
  },
  {
    href: "/guides/ausbau-fahrplan",
    label: "Ausbau-Fahrplan",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M8 6h10" /><path d="M6 12h9" /><path d="M11 18h7" />
        <circle cx="4" cy="6" r="1.5" fill="currentColor" />
        <circle cx="4" cy="12" r="1.5" fill="currentColor" />
        <circle cx="4" cy="18" r="1.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    href: "/guides/holzausbau",
    label: "Holzausbau",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M12 13v8" /><path d="M4 13h16" />
        <path d="m17 8-5-6-5 6" /><path d="m17 13-5-3-5 3" />
      </svg>
    ),
  },
];

export default function NavigationSidebar() {
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);
  const camperRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  useGSAP(() => {
    const path = document.querySelector("#nav-road-path") as SVGPathElement;
    if (!path || !camperRef.current) return;

    // Hint browser — promote to GPU layer
    path.style.willChange = "transform, opacity";
    camperRef.current.style.willChange = "transform, opacity";

    ScrollTrigger.refresh();

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: document.documentElement,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.5,
      },
    });

    tl.to(camperRef.current, {
      motionPath: {
        path: path,
        align: path,
        alignOrigin: [0.5, 0.5],
        autoRotate: 90,
      },
      ease: "none",
      force3D: true,
    });

    // Reveal
    if (camperRef.current) {
      gsap.to(camperRef.current, { opacity: 1, duration: 0.6, delay: 0.3, force3D: true });
    }
  }, { dependencies: [pathname], scope: containerRef });

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-[60] lg:hidden bg-stone-800/90 backdrop-blur-md text-amber-100 p-4 rounded-2xl shadow-lg border border-stone-700 hover:bg-stone-700 transition-all"
        aria-label="Navigation öffnen"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
          {isOpen ? (
            <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>
          ) : (
            <><path d="M4 12h16" /><path d="M4 6h16" /><path d="M4 18h16" /></>
          )}
        </svg>
      </button>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[45] lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        ref={containerRef}
        className={cn(
          "fixed top-0 left-0 h-screen z-50 flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
          "w-[85vw] max-w-sm lg:w-[17rem]",
          // Nature gradient background
          "bg-gradient-to-b from-stone-900 via-stone-800 to-[#1a2e1a]",
          "border-r border-stone-700/50",
          "shadow-[4px_0_24px_rgba(0,0,0,0.3)]",
          // Mobile: slide in/out
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo / Brand Area */}
        <div className="px-5 pt-6 pb-4 border-b border-stone-700/40">
          <Link href="/" className="flex items-center gap-3 group" onClick={() => setIsOpen(false)}>
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-900/30 group-hover:scale-110 transition-transform">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
                <circle cx="7" cy="17" r="2" />
                <path d="M9 17h6" />
                <circle cx="17" cy="17" r="2" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-amber-100 font-black text-base tracking-tight leading-none">CampCraft</span>
              <span className="text-stone-500 text-[11px] font-medium tracking-wider uppercase mt-0.5">VanLife Plattform</span>
            </div>
          </Link>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Hauptnavigation">
          <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500 font-bold px-3 mb-3">Werkzeuge</p>

          {navLinks.slice(0, 5).map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 group",
                  isActive
                    ? "bg-emerald-600/20 text-emerald-400 shadow-inner shadow-emerald-900/10"
                    : "text-stone-400 hover:text-amber-200 hover:bg-stone-700/50"
                )}
              >
                <span
                  className={cn(
                    "flex-shrink-0 p-1.5 rounded-lg transition-colors",
                    isActive
                      ? "bg-emerald-600/30 text-emerald-400"
                      : "bg-stone-700/50 text-stone-500 group-hover:text-amber-300 group-hover:bg-stone-700"
                  )}
                >
                  {link.icon}
                </span>
                <span className="truncate">{link.label}</span>
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </Link>
            );
          })}

          <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500 font-bold px-3 mb-3 mt-6">Guides & Wissen</p>

          {navLinks.slice(5).map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 group",
                  isActive
                    ? "bg-emerald-600/20 text-emerald-400 shadow-inner shadow-emerald-900/10"
                    : "text-stone-400 hover:text-amber-200 hover:bg-stone-700/50"
                )}
              >
                <span
                  className={cn(
                    "flex-shrink-0 p-1.5 rounded-lg transition-colors",
                    isActive
                      ? "bg-emerald-600/30 text-emerald-400"
                      : "bg-stone-700/50 text-stone-500 group-hover:text-amber-300 group-hover:bg-stone-700"
                  )}
                >
                  {link.icon}
                </span>
                <span className="truncate">{link.label}</span>
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* GSAP Roadtrip Animation Section */}
        <div className="relative px-3 pb-2 flex-shrink-0">
          <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500 font-bold px-3 mb-2">Dein Roadtrip</p>
          <div className="relative w-full h-52 overflow-hidden rounded-2xl bg-gradient-to-b from-stone-800/60 to-[#0d1f0d]/60 border border-stone-700/30">
            {/* SVG Road Path */}
            <svg
              className="w-full h-full"
              viewBox="0 0 200 400"
              preserveAspectRatio="xMidYMid slice"
            >
              {/* Background elements - Trees */}
              {/* Left trees */}
              <circle cx="30" cy="40" r="14" fill="#1a3a1a" opacity="0.5" />
              <circle cx="25" cy="35" r="10" fill="#1f4a1f" opacity="0.4" />
              <circle cx="40" cy="120" r="12" fill="#1a3a1a" opacity="0.5" />
              <circle cx="35" cy="115" r="8" fill="#1f4a1f" opacity="0.4" />
              <circle cx="20" cy="200" r="16" fill="#1a3a1a" opacity="0.4" />
              <circle cx="50" cy="280" r="10" fill="#1a3a1a" opacity="0.5" />

              {/* Right trees */}
              <circle cx="170" cy="80" r="13" fill="#1a3a1a" opacity="0.5" />
              <circle cx="165" cy="75" r="9" fill="#1f4a1f" opacity="0.4" />
              <circle cx="180" cy="160" r="11" fill="#1a3a1a" opacity="0.4" />
              <circle cx="160" cy="240" r="15" fill="#1a3a1a" opacity="0.5" />

              {/* The winding road - outer glow */}
              <path
                d="M 100 5 C 150 80, 50 140, 100 200 C 150 260, 50 320, 100 370 L 100 400"
                fill="none"
                stroke="rgba(120,113,108,0.15)"
                strokeWidth="28"
                strokeLinecap="round"
              />

              {/* The winding road - road surface */}
              <path
                d="M 100 5 C 150 80, 50 140, 100 200 C 150 260, 50 320, 100 370 L 100 400"
                fill="none"
                stroke="#57534e"
                strokeWidth="14"
                strokeLinecap="round"
              />

              {/* Road center dashes */}
              <path
                id="nav-road-path"
                d="M 100 5 C 150 80, 50 140, 100 200 C 150 260, 50 320, 100 370 L 100 400"
                fill="none"
                stroke="#fbbf24"
                strokeWidth="2"
                strokeDasharray="8 12"
                strokeLinecap="round"
                opacity="0.7"
              />

              {/* Beach at bottom */}
              <path d="M 0 360 Q 50 345 100 355 Q 150 365 200 350 L 200 400 L 0 400 Z" fill="#d4a76a" opacity="0.6" />
              <path d="M 0 380 Q 60 370 120 378 Q 170 385 200 375 L 200 400 L 0 400 Z" fill="#7dd3fc" opacity="0.4" />

              {/* Mini palm tree at beach */}
              <path d="M 155 365 Q 160 350 155 335" fill="none" stroke="#78350f" strokeWidth="3" strokeLinecap="round" />
              <path d="M 155 335 Q 140 328 130 340" fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" />
              <path d="M 155 335 Q 170 328 178 340" fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" />
              <path d="M 155 335 Q 155 320 142 315" fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" />

              {/* Beach umbrella */}
              <line x1="125" y1="375" x2="125" y2="355" stroke="#78350f" strokeWidth="2" />
              <path d="M 115 358 Q 125 345 135 358" fill="#f87171" opacity="0.6" />

              {/* Beach icon - waves */}
              <path d="M 90 392 Q 95 388 100 392 Q 105 396 110 392" fill="none" stroke="#38bdf8" strokeWidth="1.5" opacity="0.5" />
            </svg>

            {/* The Camper Icon - Animated along the road */}
            <div
              ref={camperRef}
              className="absolute w-9 h-9 flex items-center justify-center rounded-xl shadow-[0_6px_20px_rgba(0,0,0,0.4)] border-2 border-emerald-500/70"
              style={{
                top: 0,
                left: 0,
                opacity: 0,
                background: "linear-gradient(135deg, #f5f0e8 0%, #e8e0d0 100%)",
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#166534"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5"
              >
                <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
                <circle cx="7" cy="17" r="2" fill="#10b981" stroke="none" />
                <path d="M9 17h6" />
                <circle cx="17" cy="17" r="2" fill="#10b981" stroke="none" />
              </svg>
            </div>

            {/* Scroll progress indicator */}
            <div className="absolute bottom-2 left-2 right-2 text-center">
              <span className="text-[9px] text-stone-500 font-medium tracking-wider uppercase bg-stone-900/60 px-2 py-0.5 rounded-full backdrop-blur-sm">
                Scroll ↕ zum Fahren
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-stone-700/40">
          <div className="flex items-center gap-2 text-stone-600 text-[10px] font-medium">
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>CampCraft v1.0 — Gute Reise! 🌿</span>
          </div>
        </div>
      </aside>
    </>
  );
}
