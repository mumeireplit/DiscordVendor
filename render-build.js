// Build script for Render deployment
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Log function
function log(message) {
  console.log(`[BUILD] ${message}`);
}

// Run a command and log its output
function runCommand(command) {
  log(`Running: ${command}`);
  try {
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch (error) {
    log(`Error executing command: ${command}`);
    log(error.message);
    return false;
  }
}

// Main build function
async function build() {
  log('Starting build process for Render deployment');
  
  // Ensure npm modules are installed
  log('Installing dependencies...');
  if (!runCommand('npm install')) {
    process.exit(1);
  }
  
  // Create dist directory if it doesn't exist
  if (!fs.existsSync('dist')) {
    log('Creating dist directory');
    fs.mkdirSync('dist');
  }
  
  // Build the frontend
  log('Building frontend with Vite...');
  if (!runCommand('npx vite build')) {
    process.exit(1);
  }
  
  // Build the backend
  log('Building backend with esbuild...');
  if (!runCommand('npx esbuild server/index.ts --platform=node --packages=external --bundle --format=cjs --outdir=dist')) {
    process.exit(1);
  }
  
  // Ensure file extension is .js
  const indexMjs = path.join('dist', 'index.mjs');
  const indexJs = path.join('dist', 'index.js');
  
  if (fs.existsSync(indexMjs) && !fs.existsSync(indexJs)) {
    log('Copying index.mjs to index.js');
    fs.copyFileSync(indexMjs, indexJs);
  }
  
  log('Build completed successfully!');
}

// Run the build
build().catch(error => {
  log('Build failed with error:');
  log(error.message);
  process.exit(1);
});