import './globals.css';
import type { Metadata } from 'next';
import { Inter, Geist } from 'next/font/google';
import { cn } from "@/lib/utils";
import NavigationSidebar from "@/components/NavigationSidebar";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'CampCraft — DIY Camper-Ausbau Plattform',
  description: 'Plane deinen Camper-Ausbau wie ein Profi. Elektrik, Dach, Heizung und mehr — alles an einem Ort.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" className={cn("font-sans", geist.variable)}>
      <body className={cn(inter.className, "bg-stone-50")}>
        <div 
          className="fixed inset-0 pointer-events-none z-50 mix-blend-soft-light transition-colors duration-500" 
          style={{ 
            background: `radial-gradient(circle at 50% 50%, var(--ambient-glow) 0%, var(--ambient-bg) 100%)`,
            opacity: 0.7
          }} 
        />
        <NavigationSidebar />
        <main className="lg:pl-[17rem] min-h-screen transition-all duration-500 relative z-10">
          {children}
        </main>
      </body>
    </html>
  );
}
