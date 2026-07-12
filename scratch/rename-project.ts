import * as fs from 'fs';
import * as path from 'path';

const ROOT_DIR = process.cwd();
const IGNORE_DIRS = ['.git', 'node_modules', '.next', '.mnemosyne', 'prisma'];
const ALLOWED_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.html', '.css'];

function shouldProcessFile(filePath: string): boolean {
  if (IGNORE_DIRS.some(dir => filePath.includes(`/${dir}/`))) return false;
  // Explicitly ignore schema.prisma, .env files if any, package-lock.json/pnpm-lock.yaml
  if (filePath.endsWith('pnpm-lock.yaml')) return false;
  
  const ext = path.extname(filePath);
  return ALLOWED_EXTS.includes(ext) || path.basename(filePath) === 'Dockerfile' || path.basename(filePath) === '.env.example';
}

function processFile(filePath: string) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Case-preserving replacements
  // NimitsJarvis -> NimitsJarvis
  content = content.replace(/NimitsJarvis/g, 'NimitsJarvis');
  // nimits-jarvis -> nimits-jarvis
  content = content.replace(/nimits-jarvis/g, 'nimits-jarvis');
  // NIMITS_JARVIS -> NIMITS_JARVIS
  content = content.replace(/NIMITS_JARVIS/g, 'NIMITS_JARVIS');
  // NimitsJarvis -> NimitsJarvis
  content = content.replace(/NimitsJarvis/g, 'NimitsJarvis');

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

console.log("Starting text replacement...");
walkDir(ROOT_DIR);
console.log("Text replacement complete!");
