import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  basePath: process.env.NODE_ENV === 'production' ? '/Camp' : '',
  trailingSlash: true,
  allowedDevOrigins: ['*.e2b.app', 'localhost'],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
