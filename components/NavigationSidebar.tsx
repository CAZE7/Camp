"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Link {
  href: string;
  icon: React.ReactNode;
  label: string;
}

const navLinks: Link[] = [
  {
    href: "/",
    icon: (
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
        <path d="M3 12a9 9 0 1 0 18 0A9 9 0 0 0 3 12" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
    label: "Startseite",
  },
  {
    href: "/tools/elektrik-planer",
    icon: (
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
        <circle cx="12" cy="12" r="1" />
        <path d="M12 1v6m0 6v4" />
        <path d="M4.22 4.22l4.24 4.24m5.08 5.08l4.24 4.24" />
        <path d="M1 12h6m6 0h4" />
        <path d="M4.22 19.78l4.24-4.24m5.08-5.08l4.24-4.24" />
      </svg>
    ),
    label: "Elektrik-Planer",
  },
  {
    href: "/tools/dach",
    icon: (
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
        <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z" />
      </svg>
    ),
    label: "Dach-Planer",
  },
  {
    href: "/tools/wassersystem",
    icon: (
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
        <path d="M12 3v18m0 0c-3 0-6-2-6-5s3-5 6-5 6 2 6 5-3 5-6 5" />
      </svg>
    ),
    label: "Wassersystem",
  },
  {
    href: "/ki-assistent",
    icon: (
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
        <path d="M12 8c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3" />
        <path d="M12 14c-3.314 0-6 1.343-6 3v3h12v-3c0-1.657-2.686-3-6-3" />
      </svg>
    ),
    label: "KI-Assistent",
  },
  {
    href: "/guides",
    icon: (
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
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2" />
        <line x1="10" y1="5" x2="14" y2="5" />
        <line x1="10" y1="9" x2="14" y2="9" />
        <line x1="10" y1="13" x2="14" y2="13" />
      </svg>
    ),
    label: "Guides",
  },
  {
    href: "/forum",
    icon: (
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
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
    label: "Forum",
  },
  {
    href: "/community",
    icon: (
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
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    label: "Gemeinschaft",
  },
];

interface SidebarLinkProps {
  link: Link;
  isActive: boolean;
  isCollapsed: boolean;
  onClick: () => void;
}

const SidebarLink = React.forwardRef<HTMLAnchorElement, SidebarLinkProps>(
  ({ link, isActive, isCollapsed, onClick }, ref) => (
    <Link
      href={link.href}
      ref={ref}
      onClick={onClick}
      className={cn(
        "relative z-10 flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 group",
        isActive
          ? "bg-emerald-100 text-emerald-800 shadow-inner ring-1 ring-emerald-200"
          : "text-stone-600 hover:text-stone-900 hover:bg-white"
      )}
    >
      <span
        className={cn(
          "flex-shrink-0 p-1.5 rounded-lg transition-colors",
          isActive
            ? "bg-emerald-200 text-emerald-700"
            : "bg-stone-100 text-stone-500 group-hover:text-emerald-700 group-hover:bg-emerald-50"
        )}
      >
        {link.icon}
      </span>
      {!isCollapsed && <span className="tracking-tight">{link.label}</span>}
    </Link>
  )
);
SidebarLink.displayName = "SidebarLink";

export default function NavigationSidebar({ isCollapsed = false, onToggle }: { isCollapsed?: boolean; onToggle?: () => void }) {
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);
  const camperRef = useRef<HTMLDivElement>(null);

  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  React.useEffect(() => {
    if (!containerRef.current) return;

    gsap.from(containerRef.current, {
      duration: 0.6,
      opacity: 0,
      x: -50,
      ease: "power2.out",
    });
  }, []);

  React.useEffect(() => {
    if (!camperRef.current) return;

    const svg = camperRef.current.querySelector(".speed-svg");
    if (!svg) return;

    const path = svg.querySelector("#nav-road-path");
    if (!path) return;

    gsap.fromTo(
      path,
      { strokeDashoffset: 100 },
      {
        strokeDashoffset: 0,
        duration: 20,
        repeat: -1,
        ease: "none",
      }
    );
  }, []);

  React.useEffect(() => {
    linkRefs.current.forEach((link, idx) => {
      if (!link) return;

      const isActive = pathname === navLinks[idx].href;

      if (isActive) {
        gsap.to(link, {
          duration: 0.3,
          scale: 1.05,
          overwrite: "auto",
        });
      } else {
        gsap.to(link, {
          duration: 0.3,
          scale: 1,
          overwrite: "auto",
        });
      }
    });
  }, { dependencies: [pathname], scope: containerRef });

  return (
    <aside
      ref={containerRef}
      className={cn(
        "fixed top-0 left-0 h-screen z-40 flex flex-col transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
        isCollapsed ? "w-14" : "w-[17rem]",
        "bg-gradient-to-b from-white via-stone-50 to-emerald-50/40",
        "border-r border-stone-200 shadow-sm"
      )}
      style={{ isolation: "isolate", willChange: 'transform', backfaceVisibility: 'hidden' }}
    >
      {/* Logo / Brand Area */}
      <div className="px-4 pt-6 pb-4 border-b border-stone-200">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
              <circle cx="7" cy="17" r="2" />
              <circle cx="17" cy="17" r="2" />
            </svg>
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="text-stone-900 font-black text-base tracking-tight leading-none">CampCraft</span>
              <span className="text-stone-500 text-[11px] font-medium tracking-wider uppercase mt-0.5">VanLife Plattform</span>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 relative" aria-label="Hauptnavigation">
        {/* Integrated Road Background */}
        <div className="absolute left-7 top-0 bottom-0 w-8 pointer-events-none z-0 opacity-30">
          <svg
            className="w-full h-full speed-svg"
            viewBox="0 0 40 1000"
            preserveAspectRatio="none"
          >
            <defs>
              <path
                id="nav-road-path"
                d="M 20 0 Q 30 100, 20 200 T 20 400 T 20 600 T 20 800 T 20 1000"
                fill="none"
                stroke="#cbd5e1"
                strokeWidth="1"
                strokeDasharray="4 6"
                strokeLinecap="round"
              />
            </defs>
            <use href="#nav-road-path" />
          </svg>
        </div>

        {/* Animated Car on Road */}
        <div ref={camperRef} className="absolute left-3 top-0 pointer-events-none z-5">
          <svg
            className="w-8 h-8 speed-svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#10b981"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              filter: 'drop-shadow(0 0 4px rgba(16, 185, 129, 0.4))',
            }}
          >
            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
            <circle cx="7" cy="17" r="2" />
            <circle cx="17" cy="17" r="2" />
          </svg>
        </div>

        {!isCollapsed && (
          <p className="relative z-10 text-[10px] uppercase tracking-[0.2em] text-stone-500 font-bold px-3 mb-3">Werkzeuge</p>
        )}

        {navLinks.slice(0, 5).map((link, idx) => (
          <SidebarLink
            key={link.href}
            link={link}
            isActive={pathname === link.href}
            isCollapsed={isCollapsed}
            onClick={() => {}}
            ref={(el) => {
              linkRefs.current[idx] = el;
            }}
          />
        ))}

        {!isCollapsed && (
          <p className="relative z-10 text-[10px] uppercase tracking-[0.2em] text-stone-500 font-bold px-3 mb-3 mt-6">Guides & Wissen</p>
        )}

        {navLinks.slice(5).map((link, idx) => {
          const index = idx + 5;
          return (
            <SidebarLink
              key={link.href}
              link={link}
              isActive={pathname === link.href}
              isCollapsed={isCollapsed}
              onClick={() => {}}
              ref={(el) => {
                linkRefs.current[index] = el;
              }}
            />
          );
        })}
      </nav>

      {/* Toggle Button for Desktop */}
      <div className="flex items-center justify-end px-3 py-2 border-t border-stone-200">
        <button
          onClick={() => onToggle && onToggle()}
          className="p-1.5 rounded-lg text-stone-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors focus:outline-none"
          aria-label={isCollapsed ? "Sidebar ausklappen" : "Sidebar einklappen"}
          aria-expanded={!isCollapsed}
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-stone-200 bg-white/70">
        <div className="flex items-center gap-2 text-stone-500 text-[10px] font-medium">
          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
          {!isCollapsed && <span>CampCraft v1.0 — Gute Reise! 🌿</span>}
        </div>
      </div>
    </aside>
  );
}
