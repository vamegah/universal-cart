const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const webRoot = path.join(repoRoot, 'apps', 'web');
const targets = ['.next', 'out'];

for (const target of targets) {
  const targetPath = path.resolve(webRoot, target);
  if (!targetPath.startsWith(webRoot + path.sep)) {
    throw new Error(`Refusing to remove path outside apps/web: ${targetPath}`);
  }
  fs.rmSync(targetPath, { recursive: true, force: true });
}
