// DOM refs
const importBtn = document.getElementById('import-btn');
const importBtnMain = document.getElementById('import-btn-main');
const fileTreeContainer = document.getElementById('file-tree');
const folderNameEl = document.getElementById('folder-name');
const getStartedCard = document.getElementById('get-started-card');
const badgeGit = document.getElementById('badge-git');
const badgeNpm = document.getElementById('badge-npm');
const badgeNpmName = document.getElementById('badge-npm-name');
const statusPath = document.getElementById('status-path');

// Editor refs
const editorTabs = document.getElementById('editor-tabs');
const editorWrapper = document.getElementById('editor-wrapper');
const editorTextarea = document.getElementById('editor-textarea');
const editorFilepath = document.getElementById('editor-filepath');
const editorStatus = document.getElementById('editor-status');
const editorLineNumbers = document.getElementById('editor-line-numbers');
const btnSave = document.getElementById('btn-save');

// ── Open tabs state ──────────────────────────────────
let openTabs = []; // { name, path, content, modified }
let activeTabPath = null;

function getFileIcon(name) {
  const ext = name.split('.').pop().toLowerCase();
  const icons = {
    js: '📜', ts: '🔷', jsx: '⚛️', tsx: '⚛️',
    html: '🌐', css: '🎨', scss: '🎨', less: '🎨',
    json: '📋', md: '📝', txt: '📄',
    png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️', svg: '🖼️',
    py: '🐍', rb: '💎', go: '🐹', rs: '🦀',
    yaml: '⚙️', yml: '⚙️', toml: '⚙️',
    sh: '🐚', bash: '🐚', zsh: '🐚',
    lock: '🔒', gitignore: '🙈',
  };
  return icons[ext] || '📄';
}

// ── Tabs ─────────────────────────────────────────────
function renderTabs() {
  editorTabs.innerHTML = '';
  openTabs.forEach(tab => {
    const tabEl = document.createElement('div');
    tabEl.className = 'editor-tab' + (tab.path === activeTabPath ? ' active' : '');
    
    const label = document.createElement('span');
    label.className = 'editor-tab-label';
    label.textContent = (tab.modified ? '● ' : '') + tab.name;
    tabEl.appendChild(label);

    const closeBtn = document.createElement('span');
    closeBtn.className = 'editor-tab-close';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeTab(tab.path);
    });
    tabEl.appendChild(closeBtn);

    tabEl.addEventListener('click', () => switchToTab(tab.path));
    editorTabs.appendChild(tabEl);
  });
}

function switchToTab(filePath) {
  // Save current textarea content to the active tab before switching
  if (activeTabPath) {
    const current = openTabs.find(t => t.path === activeTabPath);
    if (current) {
      current.content = editorTextarea.value;
    }
  }
  activeTabPath = filePath;
  const tab = openTabs.find(t => t.path === filePath);
  if (tab) {
    editorTextarea.value = tab.content;
    editorFilepath.textContent = tab.path;
    editorStatus.textContent = tab.modified ? 'Modified' : 'Saved';
    editorStatus.className = 'editor-status' + (tab.modified ? ' modified' : '');
    updateLineNumbers();
  }
  renderTabs();
  // Highlight active file in tree
  document.querySelectorAll('.tree-item--file').forEach(el => el.classList.remove('active'));
}

function closeTab(filePath) {
  openTabs = openTabs.filter(t => t.path !== filePath);
  if (openTabs.length === 0) {
    activeTabPath = null;
    editorTabs.style.display = 'none';
    editorWrapper.style.display = 'none';
    getStartedCard.style.display = 'block';
  } else {
    if (activeTabPath === filePath) {
      switchToTab(openTabs[openTabs.length - 1].path);
    }
  }
  renderTabs();
}

async function openFile(name, filePath) {
  // If already open, just switch
  const existing = openTabs.find(t => t.path === filePath);
  if (existing) {
    switchToTab(filePath);
    return;
  }

  const result = await window.electronAPI.readFile(filePath);
  if (!result.success) return;

  openTabs.push({ name, path: filePath, content: result.content, modified: false });
  
  getStartedCard.style.display = 'none';
  editorTabs.style.display = 'flex';
  editorWrapper.style.display = 'flex';

  switchToTab(filePath);
}

// ── Line numbers ─────────────────────────────────────
function updateLineNumbers() {
  const lines = editorTextarea.value.split('\n').length;
  let html = '';
  for (let i = 1; i <= lines; i++) {
    html += i + '\n';
  }
  editorLineNumbers.textContent = html;
}

// ── Save ─────────────────────────────────────────────
async function saveCurrentFile() {
  if (!activeTabPath) return;
  const tab = openTabs.find(t => t.path === activeTabPath);
  if (!tab) return;

  tab.content = editorTextarea.value;
  const result = await window.electronAPI.saveFile(tab.path, tab.content);
  if (result.success) {
    tab.modified = false;
    editorStatus.textContent = 'Saved';
    editorStatus.className = 'editor-status';
    renderTabs();
  }
}

btnSave.addEventListener('click', saveCurrentFile);

// Cmd+S / Ctrl+S
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault();
    saveCurrentFile();
  }
});

// Track modifications
editorTextarea.addEventListener('input', () => {
  const tab = openTabs.find(t => t.path === activeTabPath);
  if (tab && !tab.modified) {
    tab.modified = true;
    editorStatus.textContent = 'Modified';
    editorStatus.className = 'editor-status modified';
    renderTabs();
  }
  updateLineNumbers();
});

// Sync line number scroll
editorTextarea.addEventListener('scroll', () => {
  editorLineNumbers.scrollTop = editorTextarea.scrollTop;
});

// Tab key inserts 2 spaces
editorTextarea.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault();
    const start = editorTextarea.selectionStart;
    const end = editorTextarea.selectionEnd;
    editorTextarea.value = editorTextarea.value.substring(0, start) + '  ' + editorTextarea.value.substring(end);
    editorTextarea.selectionStart = editorTextarea.selectionEnd = start + 2;
    editorTextarea.dispatchEvent(new Event('input'));
  }
});

// Build file tree DOM
function renderTree(tree, container, depth = 0) {
  tree.forEach(item => {
    const row = document.createElement('div');
    row.className = `tree-item tree-item--${item.type}`;
    row.style.paddingLeft = `${12 + depth * 16}px`;

    if (item.type === 'folder') {
      const arrow = document.createElement('span');
      arrow.className = 'tree-arrow';
      arrow.textContent = '▶';
      row.appendChild(arrow);

      const icon = document.createElement('span');
      icon.className = 'tree-icon';
      icon.textContent = '📁';
      row.appendChild(icon);

      const label = document.createElement('span');
      label.className = 'tree-label';
      label.textContent = item.name;
      row.appendChild(label);

      container.appendChild(row);

      const childContainer = document.createElement('div');
      childContainer.className = 'tree-children collapsed';
      container.appendChild(childContainer);

      if (item.children && item.children.length > 0) {
        renderTree(item.children, childContainer, depth + 1);
      }

      row.addEventListener('click', () => {
        const isCollapsed = childContainer.classList.contains('collapsed');
        childContainer.classList.toggle('collapsed');
        arrow.textContent = isCollapsed ? '▼' : '▶';
        icon.textContent = isCollapsed ? '📂' : '📁';
      });
    } else {
      const spacer = document.createElement('span');
      spacer.className = 'tree-arrow-spacer';
      row.appendChild(spacer);

      const icon = document.createElement('span');
      icon.className = 'tree-icon';
      icon.textContent = getFileIcon(item.name);
      row.appendChild(icon);

      const label = document.createElement('span');
      label.className = 'tree-label';
      label.textContent = item.name;
      row.appendChild(label);

      container.appendChild(row);

      // Click to open file in editor
      row.addEventListener('click', async () => {
        document.querySelectorAll('.tree-item--file').forEach(el => el.classList.remove('active'));
        row.classList.add('active');
        await openFile(item.name, item.path);
      });
    }
  });
}

// Handle import result
function handleImportResult(result) {
  if (!result) return;
  const { folderPath, tree, hasGit, hasPackageJson, packageName } = result;
  const folderName = folderPath.split('/').pop() || folderPath.split('\\').pop();

  // Update folder name in sidebar
  folderNameEl.textContent = `📂 ${folderName}`;
  folderNameEl.style.display = 'block';

  // Render file tree
  fileTreeContainer.innerHTML = '';
  renderTree(tree, fileTreeContainer);

  // Update status bar badges
  if (hasGit) {
    badgeGit.style.display = 'inline-flex';
  } else {
    badgeGit.style.display = 'none';
  }

  if (hasPackageJson) {
    badgeNpm.style.display = 'inline-flex';
    badgeNpmName.textContent = packageName || 'npm';
  } else {
    badgeNpm.style.display = 'none';
  }

  // Show folder path in status bar
  statusPath.textContent = folderPath;

  // Hide get started, show nothing in preview yet
  getStartedCard.style.display = 'none';
}

// Import folder (sidebar button)
importBtn.addEventListener('click', async () => {
  const result = await window.electronAPI.selectFolder();
  handleImportResult(result);
});

// Import folder (main welcome button)
importBtnMain.addEventListener('click', async () => {
  const result = await window.electronAPI.selectFolder();
  handleImportResult(result);
});

// ── Chat ─────────────────────────────────────────────
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatSendBtn = document.getElementById('chat-send-btn');

function addChatMessage(text, sender = 'user') {
  // Remove welcome message if present
  const welcome = chatMessages.querySelector('.chat-welcome');
  if (welcome) welcome.remove();

  const msg = document.createElement('div');
  msg.className = `chat-msg chat-msg--${sender}`;

  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';
  bubble.textContent = text;

  msg.appendChild(bubble);
  chatMessages.appendChild(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function handleSend() {
  const text = chatInput.value.trim();
  if (!text) return;

  addChatMessage(text, 'user');
  chatInput.value = '';
  chatInput.style.height = 'auto';

  // Simulated bot reply
  setTimeout(() => {
    addChatMessage('This is a placeholder response. Connect an AI backend to power real replies!', 'bot');
  }, 600);
}

chatSendBtn.addEventListener('click', handleSend);

chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});

// Auto-grow textarea
chatInput.addEventListener('input', () => {
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
});
