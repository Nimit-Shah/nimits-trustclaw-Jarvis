import fs from 'fs';
import path from 'path';

const nextDir = path.join(process.cwd(), '.next');

if (fs.existsSync(nextDir)) {
  console.log('Removing .next directory...');
  fs.rmSync(nextDir, { recursive: true, force: true });
  console.log('.next directory removed successfully.');
} else {
  console.log('.next directory does not exist.');
}
