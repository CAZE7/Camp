import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Camper Elektrik Planer',
  description: '12V Camper Elektrik Kabelplaner',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" className="font-sans">
      <body>{children}</body>
    </html>
  );
}
