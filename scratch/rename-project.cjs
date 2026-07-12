const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = dir + '/' + file;
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      if (!file.includes('node_modules') && !file.includes('.git') && !file.includes('.next') && !file.includes('scratch')) {
        results = results.concat(walk(file));
      }
    } else {
      if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.md')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('.');
let changed = 0;
files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  // We use regex \bNimitsJarvis\b without 'i' flag so it's case sensitive and exact
  const newContent = content.replace(/\bNimitsJarvis\b/g, 'Nimits-Jarvis');
  if (content !== newContent) {
    fs.writeFileSync(file, newContent, 'utf8');
    console.log(`Updated ${file}`);
    changed++;
  }
});
console.log(`Changed ${changed} files.`);
