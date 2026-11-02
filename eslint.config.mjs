import comments from '@eslint-community/eslint-plugin-eslint-comments';
import js from '@eslint/js';
import vitest from '@vitest/eslint-plugin';
import sonarjs from 'eslint-plugin-sonarjs';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const REACTIVE_FORBIDDEN_GLOBALS = [
  { name: 'fetch', message: 'M-RX-01: call the API gateway in shared/api or features/*/api.' },
  { name: 'XMLHttpRequest', message: 'M-RX-01: call the API gateway.' },
  { name: 'localStorage', message: 'M-RX-02: use a persistence adapter in shared/.' },
  { name: 'sessionStorage', message: 'M-RX-02: use a persistence adapter in shared/.' },
  { name: 'setTimeout', message: '04-ARCH 5.5.2: model timers as a stream in streams/.' },
];

export default tseslint.config(
  {
    ignores: [
      'AIAGENT_POC/**',
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/reports/**',
      '**/.stryker-tmp/**',
      '**/*.generated.ts',
      'cms-api/src/generated/**',
    ],
  },

  {
    files: ['**/*.{mjs,cjs}'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },

  {
    files: ['**/*.{ts,tsx}'],
    extends: [...tseslint.configs.strictTypeChecked],
    plugins: { sonarjs, '@eslint-community/eslint-comments': comments },
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // 05-METRICS 6.1 complexity limits
      complexity: ['error', 10],
      'sonarjs/cognitive-complexity': ['error', 15],
      'max-depth': ['error', 4],
      'max-lines-per-function': ['error', { max: 50, skipBlankLines: true, skipComments: true }],
      'max-params': ['error', 4],
      'max-lines': ['error', { max: 400, skipBlankLines: true, skipComments: true }],
      // 05-METRICS 6.3 technical debt
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-expect-error': 'allow-with-description', 'ts-ignore': 'allow-with-description' },
      ],
      '@typescript-eslint/no-deprecated': 'error',
      '@eslint-community/eslint-comments/require-description': 'error',
      '@eslint-community/eslint-comments/no-unused-disable': 'error',
      // NestJS modules are empty classes that exist to carry a decorator.
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        // Decorated parameters keep their imports for emitDecoratorMetadata (TS1272).
        { disallowTypeAnnotations: false },
      ],
      // Immutable entities copy themselves by spreading their fields back into a constructor.
      '@typescript-eslint/no-misused-spread': 'off',
    },
  },

  {
    files: ['**/*.spec.{ts,tsx}', '**/test/**/*.{ts,tsx}'],
    plugins: { vitest },
    rules: {
      // M-TEST-05: skipped and focused tests never merge
      // Decorator metadata is keyed by the unbound method, so specs pass it around as is.
      '@typescript-eslint/unbound-method': 'off',
      'vitest/no-disabled-tests': 'error',
      'vitest/no-focused-tests': 'error',
      'vitest/expect-expect': ['error', { assertFunctionNames: ['expect', '**.expect'] }],
      'max-lines-per-function': 'off',
      'max-lines': 'off',
    },
  },

  {
    files: ['cms-web/src/**/*.tsx'],
    ignores: ['**/*.spec.tsx'],
    rules: {
      'no-restricted-globals': ['error', ...REACTIVE_FORBIDDEN_GLOBALS],
      'no-restricted-imports': [
        'error',
        { paths: [{ name: 'axios', message: 'M-RX-01: call the API gateway.' }] },
      ],
      'max-lines': ['error', { max: 200, skipBlankLines: true, skipComments: true }],
    },
  },

  {
    // Presentational components take props only. A component that needs state is named *Container.
    files: ['cms-web/src/features/*/components/**/*.tsx', 'cms-web/src/design-system/**/*.tsx'],
    ignores: ['**/*Container.tsx', '**/*.spec.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'axios', message: 'M-RX-01: call the API gateway.' },
            { name: '@tanstack/react-query', message: 'M-RX-04: presentational means props only.' },
            { name: 'zustand', message: 'M-RX-05: presentational means props only.' },
          ],
          patterns: [{ group: ['**/shared/stores/**'], message: 'M-RX-05: props only.' }],
        },
      ],
    },
  },
);
