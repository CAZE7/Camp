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
      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-ink mb-6 px-4">
        Inhalt
      </h3>
      <div className="relative pl-6">
        {/* Fine dashed line / road */}
        <div className="absolute left-1 top-0 bottom-0 w-px border-l border-dashed border-rule z-0" />
        
        {/* The Camper Icon */}
        <div
          className="absolute left-[-11px] w-6 h-6 transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] z-10 flex items-center justify-center"
          style={{ transform: `translateY(${camperYOffset + 10}px)` }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-4 h-4 text-moss drop-shadow-sm bg-bone rounded-full"
          >
            <path d="M2 12h18a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H2" />
            <path d="M4 12V8a2 2 0 0 1 2-2h8l3 4h3" />
            <circle cx="7" cy="18" r="2" />
            <circle cx="17" cy="18" r="2" />
          </svg>
        </div>

        <ul className="flex flex-col relative z-0 space-y-0.5">
          {headings.map((heading, idx) => (
            <li
              key={heading.id}
              ref={(el) => { itemRefs.current[idx] = el; }}
              className={cn(
                "py-2 px-3 rounded-xl transition-all duration-300 cursor-pointer text-sm font-medium h-[44px] flex items-center group/item",
                activeId === heading.id
                  ? "text-moss bg-moss/5 shadow-sm"
                  : "text-ink-soft hover:text-ink hover:bg-paper",
                heading.level === 3 ? "ml-4 text-xs" : ""
              )}
            >
              <Link href={`#${heading.id}`} className="block w-full truncate">
                <span className={cn(
                  "inline-block transition-transform duration-300",
                  activeId === heading.id ? "translate-x-1" : "group-hover/item:translate-x-0.5"
                )}>
                  {heading.text}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
