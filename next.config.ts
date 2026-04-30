import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/Camp',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
