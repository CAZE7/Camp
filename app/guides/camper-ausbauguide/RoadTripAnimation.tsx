"use client";

import React, { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";

// Register plugins
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, MotionPathPlugin, useGSAP);
}

export default function RoadTripAnimation() {
  const containerRef = useRef<HTMLDivElement>(null);
  const camperRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const path = document.querySelector("#road-path") as SVGPathElement;
    const pageWrapper = document.querySelector("#ausbau-page");
    
    if (!path || !camperRef.current || !pageWrapper) return;

    // Hint browser for optimization — promote to GPU layer
    path.style.willChange = "transform, opacity";
    camperRef.current.style.willChange = "transform, opacity";

    // Refresh ScrollTrigger to calculate correct heights
    ScrollTrigger.refresh();

    // Animate the camper along the SVG path
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: pageWrapper,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.5, // smooth scrubbing — lower = more responsive
      }
    });

    tl.to(camperRef.current, {
      motionPath: {
        path: path,
        align: path,
        alignOrigin: [0.5, 0.5],
        autoRotate: 90, // Adjust rotation offset if the car points right by default
      },
      ease: "none",
      duration: 1,
      force3D: true,
    }, 0);

    // Ambient UI Interpolation
    tl.to(document.documentElement, {
      "--ambient-bg": "#ffffff",
      "--ambient-glow": "rgba(255, 255, 255, 0.5)",
      ease: "none",
      duration: 0.5
    }, 0);

    tl.to(document.documentElement, {
      "--ambient-bg": "#fff7ed",
      "--ambient-glow": "rgba(255, 247, 237, 0.5)",
      ease: "none",
      duration: 0.5
    }, 0.5);
    
    // Reveal the camper once GSAP has positioned it
    if (camperRef.current) {
      gsap.to(camperRef.current, { opacity: 1, duration: 0.5, force3D: true });
    }
  }, { scope: containerRef });

  return (
    <div ref={containerRef} className="fixed left-0 top-0 w-24 md:w-32 lg:w-48 h-screen pointer-events-none z-10 opacity-30 lg:opacity-100">
      {/* SVG Path for the winding road. Use slice to avoid coordinate distortion for GSAP */}
      <svg
        className="w-full h-full"
        viewBox="0 0 200 1000"
        preserveAspectRatio="xMidYMid slice"
      >
        <rect x="0" y="0" width="200" height="1000" fill="transparent" />

        {/* The Road */}
        <path
          id="road-path"
          d="M 100 10 C 160 200, 40 350, 100 500 C 160 650, 40 800, 100 950 L 100 1000"
          fill="none"
          stroke="#78716c" // stone-500
          strokeWidth="4"
          strokeDasharray="8 10"
          strokeLinecap="round"
        />

        {/* The Beach Area (Sand and Water) at the bottom */}
        {/* Sand */}
        <path d="M 0 940 Q 100 920 200 950 L 200 1000 L 0 1000 Z" fill="#fcd34d" />
        {/* Water */}
        <path d="M 0 970 Q 100 960 200 980 L 200 1000 L 0 1000 Z" fill="#7dd3fc" />
        
        {/* Mini Palm Tree */}
        <path d="M 40 950 Q 50 930 40 910" fill="none" stroke="#78350f" strokeWidth="3" />
        <path d="M 40 910 Q 20 900 10 915 M 40 910 Q 60 900 70 915 M 40 910 Q 40 890 20 885" fill="none" stroke="#059669" strokeWidth="3" />
      </svg>

      {/* The Camper Icon */}
      <div
        ref={camperRef}
        className="absolute w-12 h-12 flex items-center justify-center bg-stone-50 rounded-xl shadow-[0_10px_25px_rgba(0,0,0,0.2)] border-2 border-emerald-600 text-emerald-700"
        style={{ top: 0, left: 0, opacity: 0 }} 
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
           <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
           <circle cx="7" cy="17" r="2.5" fill="#10b981" stroke="none" />
           <path d="M9 17h6"/>
           <circle cx="17" cy="17" r="2.5" fill="#10b981" stroke="none" />
        </svg>
      </div>
    </div>
  );
}
