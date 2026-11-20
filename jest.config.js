/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      displayName: 'app',
      preset: 'jest-expo',
      testMatch: ['<rootDir>/src/**/*.test.ts?(x)'],
    },
    {
      displayName: 'tools',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tools/**/*.test.ts'],
      transform: {
        '\.ts$': ['babel-jest', { presets: ['babel-preset-expo'] }],
      },
    },
  ],
};
