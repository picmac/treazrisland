import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import eslintConfigPrettier from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import globals from 'globals';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const makeTypeScriptLanguageOptions = (tsconfigPath) => ({
  parser: tsParser,
  parserOptions: {
    project: false,
    tsconfigRootDir: projectRoot,
    sourceType: 'module',
  },
});

export default [
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/coverage/**'],
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
  },
  {
    files: ['scripts/**/*.{ts,js}'],
    languageOptions: {
      ...makeTypeScriptLanguageOptions('./tsconfig.json'),
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tsPlugin.configs.recommended.rules,
      ...eslintConfigPrettier.rules,
    },
  },
  {
    files: ['backend/**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      ...makeTypeScriptLanguageOptions('./backend/tsconfig.json'),
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      import: importPlugin,
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: path.resolve(projectRoot, './backend/tsconfig.json'),
        },
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tsPlugin.configs.recommended.rules,
      ...importPlugin.configs.recommended.rules,
      ...eslintConfigPrettier.rules,
    },
  },
  {
    files: ['frontend/**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      ...makeTypeScriptLanguageOptions('./frontend/tsconfig.json'),
      globals: {
        ...globals.browser,
        ...globals.node,
        RequestInit: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      import: importPlugin,
      'jsx-a11y': jsxA11yPlugin,
      '@next/next': nextPlugin,
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    settings: {
      react: { version: 'detect' },
      'import/resolver': {
        typescript: {
          project: path.resolve(projectRoot, './frontend/tsconfig.json'),
        },
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tsPlugin.configs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      ...jsxA11yPlugin.configs.recommended.rules,
      ...importPlugin.configs.recommended.rules,
      ...eslintConfigPrettier.rules,
      'react/react-in-jsx-scope': 'off',
      '@next/next/no-html-link-for-pages': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/incompatible-library': 'off',
    },
  },
];
