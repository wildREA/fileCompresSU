import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths are relative to app directory
const distDir = path.resolve(__dirname, '../dist');

// Required files to check
const requiredFiles = [
  'index.html',
  'main.js',
  'package.json',
  'src/styles.css',
  'src/images/appIcon.png',
  'src/logic/preload.js',
  'src/logic/renderer.js',
  'src/logic/utils/compression.js',
  'build/icon.png',
  'build/icon.ico'
];

// Required directories to check
const requiredDirs = [
  'src/logic',
  'src/logic/utils',
  'src/images',
  'build'
];

console.log('Verifying dist directory structure...');

// Check if dist directory exists
if (!fs.existsSync(distDir)) {
  console.error('ERROR: dist directory does not exist!');
  process.exit(1);
}

let missingFiles = 0;
let missingDirs = 0;

// Check for required files
for (const file of requiredFiles) {
  const filePath = path.join(distDir, file);
  if (!fs.existsSync(filePath)) {
    console.error(`MISSING: ${file}`);
    missingFiles++;
  }
}

// Check for required directories
for (const dir of requiredDirs) {
  const dirPath = path.join(distDir, dir);
  if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
    console.error(`MISSING: ${dir}`);
    missingDirs++;
  }
}

// Summary
if (missingFiles === 0 && missingDirs === 0) {
  console.log('✅ Build verification passed! All required files and directories are present.');
  process.exit(0);
} else {
  console.error(`❌ Build verification failed! Missing ${missingFiles} files and ${missingDirs} directories.`);
  process.exit(1);
}
