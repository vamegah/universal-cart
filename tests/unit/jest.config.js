module.exports = {
  testEnvironment: 'jsdom',
  rootDir: '../..',
  roots: ['<rootDir>/tests/unit'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/apps/web/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          target: 'ES2020',
          module: 'commonjs',
          esModuleInterop: true,
          types: ['jest', 'node'],
          baseUrl: '.',
          paths: {
            '@/*': ['apps/web/src/*'],
          },
        },
      },
    ],
  },
};
