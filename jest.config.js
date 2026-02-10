module.exports = {
  projects: [
    {
      displayName: 'backend',
      moduleFileExtensions: ['js', 'json', 'ts'],
      rootDir: '.',
      testMatch: ['<rootDir>/test/**/*.spec.ts', '<rootDir>/src/**/*.spec.ts'],
      modulePathIgnorePatterns: ['<rootDir>/dist/'],
      transform: {
        '^.+\\.(t|j)s$': 'ts-jest',
      },
      collectCoverageFrom: ['src/**/*.(t|j)s'],
      coverageDirectory: './coverage',
      coverageThreshold: {
        global: {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80,
        },
      },
      testEnvironment: 'node',
    },
    {
      displayName: 'frontend',
      moduleFileExtensions: ['js', 'json', 'ts', 'tsx', 'jsx'],
      rootDir: '.',
      testRegex: 'frontend/.*\\.spec\\.tsx?$',
      testPathIgnorePatterns: ['<rootDir>/frontend/test/e2e/'],
      modulePathIgnorePatterns: ['<rootDir>/dist/'],
      transform: {
        '^.+\\.(t|j)sx?$': [
          'ts-jest',
          {
            tsconfig: '<rootDir>/frontend/tsconfig.json',
          },
        ],
      },
      collectCoverageFrom: ['frontend/src/**/*.{ts,tsx,js,jsx}'],
      coverageDirectory: './coverage/frontend',
      coverageThreshold: {
        global: {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80,
        },
      },
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: ['<rootDir>/frontend/test/setup-tests.ts'],
    },
  ],
};
