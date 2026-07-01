import type { Config } from 'jest';

/**
 * Jest configuration for unit tests.
 *
 * Path aliases are mirrored from `tsconfig.json` so imports resolve identically
 * under test. `isolatedModules` skips full type-checking during test runs
 * (that is the build/CI's job) for a faster inner loop.
 */
const config: Config = {
  rootDir: '.',
  roots: ['<rootDir>/src'],
  // Polyfill decorator metadata for specs that import decorated classes
  // (class-validator/transformer) without booting the Nest runtime.
  setupFiles: ['reflect-metadata'],
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: '.*\\.spec\\.ts$',
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.spec.json' }],
  },
  moduleNameMapper: {
    '^@app/(.*)$': '<rootDir>/src/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@common/(.*)$': '<rootDir>/src/common/$1',
    '^@infra/(.*)$': '<rootDir>/src/infra/$1',
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
    '^@logger/(.*)$': '<rootDir>/src/logger/$1',
  },
  collectCoverageFrom: ['**/*.(t|j)s', '!**/*.module.ts', '!**/main.ts'],
  coverageDirectory: '<rootDir>/coverage',
};

export default config;
