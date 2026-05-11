"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Heading {
  id: string;
  text: string;
  level: number;
}

interface ScrollSidebarProps {
  headings: Heading[];
}

export default function ScrollSidebar({ headings }: ScrollSidebarProps) {
  const [activeId, setActiveId] = useState<string>(headings[0]?.id || "");
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const handleScroll = () => {
      const headingElements = headings.map((h) => document.getElementById(h.id));
      
      let currentActiveId = headings[0]?.id;
      let currentIndex = 0;

      for (let i = 0; i < headingElements.length; i++) {
        const el = headingElements[i];
        if (el) {
          const rect = el.getBoundingClientRect();
          // Adjust the offset threshold based on header height
          if (rect.top <= 150) {
            currentActiveId = headings[i].id;
            currentIndex = i;
          }
        }
      }

      setActiveId(currentActiveId);
      setActiveIndex(currentIndex);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    // Initial call
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [headings]);

  // Calculate the camper Y position based on the active item
  const camperYOffset = activeIndex * 44; // 44px is roughly the height of an li item

  return (
    <div className="sticky top-24 w-full">
      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-6 px-4">
        Inhalt
      </h3>
      <div className="relative border-l-2 border-slate-100 pl-4">
        {/* The Camper Icon */}
        <div
          className="absolute left-[-16px] w-8 h-8 transition-transform duration-300 ease-out z-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-200"
          style={{ transform: `translateY(${camperYOffset}px)` }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-4 h-4 text-indigo-600"
          >
            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
            <circle cx="7" cy="17" r="2" />
            <path d="M9 17h6" />
            <circle cx="17" cy="17" r="2" />
          </svg>
        </div>

        <ul className="flex flex-col relative z-0">
          {headings.map((heading, idx) => (
            <li
              key={heading.id}
              ref={(el) => { itemRefs.current[idx] = el; }}
              className={cn(
                "py-2 px-3 rounded-lg transition-colors cursor-pointer text-sm font-medium h-[44px] flex items-center",
                activeId === heading.id
                  ? "text-indigo-600 bg-indigo-50/50"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-50",
                heading.level === 3 ? "ml-4 text-xs" : ""
              )}
            >
              <Link href={`#${heading.id}`} className="block w-full truncate">
                {heading.text}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
