const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const sourceDir = path.join(repoRoot, 'apps', 'extension');
const outputDir = path.join(repoRoot, 'dist', 'extension');

const apiBaseUrl = (process.env.UNIVERSAL_CART_EXTENSION_API_URL || 'http://localhost:3001/api').replace(/\/$/, '');
const webBaseUrl = (process.env.UNIVERSAL_CART_EXTENSION_WEB_URL || 'http://localhost:3000').replace(/\/$/, '');

function copyDirectory(source, destination) {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(sourcePath, destinationPath);
    } else {
      fs.copyFileSync(sourcePath, destinationPath);
    }
  }
}

function validateEndpoint(name, value) {
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error(`${name} must use http or https`);
    }
    if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
      throw new Error(`${name} must use https when NODE_ENV=production`);
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${name} is invalid: ${detail}`);
  }
}

validateEndpoint('UNIVERSAL_CART_EXTENSION_API_URL', apiBaseUrl);
validateEndpoint('UNIVERSAL_CART_EXTENSION_WEB_URL', webBaseUrl);

fs.rmSync(outputDir, { recursive: true, force: true });
copyDirectory(sourceDir, outputDir);

const config = `globalThis.UniversalCartExtensionConfig = {
  apiBaseUrl: ${JSON.stringify(apiBaseUrl)},
  webBaseUrl: ${JSON.stringify(webBaseUrl)},
};
`;
fs.writeFileSync(path.join(outputDir, 'extension-config.js'), config, 'utf8');

console.log(`Packaged extension at ${path.relative(repoRoot, outputDir)}`);
console.log(`API URL: ${apiBaseUrl}`);
console.log(`Web URL: ${webBaseUrl}`);
