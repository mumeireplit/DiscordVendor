#!/bin/bash
# Install dependencies
npm install

# Build the application
npm run build

# Ensure dist directory exists
mkdir -p dist

# Fix the output file issue
if [ ! -f dist/index.js ] && [ -f dist/index.mjs ]; then
  cp dist/index.mjs dist/index.js
fi

echo "Build completed successfully!"