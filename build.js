import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Ensure dist directory exists
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist');
}

console.log('📦 Building frontend...');
execSync('vite build', { stdio: 'inherit' });

console.log('📦 Building backend...');
execSync('esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist', { 
  stdio: 'inherit' 
});

console.log('✅ Build completed successfully!');