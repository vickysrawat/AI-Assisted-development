'use strict';
/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',

  // Only discover the wrapper — raw *.test.cjs files use process.exit() which kills Jest
  testMatch: ['<rootDir>/tests/jest.suite.test.cjs'],

  // Coverage is collected by c8 (via NODE_V8_COVERAGE) not by Jest's built-in instrumentation.
  // c8 captures child-process coverage from spawnSync calls that the wrapper makes.
  // Run: npm run test:coverage
  collectCoverage: false,

  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: '<rootDir>/test-results',
        outputName: 'junit.xml',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › ',
      },
    ],
  ],

  // Give migration validators room to breathe
  testTimeout: 90_000,
};
