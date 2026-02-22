const FILE_ICONS = {
  js: '📜', ts: '🔷', jsx: '⚛️', tsx: '⚛️',
  html: '🌐', css: '🎨', scss: '🎨', less: '🎨',
  json: '📋', md: '📝', txt: '📄',
  png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️', svg: '🖼️',
  py: '🐍', rb: '💎', go: '🐹', rs: '🦀',
  yaml: '⚙️', yml: '⚙️', toml: '⚙️',
  sh: '🐚', bash: '🐚', zsh: '🐚',
  lock: '🔒',
};

export function getFileIcon(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  return FILE_ICONS[ext] || '📄';
}
