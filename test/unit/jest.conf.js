const path = require('path');

module.exports = {
  rootDir: path.resolve(__dirname, '../../'),
  testEnvironment: 'jsdom',
  moduleFileExtensions: [
    'js',
    'json',
    'vue',
  ],
  moduleNameMapper: {
    '^vue$': '@vue/compat',
    '\\.(css|scss)$': 'identity-obj-proxy',
    '\\?raw$': '<rootDir>/test/unit/mocks/rawFileMock',
  },
  transform: {
    '^.+\\.js$': '<rootDir>/node_modules/babel-jest',
    '.*\\.(vue)$': '<rootDir>/node_modules/@vue/vue3-jest',
    '.*\\.(yml|html|md)$': '<rootDir>/test/unit/rawTransformer',
  },
  setupFiles: [
    '<rootDir>/test/unit/setup',
  ],
  coverageDirectory: '<rootDir>/test/unit/coverage',
  collectCoverageFrom: [
    'src/**/*.{js,vue}',
    '!src/main.js',
    '!**/node_modules/**',
  ],
  globals: {
    NODE_ENV: 'production',
  },
};
