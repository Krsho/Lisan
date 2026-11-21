/** @type {import('jest').Config} */
module.exports = {
  modulePathIgnorePatterns: ['<rootDir>/.claude/'],
  projects: [
    {
      displayName: 'app',
      modulePathIgnorePatterns: ['<rootDir>/.claude/'],
      preset: 'jest-expo',
      testMatch: ['<rootDir>/src/**/*.test.ts?(x)'],
    },
    {
      displayName: 'tools',
      modulePathIgnorePatterns: ['<rootDir>/.claude/'],
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tools/**/*.test.ts'],
      transform: {
        '\.ts$': ['babel-jest', { presets: ['babel-preset-expo'] }],
      },
    },
  ],
};
