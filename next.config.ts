import type { NextConfig } from 'next';

// Der Base-Path für den statischen Export kann über NEXT_PUBLIC_BASE_PATH
// gesteuert werden (z. B. '/Camp' auf GitHub Pages Project Pages). Bei
// leerem Wert läuft die App unter der Domain-Wurzel.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

const nextConfig: NextConfig = {
  output: 'export',
  basePath,
  trailingSlash: true,
  allowedDevOrigins: ['*.e2b.app', 'localhost'],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
