import { BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';

export interface DebugLogEntry {
  id: number;
  timestamp: string;
  model: string;
  baseUrl: string;
  messages: { role: string; content: string }[];
  status: 'pending' | 'success' | 'error' | 'aborted';
  response?: string;
  error?: string;
  durationMs?: number;
}

let debugWindow: BrowserWindow | null = null;
const debugLog: DebugLogEntry[] = [];
let nextId = 1;

/** Open (or focus) the debug window */
export function openDebugWindow(): void {
  if (debugWindow && !debugWindow.isDestroyed()) {
    debugWindow.focus();
    return;
  }

  debugWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 600,
    minHeight: 400,
    title: 'AI Session Debug',
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
    },
  });

  debugWindow.loadFile(path.join(__dirname, '..', '..', 'debug-window.html'));
  debugWindow.on('closed', () => { debugWindow = null; });

  // Once the window is ready, send the full log history
  debugWindow.webContents.on('did-finish-load', () => {
    debugWindow?.webContents.send('debug-log-init', debugLog);
  });
}

/** Record a new outgoing AI request. Returns the entry id for updating later. */
export function logRequest(baseUrl: string, model: string, messages: { role: string; content: string }[]): number {
  const entry: DebugLogEntry = {
    id: nextId++,
    timestamp: new Date().toISOString(),
    model,
    baseUrl,
    messages: messages.map(m => ({ ...m })),
    status: 'pending',
  };
  debugLog.push(entry);

  // Push to debug window if open
  if (debugWindow && !debugWindow.isDestroyed()) {
    debugWindow.webContents.send('debug-log-entry', entry);
  }

  return entry.id;
}

/** Update an existing entry with the result */
export function logResult(id: number, status: 'success' | 'error' | 'aborted', response?: string, error?: string, durationMs?: number): void {
  const entry = debugLog.find(e => e.id === id);
  if (!entry) return;
  entry.status = status;
  entry.response = response;
  entry.error = error;
  entry.durationMs = durationMs;

  if (debugWindow && !debugWindow.isDestroyed()) {
    debugWindow.webContents.send('debug-log-update', { id, status, response, error, durationMs });
  }
}

/** Clear all debug entries */
export function clearDebugLog(): void {
  debugLog.length = 0;
  if (debugWindow && !debugWindow.isDestroyed()) {
    debugWindow.webContents.send('debug-log-init', []);
  }
}

/** Register IPC handlers for the debug window */
export function registerDebugIpc(): void {
  ipcMain.handle('debug-open', () => {
    openDebugWindow();
    return { success: true };
  });

  ipcMain.handle('debug-clear', () => {
    clearDebugLog();
    return { success: true };
  });

  ipcMain.handle('debug-get-log', () => {
    return debugLog;
  });
}
