// @ts-check
import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import prettier from 'eslint-config-prettier';
import boundaries from 'eslint-plugin-boundaries';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const FRONTEND_APPS = 'Frontend/booking-saas/apps/*';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/src/generated/**',
      '**/next-env.d.ts',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'smart'],
      'no-console': 'error',
    },
  },

  // React (shared UI package and the three apps)
  {
    files: ['Frontend/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },

  // Next.js apps
  {
    files: [`${FRONTEND_APPS}/**/*.{ts,tsx}`],
    plugins: { '@next/next': nextPlugin },
    settings: { next: { rootDir: FRONTEND_APPS } },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
    },
  },

  // Frontend architecture: core/<feature>/{domain,data,presentation} + ui (FSD 0.2).
  // Allowed direction: ui -> presentation -> domain <- data. Only the composition root
  // (src/composition) may wire data implementations into the app. Tests are exempt:
  // a test may assemble real layers together (e.g. a view-model test fed by demo data).
  {
    files: [`${FRONTEND_APPS}/src/**/*.{ts,tsx}`],
    ignores: ['**/*.test.ts', '**/*.test.tsx'],
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        { type: 'domain', pattern: `${FRONTEND_APPS}/src/core/*/domain` },
        { type: 'data', pattern: `${FRONTEND_APPS}/src/core/*/data` },
        {
          type: 'presentation',
          pattern: `${FRONTEND_APPS}/src/core/*/presentation`,
        },
        { type: 'composition', pattern: `${FRONTEND_APPS}/src/composition` },
        { type: 'ui', pattern: `${FRONTEND_APPS}/src/ui` },
        { type: 'routes', pattern: `${FRONTEND_APPS}/src/app` },
      ],
      'import/resolver': {
        typescript: {
          project: `${FRONTEND_APPS}/tsconfig.json`,
          alwaysTryTypes: true,
          noWarnOnMultipleProjects: true,
        },
      },
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            { allow: { to: { origin: ['external', 'core'] } } },
            {
              from: { element: { type: 'domain' } },
              allow: { to: { element: { type: 'domain' } } },
            },
            {
              from: { element: { type: 'data' } },
              allow: { to: { element: { types: ['domain', 'data'] } } },
            },
            {
              from: { element: { type: 'presentation' } },
              allow: { to: { element: { types: ['domain', 'presentation'] } } },
            },
            {
              from: { element: { type: 'ui' } },
              allow: { to: { element: { types: ['presentation', 'ui'] } } },
            },
            {
              from: { element: { type: 'routes' } },
              allow: { to: { element: { types: ['ui', 'composition'] } } },
            },
            {
              from: { element: { type: 'composition' } },
              allow: { to: { element: { types: ['domain', 'data', 'presentation'] } } },
            },
          ],
        },
      ],
    },
  },

  // Domain is plain TypeScript: no framework, no HTTP, no API contract types.
  {
    files: [`${FRONTEND_APPS}/src/core/*/domain/**/*.ts`],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-dom', 'next', 'next/*'],
              message: 'Domain must not depend on React or Next.js.',
            },
            {
              group: ['@tanstack/*'],
              message: 'Domain must not depend on data-fetching libraries.',
            },
            {
              group: ['@tempora/api-client', '@tempora/contracts'],
              message: 'Domain must not know about the API; use the data layer.',
            },
          ],
        },
      ],
    },
  },

  // Presentation exposes hooks and view-models only; JSX belongs to ui.
  {
    files: [`${FRONTEND_APPS}/src/core/*/presentation/**/*.tsx`],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXElement',
          message: 'Presentation must not render JSX; move components to src/ui.',
        },
      ],
    },
  },

  prettier,
);
