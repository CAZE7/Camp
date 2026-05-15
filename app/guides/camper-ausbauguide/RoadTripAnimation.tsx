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

    // Dynamic will-change for performance (Lighthouse optimization)
    let scrollTimeout: NodeJS.Timeout;
    const handleScroll = () => {
      if (containerRef.current) containerRef.current.style.willChange = "transform";
      if (camperRef.current) camperRef.current.style.willChange = "transform";
      
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        if (containerRef.current) containerRef.current.style.willChange = "auto";
        if (camperRef.current) camperRef.current.style.willChange = "auto";
      }, 100);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    // SVG Path length for building effect
    const pathLength = path.getTotalLength();
    gsap.set(path, { strokeDasharray: pathLength, strokeDashoffset: pathLength });

    // Snapping points based on H2/H3 elements
    const chapters = Array.from(pageWrapper.querySelectorAll("h2, h3"));
    const snapPoints = chapters.map((_, i) => i / (chapters.length - 1 || 1));

    // Animate the camper along the SVG path
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: pageWrapper,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.5,
        snap: {
          snapTo: snapPoints,
          duration: { min: 0.2, max: 0.5 },
          delay: 0.1,
          ease: "power2.inOut"
        },
        onUpdate: (self) => {
          const progress = self.progress;
          
          // Road building effect
          gsap.set(path, { strokeDashoffset: pathLength * (1 - progress) });

          // Evening Mode (Headlights)
          const headlights = document.querySelectorAll(".camper-headlight");
          gsap.to(headlights, { opacity: progress > 0.7 ? 1 : 0, duration: 0.3, force3D: true });

          // Landmarks fade in
          const landmarks = document.querySelectorAll(".landmark");
          landmarks.forEach((landmark) => {
            const pos = parseFloat(landmark.getAttribute("data-pos") || "0");
            gsap.to(landmark, { opacity: progress > pos ? 1 : 0, duration: 0.5, force3D: true });
          });
        }
      }
    });

    // Camper scale animation when passing chapters
    chapters.forEach((chapter, i) => {
      ScrollTrigger.create({
        trigger: chapter,
        start: "top center",
        onEnter: () => {
          gsap.to(camperRef.current, { scale: 1.2, duration: 0.2, yoyo: true, repeat: 1, force3D: true });
        },
        onEnterBack: () => {
          gsap.to(camperRef.current, { scale: 1.2, duration: 0.2, yoyo: true, repeat: 1, force3D: true });
        }
      });
    });

    tl.to(camperRef.current, {
      motionPath: {
        path: path,
        align: path,
        alignOrigin: [0.5, 0.5],
        autoRotate: 90,
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
    
    // Reveal the camper
    if (camperRef.current) {
      gsap.to(camperRef.current, { opacity: 1, duration: 0.5, force3D: true });
    }

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, { scope: containerRef });

  return (
    <div 
      ref={containerRef} 
      className="fixed left-0 top-0 w-24 md:w-32 lg:w-48 h-screen pointer-events-none z-10 opacity-30 lg:opacity-100"
      style={{ isolation: "isolate" }} // Layer Isolation
    >
      <svg
        className="w-full h-full"
        viewBox="0 0 200 1000"
        preserveAspectRatio="xMidYMid slice"
      >
        <rect x="0" y="0" width="200" height="1000" fill="transparent" />

        {/* The Road - Base (Subtle background) */}
        <path
          d="M 100 10 C 160 200, 40 350, 100 500 C 160 650, 40 800, 100 950 L 100 1000"
          fill="none"
          stroke="#78716c"
          strokeWidth="1"
          opacity="0.1"
          strokeDasharray="4 4"
        />

        {/* The Road - Animated building path */}
        <path
          id="road-path"
          d="M 100 10 C 160 200, 40 350, 100 500 C 160 650, 40 800, 100 950 L 100 1000"
          fill="none"
          stroke="#78716c"
          strokeWidth="4"
          strokeDasharray="8 10"
          strokeLinecap="round"
        />

        {/* Landmarks */}
        <g className="landmark" data-pos="0.3" style={{ opacity: 0 }}>
          {/* Fir Tree Symbol */}
          <path d="M 140 300 L 150 280 L 160 300 Z" fill="#065f46" />
          <path d="M 142 315 L 150 295 L 158 315 Z" fill="#065f46" />
          <rect x="148" y="315" width="4" height="6" fill="#78350f" />
        </g>
        
        <g className="landmark" data-pos="0.6" style={{ opacity: 0 }}>
          {/* Mountain Symbol */}
          <path d="M 30 600 L 50 560 L 70 600 Z" fill="#44403c" />
          <path d="M 45 570 L 50 560 L 55 570 Z" fill="white" />
        </g>

        {/* The Beach Area */}
        <path d="M 0 940 Q 100 920 200 950 L 200 1000 L 0 1000 Z" fill="#fcd34d" />
        <path d="M 0 970 Q 100 960 200 980 L 200 1000 L 0 1000 Z" fill="#7dd3fc" />
      </svg>

      {/* The Camper Icon */}
      <div
        ref={camperRef}
        className="absolute w-12 h-12 flex items-center justify-center bg-stone-50 rounded-xl shadow-[0_10px_25px_rgba(0,0,0,0.2)] border-2 border-emerald-600 text-emerald-700"
        style={{ top: 0, left: 0, opacity: 0 }} 
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 relative">
           <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
           <circle cx="7" cy="17" r="2.5" fill="#10b981" stroke="none" />
           <path d="M9 17h6"/>
           <circle cx="17" cy="17" r="2.5" fill="#10b981" stroke="none" />
           
           {/* Headlights (Evening Mode) */}
           <circle className="camper-headlight" cx="21" cy="13" r="2.0" fill="#fbbf24" style={{ opacity: 0 }} />
           <circle className="camper-headlight" cx="21" cy="15" r="1.5" fill="#fbbf24" style={{ opacity: 0 }} />
        </svg>
      </div>
    </div>

  );
}
