/**
 * Style Dictionary Config — Dark Engineering Design System
 * Sync: Figma Tokens (figma-tokens.json) → CSS Variables + TS + Tailwind
 *
 * Usage:
 * npx style-dictionary build --config lib/design-system/style-dictionary.config.js
 *
 * Generates:
 * - app/dark-engineering.css (already source of truth, this would validate)
 * - lib/design-system/tokens.ts (validates var(--de-*) references)
 * - tokens for Figma
 */

module.exports = {
  source: ['lib/design-system/figma-tokens.json'],
  platforms: {
    css: {
      transformGroup: 'css',
      buildPath: 'app/',
      files: [
        {
          destination: 'dark-engineering.css',
          format: 'css/variables',
          options: {
            outputReferences: true,
            selector: ':root',
          },
          filter: (token) => token.path[0] === 'de',
        },
      ],
    },
    ts: {
      transformGroup: 'js',
      buildPath: 'lib/design-system/',
      files: [
        {
          destination: 'tokens.generated.ts',
          format: 'javascript/module',
          filter: (token) => token.path[0] === 'de',
        },
      ],
    },
    tailwind: {
      transformGroup: 'js',
      buildPath: 'lib/design-system/',
      files: [
        {
          destination: 'tailwind.generated.js',
          format: 'javascript/module',
          filter: (token) => token.attributes.category === 'color' || token.attributes.category === 'spacing',
        },
      ],
    },
  },
  // Custom transform for clamp() fluid tokens — keep as raw
  transform: {
    'fluid/clamp': {
      type: 'value',
      matcher: (token) => token.value && token.value.includes('clamp'),
      transformer: (token) => token.value,
    },
    'color/pe-striped': {
      type: 'value',
      matcher: (token) => token.path.includes('ac-pe-striped'),
      transformer: (token) => token.value,
    },
  },
};
