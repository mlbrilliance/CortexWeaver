module.exports = {
  projects: [
    {
      displayName: 'unit',
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/tests'],
      testMatch: ['<rootDir>/tests/**/*.test.ts'],
      testPathIgnorePatterns: [
        '/node_modules/',
        '/dist/',
        '/coverage/',
        '/tests/integration/'
      ],
      transform: {
        '^.+\\.ts$': 'ts-jest',
      },
      collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.d.ts',
      ],
      coverageDirectory: 'coverage/unit',
      coverageReporters: ['text', 'lcov', 'html'],
      testTimeout: 30000,
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup.ts']
    },
    {
      displayName: 'integration',
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/tests/integration'],
      testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
      transform: {
        '^.+\\.ts$': 'ts-jest',
      },
      collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.d.ts',
      ],
      coverageDirectory: 'coverage/integration',
      coverageReporters: ['text', 'lcov', 'html'],
      testTimeout: 300000, // 5 minutes for integration tests
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
      // Test sequencer for error handling - only for integration tests
      // NOTE: testSequencer may not be supported in Jest 30 - disabled for now
      // testSequencer: '<rootDir>/jest-sequencer.js'
    }
  ],
  // Global configuration
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 60000,
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node']
};