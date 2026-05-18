import './globals.css';
import type { Metadata } from 'next';
import { Inter, Geist } from 'next/font/google';
import { cn } from "@/lib/utils";
import MainLayout from "@/components/layout/MainLayout";

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
        <MainLayout>
          {children}
        </MainLayout>
      </body>
    </html>
  );
}
