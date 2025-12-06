import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';
import prettier from 'eslint-plugin-prettier';
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y';

export default [
  // JavaScriptの基本設定
  js.configs.recommended,

  // 全体設定
  {
    ignores: [
      'node_modules/**',
      'out/**',
      'build/**',
      'dist/**',
      'coverage/**',
      '*.config.js',
      '*.config.mjs',
      '*.config.cjs',
      'setupTests.js',
      'scripts/**/*.js',
      'scripts/**/*.mjs',
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.spec.ts',
      '**/*.spec.tsx',
      'src/test/**',
      'src/pages/_app.js',
      'src/pages/_document.js',
    ],
  },

  // TypeScript設定
  {
    files: ['**/*.{js,ts}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
        project: './tsconfig.json',
      },
      globals: {
        // ブラウザとNode.jsのグローバル変数
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        exports: 'readonly',
        global: 'readonly',
        module: 'readonly',
        require: 'readonly',
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        FormData: 'readonly',
        Headers: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        JSX: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      'import': importPlugin,
      'prettier': prettier,
      'jsx-a11y': jsxA11yPlugin,
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: './tsconfig.json',
        },
      },
    },
    rules: {
      // TypeScript関連
      ...typescript.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'off',

      // アクセシビリティ（無効化）
      // ...jsxA11yPlugin.configs.recommended.rules,

      // Prettier
      'prettier/prettier': 'error',

      // Import関連
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../', './'],
              message: '相対パスは禁止です。絶対パス(@/)を使用してください。',
            },
          ],
        },
      ],
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            ['parent', 'sibling'],
            'index',
            'object',
            'type',
          ],
          pathGroups: [
            {
              pattern: '@/**',
              group: 'internal',
              position: 'after',
            },
          ],
          pathGroupsExcludedImportTypes: ['builtin'],
          'newlines-between': 'always',
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],
      'import/no-unresolved': 'error',
      'import/no-duplicates': 'error',

      // JavaScriptの基本ルールの調整
      'no-unused-vars': 'off', // TypeScriptのルールを使用
      'no-undef': 'off', // TypeScriptが処理
    },
  },

  // テストファイル用の設定
  {
    files: ['**/*.test.{js,ts}', '**/*.spec.{js,ts}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
