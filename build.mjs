import { build } from 'vite';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const copyFile = promisify(fs.copyFile);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const mkdir = promisify(fs.mkdir);

async function copyDir(src, dest) {
  const exists = await stat(src).catch(() => null);
  if (!exists) return;
  
  await mkdir(dest, { recursive: true });
  const files = await readdir(src);
  
  for (const file of files) {
    const srcPath = path.join(src, file);
    const destPath = path.join(dest, file);
    const fileStat = await stat(srcPath);
    
    if (fileStat.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await copyFile(srcPath, destPath);
    }
  }
}

async function runBuild() {
  await build({
    root: __dirname,
    build: {
      outDir: path.resolve(__dirname, 'dist'),
      emptyOutDir: true,
      minify: true,
      rollupOptions: {
        input: path.resolve(__dirname, 'src/index.tsx'),
        output: { 
          dir: path.resolve(__dirname, 'dist'),
          format: 'iife',
          entryFileNames: 'index.js'
        }
      }
    }
  });
  
  const pythonServiceSrc = path.resolve(__dirname, 'python-service');
  const pythonServiceDest = path.resolve(__dirname, 'dist/python-service');
  await copyDir(pythonServiceSrc, pythonServiceDest);
  
  console.log("Build complete: dist/index.js generated.");
  console.log("Python service copied to dist/python-service.");
}
runBuild();