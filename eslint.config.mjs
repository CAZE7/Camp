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
      // Type-Imports separat: hilft isolatedModules/Verbatim-nahen Setups und
      // macht Typ- vs. Wert-Abhängigkeit im Diff sofort sichtbar.
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'inline-type-imports',
          // import('…')-Typen bleiben erlaubt: die Slice-Fassade in
          // store/slices/types.ts nutzt sie als Lazy-Referenzen.
          disallowTypeAnnotations: false,
        },
      ],
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

  // Hinweis a11y: eslint-plugin-jsx-a11y hängt an eslint<=9 (Peer-Range) und
  // würde jede Installation dauerhaft in legacy-peer-deps zwingen. Der
  // erzwingbare a11y-Riegel liegt deshalb bei axe im gebauten Export
  // (tests/e2e/a11y.spec.ts) — stärker als statische JSX-Regeln, weil er das
  // echte, gerenderte DOM im Browser bewertet. Die zuvor gefundenen Befunde
  // bleiben behoben (Gruppen-Labels, aria-invalid an group, Backdrop-Pattern).

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
