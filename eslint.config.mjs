import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import prettierConfig from 'eslint-config-prettier';

/**
 * ESLint Flat Config — Industriestandard-Gate (AGENTS.md M6-1, AUDIT T1).
 *
 * `tsc` bleibt die autoritative Typprüfung für Signaturen. ESLint prüft
 * zusätzlich die Klassen, die ein Compiler per Design nicht sieht:
 * weggeworfene Promises, `any`-Verschleierung über Typ-Assertionen,
 * Vergleiche zwischen unvergleichbaren Typen, Schichtenverstöße im Import.
 * Dafür läuft das Gate **typbewusst** (`recommendedTypeChecked` + ProjectService).
 *
 * Vorher stand hier: „Bewusst keine type-checked Rule-Sets … für die
 * Team-Latenz zu teuer". Gemessen (AUDIT T1, gleiche Maschine, gleicher Baum):
 * 8 s ohne Typinformation, ~30 s mit — im CI unkritisch (das Gate läuft dort
 * ohnehin Minuten), lokal über den Watch-Modus tragbar. Der Preis eines
 * nicht-typbewussten Gates ist höher als seine Laufzeit: `no-floating-promises`
 * und `no-unnecessary-type-assertion` finden Fehlerklassen, die weder `tsc`
 * noch Tests zuverlässig sehen (verworfene Promises sind im Static Export
 * unsichtbar abgebrochene Speicher-/Clipboard-Vorgänge).
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

  // AUDIT T1: react-hooks v7 „recommended-latest“ — das Regelset, das die
  // React-Compiler-Analyse nutzt (rules-of-hooks, exhaustive-deps plus
  // immutability, set-state-in-effect, refs, purity u. a.).
  //
  // Zwei Hinweise für die nächste Person, die hier anfasst:
  //   1) Es MUSS `reactHooks.configs.flat['recommended-latest']` sein.
  //      `reactHooks.configs['recommended-latest']` ist das alte eslintrc-
  //      Format (`plugins: ['react-hooks']`) und lässt ESLint 10 beim Laden
  //      der Flat Config hart abbrechen ("Key plugins: Could not find plugin"),
  //      nicht nur warnen.
  //   2) Das Set kam nicht kostenlos: 12 Befunde, alle real behoben —
  //      2× immutability (BOMModal: useState-Deklarationen standen unter dem
  //      Effekt, der sie schreibt) und 10× set-state-in-effect („lokaler State
  //      folgt Prop/abgeleitetem Wert“). Letztere sind auf das offizielle
  //      Muster umgestellt: Vergleichszustand + bedingtes setState während des
  //      Renders (ein Commit statt zwei), bzw. useSyncExternalStore, wo die
  //      Quelle ohnehin extern ist (usePlannerTheme -> MediaQueryList).
  //      Einzelstellen und Semantiknachweise: docs/ARCHITECTURE-CHANGES.md,
  //      Abschnitt „Siebte Fassung — AUDIT T1“.
  reactHooks.configs.flat['recommended-latest'],

  ...tseslint.configs.recommendedTypeChecked,

  // Typinformation für alle TS/TSX-Dateien über den ProjectService (ein
  // geteiltes Programm statt eines Pro-Datei-Parses). `allowDefaultProject`
  // nimmt die Wurzel-Configs auf, die in keinem tsconfig-`include` stehen.
  {
    // `.mjs` steht mit drin, weil die Wurzel-Config selbst gelintet wird und
    // typbewusste Regeln sonst ohne Typinformation auf sie treffen
    // (allowDefaultProject nimmt sie in das Default-Projekt auf).
    files: ['**/*.{ts,tsx,mts,cts,mjs}'],
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['eslint.config.mjs'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

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

      // AUDIT T1 — bewusst AUS, mit belegtem Fehlalarm:
      // `screen.getByLabelText(/x/i) as HTMLInputElement` meldet die Regel als
      // „ändert den Typ nicht", `tsc` bricht ohne den Cast aber mit
      // TS2339 („Property 'value' does not exist on type 'HTMLElement'") ab —
      // nachgewiesen an app/tools/heizung/page.test.tsx und mit einem
      // Minimal-Repro (ein Import aus @testing-library/react, ein Cast, ein
      // `.value`-Zugriff). Ursache ist die generische Signatur
      // `getByLabelText<T extends HTMLElement = HTMLElement>`: typescript-eslint
      // sieht hier denselben Typ vor und nach der Assertion, tsc nicht.
      // Ein `--fix` dieser Regel entfernt also **notwendige** Casts und macht
      // den Baum kaputt (24 Stellen, beide Typecheck-Profile). Solange die
      // Regel das nicht auflöst, bleibt sie aus — ein Gate, das nötige Casts
      // löscht, ist schlechter als keines. Die übrigen typbewussten Regeln
      // laufen; `no-explicit-any` (hart, AGENTS.md M6-1) deckt dieselbe
      // Fehlerklasse an der Wurzel ab.
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',

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
    // ARCH-001 (ADR 0008): Domänencode in lib/** importiert nichts aus den
    // App-Schichten — die Abhängigkeitsrichtung läuft ausschließlich nach
    // unten. Bisher nur als Test (scripts/architecture/libBoundary.test.ts),
    // der einen Verstoß erst nach dem Commit sieht; als Lint-Regel schlägt er
    // beim Schreiben fehl. Testdateien sind ausgenommen, weil Harness-
    // Nutznießer (A/B-Gate, Regression) bewusst beide Seiten ziehen dürfen —
    // dieselbe Ausnahme, dieselbe Begründung wie im Test.
    files: ['lib/**/*.{ts,tsx}'],
    ignores: ['lib/**/*.test.ts', 'lib/**/*.test.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/components/*',
                '@/store/*',
                '@/app/*',
                '@/benchmarks/*',
                'components/*',
                'store/*',
                'app/*',
                'benchmarks/*',
                '../components/*',
                '../store/*',
                '../app/*',
                '../benchmarks/*',
                '../../components/*',
                '../../store/*',
                '../../app/*',
              ],
              message:
                'ARCH-001: Domänencode in lib/** darf nicht aus App-Schichten importieren (components/, store/, app/, benchmarks/). Gemeinsame Tabellen gehören nach lib/domain/ — Präzedenz: lib/domain/connectionPolicy.ts.',
            },
          ],
        },
      ],
    },
  },

  {
    // AGENTS.md §3.6: „Determinismus erhalten: kein Math.random, keine
    // ungeordnete Iteration." Ein Router, der würfelt, ist nicht reproduzierbar
    // — und genau das macht die byte-exakten SVG-Golden-Master wertlos.
    // Der Riegel gilt für den Router, nicht fürs Repo: lib/id.ts nutzt
    // Math.random bewusst als letzte Rückfalllinie für Ids (dokumentiert).
    files: ['lib/routing/**/*.{ts,tsx}'],
    ignores: ['lib/routing/**/*.test.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
          message:
            'Routing muss deterministisch sein (AGENTS.md §3.6, Invariante I-Determinismus): kein Math.random. Zufall macht die byte-exakten Golden-Master-Vergleiche wertlos.',
        },
      ],
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
