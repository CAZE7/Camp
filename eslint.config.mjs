import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import prettierConfig from 'eslint-config-prettier';

/**
 * ESLint Flat Config — Industriestandard-Gate (AGENTS.md M6-1).
 *
 * Bewusst keine `type-checked` Rule-Sets: sie brauchen ProjectService pro
 * Datei und sind für die Team-Latenz zu teuer; `tsc` (typecheck/typecheck:tests)
 * bleibt die autoritative Typprüfung. ESLint ergänzt hier Syntax- und
 * React-Hooks-Klassen, die tsc nicht abdeckt.
 */
export default tseslint.config(
  {
    ignores: [
      '.next/**',
      'out/**',
      'coverage/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      'next-env.d.ts',
      'benchmarks/**',
      'scripts/**',
      'docs/**',
      'lighthouse-report/**',
      'public/**',
      'postcss.config.js',
      'next.config.ts',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      // Harte Regeln aus AGENTS.md M6-1:
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',

      // Übliche Härten daneben:
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none',
          // `{ position, ...rest }` ist der übliche Weg, React-Flow-Props aus
          // Mock-Komponenten zu filtern — das ignorierte Feld ist gewollt.
          ignoreRestSiblings: true,
        },
      ],
      eqeqeq: ['error', 'smart'],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-debugger': 'error',
      // Kein no-alert: Destruktive Aktionen bestätigen bewusst mit
      // window.confirm (AUDIT.md "Leere/Lade/destruktive Zustände" ✅).
    },
  },

  {
    // Skripte/Config-Dateien laufen unter Node, ohne React.
    files: ['*.config.{ts,mts,mjs,js}', 'playwright.config.ts'],
    rules: {
      'no-console': 'off',
    },
  },

  // Formatierungsregeln überlässt ESLint komplett Prettier.
  prettierConfig
);
