'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface Heading {
  id: string;
  text: string;
  level: number;
}

interface ScrollSidebarProps {
  headings: Heading[];
}

export default function ScrollSidebar({ headings }: ScrollSidebarProps) {
  const [activeId, setActiveId] = useState<string>(headings[0]?.id || '');
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const handleScroll = () => {
      const headingElements = headings.map((h) => document.getElementById(h.id));

      let currentActiveId: string = headings[0]?.id ?? '';
      let currentIndex = 0;

      for (let i = 0; i < headingElements.length; i++) {
        const el = headingElements[i];
        if (el) {
          const rect = el.getBoundingClientRect();
          // Adjust the offset threshold based on header height
          if (rect.top <= 150) {
            currentActiveId = headings[i]?.id ?? currentActiveId;
            currentIndex = i ?? currentIndex;
          }
        }
      }

      setActiveId(currentActiveId);
      setActiveIndex(currentIndex);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    // Initial call
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [headings]);

  // Calculate the camper Y position based on the active item
  const camperYOffset = activeIndex * 44; // 44px is roughly the height of an li item

  return (
    <div className="sticky top-24 w-full">
      <h3 className="mb-6 px-4 text-sm font-bold uppercase tracking-wider text-slate-400">Inhalt</h3>
      <div className="relative pl-6">
        {/* Fine dashed line / road */}
        <div className="absolute bottom-0 left-1 top-0 z-0 w-px border-l border-dashed border-slate-300" />

        {/* The Camper Icon */}
        <div
          className="ease-[cubic-bezier(0.34,1.56,0.64,1)] absolute left-[-11px] z-10 flex h-6 w-6 items-center justify-center transition-transform duration-500"
          style={{ transform: `translateY(${camperYOffset + 10}px)` }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4 rounded-full bg-white text-emerald-600 drop-shadow-sm"
          >
            <path d="M2 12h18a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H2" />
            <path d="M4 12V8a2 2 0 0 1 2-2h8l3 4h3" />
            <circle cx="7" cy="18" r="2" />
            <circle cx="17" cy="18" r="2" />
          </svg>
        </div>

        <ul className="relative z-0 flex flex-col space-y-0.5">
          {headings.map((heading, idx) => (
            <li
              key={heading.id}
              ref={(el) => {
                itemRefs.current[idx] = el;
              }}
              className={cn(
                'group/item flex h-[44px] cursor-pointer items-center rounded-xl px-3 py-2 text-sm font-medium transition-all duration-300',
                activeId === heading.id
                  ? 'bg-emerald-50/50 text-emerald-700 shadow-sm'
                  : 'text-slate-500 hover:bg-slate-50/80 hover:text-slate-900',
                heading.level === 3 ? 'ml-4 text-xs' : ''
              )}
            >
              <Link href={`#${heading.id}`} className="block w-full truncate">
                <span
                  className={cn(
                    'inline-block transition-transform duration-300',
                    activeId === heading.id ? 'translate-x-1' : 'group-hover/item:translate-x-0.5'
                  )}
                >
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
