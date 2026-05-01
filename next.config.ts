import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/Camp',
  assetPrefix: '/Camp',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
