import * as fs from 'fs';
import * as path from 'path';

const ROOT_DIR = process.cwd();
const IGNORE_DIRS = ['.git', 'node_modules', '.next', '.mnemosyne', 'prisma'];
const ALLOWED_EXTS = ['.ts', '.tsx', '.js', '.jsx']; // only TS/JS files

function shouldProcessFile(filePath: string): boolean {
  if (IGNORE_DIRS.some(dir => filePath.includes(`/${dir}/`))) return false;
  if (filePath.endsWith('pnpm-lock.yaml')) return false;
  
  const ext = path.extname(filePath);
  return ALLOWED_EXTS.includes(ext);
}

function processFile(filePath: string) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Fix nimitsJarvisRouter -> nimitsJarvisRouter
  content = content.replace(/nimitsJarvisRouter/g, 'nimitsJarvisRouter');
  // Fix trpc.nimitsJarvis -> trpc.nimitsJarvis
  content = content.replace(/trpc\.nimits-jarvis/g, 'trpc.nimitsJarvis');
  // Fix trpcServer.api.nimitsJarvis -> trpcServer.api.nimitsJarvis
  content = content.replace(/trpcServer\.api\.nimits-jarvis/g, 'trpcServer.api.nimitsJarvis');
  // Fix utils.nimitsJarvis -> utils.nimitsJarvis
  content = content.replace(/utils\.nimits-jarvis/g, 'utils.nimitsJarvis');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${path.relative(ROOT_DIR, filePath)}`);
  }
}

function walkDir(dir: string) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (IGNORE_DIRS.includes(file)) continue;
    
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath);
    } else {
      if (shouldProcessFile(fullPath)) {
        processFile(fullPath);
      }
    }
  }
}

console.log("Starting identifier fix (trpc/router)...");
walkDir(ROOT_DIR);
console.log("Identifier fix complete!");
