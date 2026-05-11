"use client";

import React, { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";

// Register plugins
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, MotionPathPlugin);
}

export default function RoadTripAnimation() {
  const containerRef = useRef<HTMLDivElement>(null);
  const camperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const path = document.querySelector("#road-path") as SVGPathElement;
    if (!path || !camperRef.current) return;

    // Use a small timeout to ensure DOM is fully laid out
    const initAnimation = () => {
      // Calculate max scroll depth
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;

      // Animate the camper along the SVG path
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: document.body,
          start: "top top",
          end: "bottom bottom",
          scrub: 1, // smooth scrubbing, takes 1 second to "catch up"
        }
      });

      tl.to(camperRef.current, {
        motionPath: {
          path: path,
          align: path,
          alignOrigin: [0.5, 0.5],
          autoRotate: true,
        },
        ease: "none",
      });
    };

    // We delay the initialization slightly to allow Next.js to render all content (so bottom bottom triggers correctly)
    const timer = setTimeout(initAnimation, 500);

    return () => {
      clearTimeout(timer);
      ScrollTrigger.getAll().forEach(t => t.kill());
    };
  }, []);

  return (
    <div ref={containerRef} className="fixed left-0 top-0 w-24 md:w-32 lg:w-48 h-screen pointer-events-none z-10 opacity-30 lg:opacity-100">
      {/* SVG Path for the winding road */}
      <svg
        className="w-full h-full"
        viewBox="0 0 100 1000"
        preserveAspectRatio="none"
      >
        {/* Background color for the sidebar area to blend with page */}
        <rect x="0" y="0" width="100" height="1000" fill="transparent" />

        {/* The Road */}
        <path
          id="road-path"
          d="M 50 10 C 90 200, 10 350, 50 500 C 90 650, 10 800, 50 950 L 50 1000"
          fill="none"
          stroke="#78716c" // stone-500
          strokeWidth="3"
          strokeDasharray="6 8"
          strokeLinecap="round"
        />

        {/* The Beach Area (Sand and Water) at the bottom */}
        {/* Sand */}
        <path d="M 0 940 Q 50 920 100 950 L 100 1000 L 0 1000 Z" fill="#fcd34d" /> {/* amber-300 */}
        {/* Water */}
        <path d="M 0 970 Q 50 960 100 980 L 100 1000 L 0 1000 Z" fill="#7dd3fc" /> {/* sky-300 */}
        
        {/* Mini Palm Tree */}
        <path d="M 20 950 Q 25 930 20 910" fill="none" stroke="#78350f" strokeWidth="2" />
        <path d="M 20 910 Q 10 900 5 915 M 20 910 Q 30 900 35 915 M 20 910 Q 20 890 10 885" fill="none" stroke="#059669" strokeWidth="2" />
      </svg>

      {/* The Camper Icon */}
      {/* Adding a subtle drop shadow to make it pop over the text if overlapping */}
      <div
        ref={camperRef}
        className="absolute w-10 h-10 flex items-center justify-center bg-stone-100 rounded-lg shadow-xl border-2 border-emerald-700 text-emerald-800"
        style={{ top: 0, left: 0, opacity: 0 }} // initially hidden until GSAP positions it
        onLoad={(e) => (e.currentTarget.style.opacity = '1')} // reveal
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
           <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
           <circle cx="7" cy="17" r="2.5" fill="#10b981" stroke="none" />
           <path d="M9 17h6"/>
           <circle cx="17" cy="17" r="2.5" fill="#10b981" stroke="none" />
        </svg>
      </div>
    </div>
  );
}
