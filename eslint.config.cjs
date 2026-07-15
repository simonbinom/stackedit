const js = require('@eslint/js');
const globals = require('globals');
const babelParser = require('@babel/eslint-parser');
const vueParser = require('vue-eslint-parser');
const importPlugin = require('eslint-plugin-import');

const srcGlobals = {
  ...globals.browser,
  module: 'readonly',
  NODE_ENV: 'readonly',
  VERSION: 'readonly',
  GOOGLE_CLIENT_ID: 'readonly',
  GITHUB_CLIENT_ID: 'readonly',
};

const babelParserOptions = {
  requireConfigFile: false,
  babelOptions: {
    babelrc: true,
  },
};

const importSettings = {
  'import/resolver': {
    webpack: {
      config: 'build/webpack.base.conf.js',
    },
  },
};

const sharedRules = {
  ...js.configs.recommended.rules,
  'no-param-reassign': ['error', { props: false }],
  'no-unused-vars': ['error', { caughtErrors: 'none' }],
  'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',
  'import/extensions': ['error', 'always', {
    js: 'never',
    vue: 'never',
  }],
  'import/no-extraneous-dependencies': ['error', {
    optionalDependencies: ['test/unit/index.js'],
  }],
};

module.exports = [
  {
    linterOptions: {
      reportUnusedDisableDirectives: false,
    },
  },
  {
    ignores: [
      'build/*.js',
      'config/*.js',
      'dist/**',
      'node_modules/**',
      'src/libs/*.js',
    ],
  },
  {
    files: ['src/**/*.js'],
    languageOptions: {
      parser: babelParser,
      parserOptions: babelParserOptions,
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: srcGlobals,
    },
    plugins: {
      import: importPlugin,
    },
    settings: importSettings,
    rules: sharedRules,
  },
  {
    files: ['src/**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: babelParser,
        ...babelParserOptions,
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      globals: srcGlobals,
    },
    plugins: {
      import: importPlugin,
    },
    settings: importSettings,
    rules: sharedRules,
  },
  {
    files: ['server/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: globals.node,
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-param-reassign': ['error', { props: false }],
      'no-unused-vars': ['error', { caughtErrors: 'none' }],
    },
  },
];
