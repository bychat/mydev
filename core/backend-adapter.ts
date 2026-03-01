/**
 * Backend Adapter Interface
 * 
 * This is the abstraction that decouples the renderer (React frontend)
 * from the backend transport. In desktop mode it uses Electron IPC.
 * In cloud/web mode it uses HTTP REST calls.
 * 
 * The renderer only ever imports `BackendAdapter` — it never directly
 * touches `window.electronAPI` or `fetch()`.
 */

import type { ConnectorMetadata, ConnectorState, ConnectorConfigField, ConnectorAction, ConnectorActionResult } from './connector';

// ─── Connector Operations ───

export interface ConnectorOperations {
  /** List all available connectors (metadata only) */
  listConnectors(): Promise<ConnectorMetadata[]>;

  /** Get config fields for a specific connector */
  getConfigFields(connectorId: string): Promise<ConnectorConfigField[]>;

  /** Get available actions for a connector */
  getActions(connectorId: string): Promise<ConnectorAction[]>;

  /** Get current state (connected/disconnected/error) */
  getState(connectorId: string): Promise<ConnectorState>;

  /** Test connection with given config */
  testConnection(connectorId: string, config: Record<string, unknown>): Promise<{ success: boolean; error?: string }>;

  /** Save connector configuration */
  saveConfig(connectorId: string, config: Record<string, unknown>): Promise<void>;

  /** Load saved connector configuration */
  loadConfig(connectorId: string): Promise<Record<string, unknown> | null>;

  /** Execute a connector action */
  executeAction(connectorId: string, actionId: string, params?: Record<string, unknown>): Promise<ConnectorActionResult>;
}

// ─── Full Backend Adapter ───

/**
 * The BackendAdapter combines connector operations with any
 * other backend capabilities (file system, AI, terminal, etc.).
 * 
 * For open-source desktop: ElectronBackendAdapter (uses IPC)
 * For enterprise cloud: HttpBackendAdapter (uses REST API)
 */
export interface BackendAdapter {
  /** Connector plugin operations */
  connectors: ConnectorOperations;

  /** 
   * The mode this adapter is running in.
   * UI can use this to show/hide features (e.g., terminal is desktop-only).
   */
  mode: 'desktop' | 'cloud';

  /**
   * For desktop: the full ElectronAPI is available for file/git/terminal ops.
   * For cloud: these are null and the UI adapts accordingly.
   */
  electron?: unknown;
}
