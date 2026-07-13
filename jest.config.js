/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/widgets/Jakartowns/src'],
  setupFiles: ['<rootDir>/jest.setup.ts'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'widgets/Jakartowns/src/runtime/lib/**/*.ts',
    'widgets/Jakartowns/src/runtime/services/**/*.ts'
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }]
  }
}
