import type { NextConfig } from 'next';

const isGithubActions = process.env.GITHUB_ACTIONS === 'true';

let defaultBasePath = '';
if (isGithubActions && process.env.GITHUB_REPOSITORY) {
  const repoName = process.env.GITHUB_REPOSITORY.split('/')[1];
  if (repoName && !repoName.endsWith('.github.io')) {
    defaultBasePath = `/${repoName}`;
  }
}

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? (isGithubActions ? defaultBasePath : '');

const nextConfig: NextConfig = {
  output: 'export',
  basePath: basePath || undefined,
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
