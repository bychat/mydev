import { useState, useEffect, useCallback, useRef } from 'react';
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext';
import { useBackend } from './context/BackendContext';
import StatusBar from './components/StatusBar';
import ActivityBar from './components/ActivityBar';
import Sidebar from './components/Sidebar';
import Editor from './components/Editor';
import ChatPanel from './components/ChatPanel';
import Welcome from './components/Welcome';
import TerminalPanel from './components/TerminalPanel';
import { ChevronLeftIcon, ChevronRightIcon } from './components/icons';

const SIDEBAR_MIN = 180;
const SIDEBAR_MAX = 600;
const SIDEBAR_DEFAULT = 260;
const CHAT_MIN = 250;
const CHAT_MAX = 700;
const CHAT_DEFAULT = 320;

function AppLayout() {
  const { openTabs, folderPath } = useWorkspace();
  const backend = useBackend();
  const [terminalVisible, setTerminalVisible] = useState(false);

  // ── Panel widths & collapsed state ──
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT);
  const [chatWidth, setChatWidth] = useState(CHAT_DEFAULT);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [chatCollapsed, setChatCollapsed] = useState(false);

  // Refs for drag resize
  const draggingSidebar = useRef(false);
  const draggingChat = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const toggleTerminal = useCallback(() => {
    if (folderPath) setTerminalVisible(prev => !prev);
  }, [folderPath]);

  // Listen for menu-triggered toggle
  useEffect(() => {
    const cleanup = backend.onToggleTerminal(toggleTerminal);
    return cleanup;
  }, [toggleTerminal]);

  // Listen for show-terminal event (e.g. from npm script run)
  useEffect(() => {
    const handler = () => {
      if (folderPath) setTerminalVisible(true);
    };
    window.addEventListener('show-terminal', handler);
    return () => window.removeEventListener('show-terminal', handler);
  }, [folderPath]);

  // Keyboard shortcut: Ctrl/Cmd + `
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '`') {
        e.preventDefault();
        toggleTerminal();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleTerminal]);

  // ── Mouse drag handlers (global, so they work even when cursor leaves the handle) ──
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (draggingSidebar.current) {
        const delta = e.clientX - startX.current;
        const newW = Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, startWidth.current + delta));
        setSidebarWidth(newW);
      }
      if (draggingChat.current) {
        // Chat is on the right side — dragging left increases width
        const delta = startX.current - e.clientX;
        const newW = Math.max(CHAT_MIN, Math.min(CHAT_MAX, startWidth.current + delta));
        setChatWidth(newW);
      }
    };
    const onMouseUp = () => {
      draggingSidebar.current = false;
      draggingChat.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const onSidebarResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    draggingSidebar.current = true;
    startX.current = e.clientX;
    startWidth.current = sidebarWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [sidebarWidth]);

  const onChatResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    draggingChat.current = true;
    startX.current = e.clientX;
    startWidth.current = chatWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [chatWidth]);

  // No folder loaded → full-screen welcome
  if (!folderPath) {
    return (
      <div className="app-layout">
        <StatusBar />
        <main className="main-content"><Welcome /></main>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <StatusBar />
      <div className="app-body">
        <ActivityBar 
          onToggleTerminal={toggleTerminal} 
          terminalVisible={terminalVisible} 
        />

        {/* ── Sidebar (collapsible + resizable) ── */}
        {sidebarCollapsed ? (
          <div className="panel-collapsed sidebar-collapsed">
            <button className="panel-expand-btn" onClick={() => setSidebarCollapsed(false)} title="Expand sidebar">
              <ChevronRightIcon />
            </button>
          </div>
        ) : (
          <>
            <div style={{ width: sidebarWidth, minWidth: sidebarWidth, maxWidth: sidebarWidth }} className="sidebar-resizable">
              <Sidebar onCollapse={() => setSidebarCollapsed(true)} />
            </div>
            <div className="resize-handle" onMouseDown={onSidebarResizeStart} />
          </>
        )}

        <div className="main-area">
          <main className="main-content">{openTabs.length > 0 ? <Editor /> : <div className="empty-editor" />}</main>
          <TerminalPanel visible={terminalVisible} onClose={() => setTerminalVisible(false)} />
        </div>

        {/* ── Chat Panel (collapsible + resizable) ── */}
        {chatCollapsed ? (
          <div className="panel-collapsed chat-collapsed">
            <button className="panel-expand-btn" onClick={() => setChatCollapsed(false)} title="Expand chat">
              <ChevronLeftIcon />
            </button>
          </div>
        ) : (
          <>
            <div className="resize-handle" onMouseDown={onChatResizeStart} />
            <div style={{ width: chatWidth, minWidth: chatWidth, maxWidth: chatWidth }} className="chat-resizable">
              <ChatPanel onCollapse={() => setChatCollapsed(true)} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <WorkspaceProvider>
      <AppLayout />
    </WorkspaceProvider>
  );
}
