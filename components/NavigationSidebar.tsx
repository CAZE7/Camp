"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Register GSAP plugins & performance optimization
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, MotionPathPlugin, useGSAP);
  gsap.ticker.lagSmoothing(0);
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
  const [isCollapsed, setIsCollapsed] = useState(false);

  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  useGSAP(() => {
    const path = document.querySelector("#nav-road-path") as SVGPathElement;
    if (!path || !camperRef.current) return;

    // Dynamic will-change for performance (Lighthouse optimization)
    let scrollTimeout: NodeJS.Timeout;
    const handleScroll = () => {
      if (containerRef.current) {
        containerRef.current.style.willChange = "transform";
        containerRef.current.classList.add("is-scrolling");
      }
      if (camperRef.current) camperRef.current.style.willChange = "transform";
      
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.style.willChange = "auto";
          containerRef.current.classList.remove("is-scrolling");
        }
        if (camperRef.current) camperRef.current.style.willChange = "auto";
      }, 100);
    };

    const scrollContainer = document.querySelector('nav');
    if (scrollContainer) {
      scrollContainer.addEventListener("scroll", handleScroll, { passive: true });
    }

    // Create a series of snap points based on link positions
    const snapPoints: number[] = [];
    const totalLinks = navLinks.length;
    for (let i = 0; i < totalLinks; i++) {
      snapPoints.push(i / (totalLinks - 1));
    }

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: "nav",
        start: "top 20%",
        end: "bottom 80%",
        scrub: 2,
        snap: {
          snapTo: snapPoints,
          duration: { min: 0.2, max: 0.5 },
          delay: 0.1,
          ease: "power2.inOut"
        },
        onUpdate: (self) => {
          if (camperRef.current) {
            const progress = self.progress;
            const opacity = progress < 0.05 ? progress * 20 : progress > 0.95 ? (1 - progress) * 20 : 1;
            gsap.set(camperRef.current, { opacity: Math.max(0, Math.min(1, opacity)), force3D: true });
          }
        }
      },
    });

    tl.to(camperRef.current, {
      motionPath: {
        path: path,
        align: path,
        alignOrigin: [0.5, 0.5],
        autoRotate: true,
      },
      ease: "none",
      force3D: true,
    });

    // Reveal
    if (camperRef.current) {
      gsap.to(camperRef.current, { opacity: 0, duration: 0, force3D: true }); // Start hidden
    }

    return () => {
      if (scrollContainer) {
        scrollContainer.removeEventListener("scroll", handleScroll);
      }
    };
  }, { dependencies: [pathname], scope: containerRef });

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-[60] lg:hidden bg-stone-800/90 text-amber-100 p-4 rounded-2xl border border-stone-700 hover:bg-stone-700 transition-all"
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
          className="fixed inset-0 bg-black/40 z-[45] lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        ref={containerRef}
        className={cn(
          "fixed top-0 left-0 h-screen z-50 flex flex-col transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
          "w-[85vw] max-w-sm", isCollapsed ? "lg:w-14" : "lg:w-[17rem]",
          // Nature gradient background
          "bg-gradient-to-b from-stone-900 via-stone-800 to-[#1a2e1a]",
          "border-r border-stone-700/50",
          // Mobile: slide in/out
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
        style={{ isolation: "isolate", willChange: 'transform', backfaceVisibility: 'hidden' }} // Layer Isolation + Performance
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
            {!isCollapsed && (
              <div className="flex flex-col">
                <span className="text-amber-100 font-black text-base tracking-tight leading-none">CampCraft</span>
                <span className="text-stone-500 text-[11px] font-medium tracking-wider uppercase mt-0.5">VanLife Plattform</span>
              </div>
            )}
          </Link>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 relative" aria-label="Hauptnavigation">
          {/* Integrated Road Background */}
          <div className="absolute left-7 top-0 bottom-0 w-8 pointer-events-none z-0 opacity-20">
            <svg
              className="w-full h-full speed-svg"
              viewBox="0 0 40 1000"
              preserveAspectRatio="none"
              shapeRendering="optimizeSpeed"
            >
              <path
                id="nav-road-path"
                d="M 20 0 Q 30 100, 20 200 T 20 400 T 20 600 T 20 800 T 20 1000"
                fill="none"
                stroke="white"
                strokeWidth="1"
                strokeDasharray="4 6"
                strokeLinecap="round"
                className="gpu-accelerated"
                style={{ willChange: "transform", backfaceVisibility: "hidden" }}
              />
            </svg>
          </div>

          {/* Minimalist Camper Icon - Animated along the road */}
          <div
            ref={camperRef}
            className="absolute left-7 top-0 w-6 h-6 flex items-center justify-center z-10 pointer-events-none gpu-accelerated"
            style={{ opacity: 0, willChange: "transform", backfaceVisibility: "hidden" }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fbbf24"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4 drop-shadow-[0_0_8px_rgba(251,191,36,0.4)] speed-svg"
              shapeRendering="optimizeSpeed"
            >
              <path d="M2 12h18a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H2" />
              <path d="M4 12V8a2 2 0 0 1 2-2h8l3 4h3" />
              <circle cx="7" cy="18" r="2" />
              <circle cx="17" cy="18" r="2" />
            </svg>
          </div>

          {!isCollapsed && (
            <p className="relative z-10 text-[10px] uppercase tracking-[0.2em] text-stone-500 font-bold px-3 mb-3">Werkzeuge</p>
          )}

          {navLinks.slice(0, 5).map((link, idx) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                ref={(el) => { linkRefs.current[idx] = el; }}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "relative z-10 flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 group",
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
                <span className="truncate">{!isCollapsed && link.label}</span>
                {isActive && !isCollapsed && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </Link>
            );
          })}

          {!isCollapsed && (
            <p className="relative z-10 text-[10px] uppercase tracking-[0.2em] text-stone-500 font-bold px-3 mb-3 mt-6">Guides & Wissen</p>
          )}

          {navLinks.slice(5).map((link, idx) => {
            const index = idx + 5;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                ref={(el) => { linkRefs.current[index] = el; }}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "relative z-10 flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 group",
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
                <span className="truncate">{!isCollapsed && link.label}</span>
                {isActive && !isCollapsed && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Toggle Button for Desktop */}
        <div className="hidden lg:flex items-center justify-end px-3 py-2">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-lg text-stone-500 hover:text-amber-300 hover:bg-stone-700/50 transition-colors focus:outline-none"
            aria-label={isCollapsed ? "Sidebar ausklappen" : "Sidebar einklappen"}
          >
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-stone-700/40">
          <div className="flex items-center gap-2 text-stone-600 text-[10px] font-medium">
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
            {!isCollapsed && <span>CampCraft v1.0 — Gute Reise! 🌿</span>}
          </div>
        </div>
      </aside>
    </>
  );
}
