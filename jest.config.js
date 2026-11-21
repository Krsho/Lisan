/** @type {import('jest').Config} */
// testRegex rather than testMatch: testMatch globs skip paths through dot-folders,
// such as agent worktrees under .claude/worktrees/.
module.exports = {
  modulePathIgnorePatterns: ['<rootDir>/.claude/'],
  projects: [
    {
      displayName: 'app',
      modulePathIgnorePatterns: ['<rootDir>/.claude/'],
      preset: 'jest-expo',
      testRegex: '/src/.*\\.test\\.tsx?$',
    },
    {
      displayName: 'tools',
      modulePathIgnorePatterns: ['<rootDir>/.claude/'],
      testEnvironment: 'node',
      testRegex: '/tools/.*\\.test\\.ts$',
      transform: {
        '\\.ts$': ['babel-jest', { presets: ['babel-preset-expo'] }],
      },
    },
  ],
};
