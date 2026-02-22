const fs = require('fs');
const path = require('path');

const HIDDEN_PREFIXES = ['.'];
const SKIP_DIRS = ['node_modules', '__pycache__', '.git'];

function readDirectoryTree(dirPath) {
  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const sorted = entries
    .filter(e => !HIDDEN_PREFIXES.some(p => e.name.startsWith(p)) && !SKIP_DIRS.includes(e.name))
    .sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

  return sorted.map(entry => {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      return { name: entry.name, path: fullPath, type: 'folder', children: readDirectoryTree(fullPath) };
    }
    return { name: entry.name, path: fullPath, type: 'file' };
  });
}

module.exports = { readDirectoryTree };
