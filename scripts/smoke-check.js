const { spawnSync } = require('child_process');

const checks = [
  ['OpenAPI validation', 'npm run validate:openapi'],
  ['Unit tests', 'npm run test:unit'],
  ['High-threshold security audit', 'npm run security:audit'],
];

for (const [label, command] of checks) {
  console.log(`\n== ${label} ==`);
  const result = spawnSync(command, { stdio: 'inherit', shell: true });
  if (result.error || result.status !== 0) {
    console.error(`${label} failed${result.error ? `: ${result.error.message}` : ''}`);
    process.exit(result.status || 1);
  }
}

console.log('\nSmoke checks passed.');
