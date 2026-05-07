module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
      tsconfig: {
        target: 'ES2020',
        module: 'commonjs',
        esModuleInterop: true,
        types: ['jest', 'node'],
      },
      },
    ],
  },
};
