const path = require('path');
const baseConfig = require('../.eslintrc.base.cjs');

const baseExtendsWithoutPrettier = baseConfig.extends.filter((extendName) => extendName !== 'prettier');
const basePlugins = Array.isArray(baseConfig.plugins) ? baseConfig.plugins : [];

module.exports = {
  ...baseConfig,
  root: true,
  plugins: Array.from(new Set([...basePlugins, 'react', 'react-hooks', 'jsx-a11y'])),
  extends: [
    ...baseExtendsWithoutPrettier,
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
    'next/core-web-vitals',
    'prettier',
  ],
  settings: {
    ...baseConfig.settings,
    next: {
      rootDir: ['frontend'],
    },
    'import/resolver': {
      ...(baseConfig.settings?.['import/resolver'] ?? {}),
      typescript: {
        project: path.resolve(__dirname, 'tsconfig.json'),
      },
    },
  },
  parserOptions: {
    ...baseConfig.parserOptions,
    tsconfigRootDir: __dirname,
  },
};
