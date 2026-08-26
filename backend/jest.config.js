/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  // The main tsconfig pins rootDir to ./src (for the production build), so
  // tests get their own compiler settings without a rootDir constraint.
  transform: {
    '^.+\\.[tj]sx?$': [
      'ts-jest',
      {
        // Referenced by path (not inline) so it fully replaces the build
        // tsconfig instead of being merged over it.
        tsconfig: '<rootDir>/tsconfig.test.json',
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  // uuid v14 ships ESM only — let the transformer compile it to CJS.
  // Workspace-aware: matches both root and package node_modules/.pnpm/uuid
  transformIgnorePatterns: ['node_modules/(?!(\\.pnpm/)?uuid)'],
  // Set required secrets BEFORE any module (config) is imported.
  setupFiles: ['<rootDir>/tests/setup.env.ts'],
};
