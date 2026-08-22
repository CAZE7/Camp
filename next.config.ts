import type { NextConfig } from 'next';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  output: 'export',
  basePath,
  assetPrefix: basePath ? `${basePath}/` : undefined,
  trailingSlash: true,
  // Nur im Development relevant (für Sandbox-Previews). Im Produktions-Build
  // hat diese Option keine Wirkung und Wildcards gehören nicht committet.
  ...(process.env.NODE_ENV !== 'production'
    ? { allowedDevOrigins: ['*.e2b.app', 'localhost'] }
    : {}),
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
