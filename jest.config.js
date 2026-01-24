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
      testEnvironment: 'node',
    },
    {
      displayName: 'frontend',
      moduleFileExtensions: ['js', 'json', 'ts', 'tsx', 'jsx'],
      rootDir: '.',
      testRegex: 'frontend/.*\\.spec\\.tsx?$',
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
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: ['<rootDir>/frontend/test/setup-tests.ts'],
    },
  ],
};
