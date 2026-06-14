const common = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: true }],
  },
}

export default {
  ...common,
  collectCoverageFrom: ['src/**/*.ts', '!src/**/index.ts'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  projects: [
    { ...common, displayName: 'unit', testMatch: ['<rootDir>/tests/test.ts'] },
    { ...common, displayName: 'integration', testMatch: ['<rootDir>/tests/integration.test.ts'] },
  ],
}
