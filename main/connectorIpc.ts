/**
 * Connector IPC Handlers
 * 
 * Bridges the ConnectorRegistry to Electron IPC so the renderer
 * can interact with connectors via the preload script.
 * 
 * This is only used in desktop (Electron) mode.
 * In cloud mode, the server/index.ts REST API handles the same operations.
 */

import { ipcMain } from 'electron';
import { getConnectorRegistry } from '../connectors';

export function registerConnectorIpcHandlers(): void {
  const registry = getConnectorRegistry();

  // List all connectors
  ipcMain.handle('connector-list', async () => {
    return registry.listConnectors();
  });

  // Get full connector details
  ipcMain.handle('connector-get', async (_event, connectorId: string) => {
    const connector = registry.get(connectorId);
    if (!connector) return null;
    return {
      metadata: connector.metadata,
      configFields: connector.configFields,
      actions: connector.actions,
      state: registry.getState(connectorId),
    };
  });

  // Get connector state
  ipcMain.handle('connector-get-state', async (_event, connectorId: string) => {
    return registry.getState(connectorId);
  });

  // Test connection
  ipcMain.handle('connector-test', async (_event, connectorId: string, config: Record<string, unknown>) => {
    return registry.testConnection(connectorId, config);
  });

  // Save config
  ipcMain.handle('connector-save-config', async (_event, connectorId: string, config: Record<string, unknown>) => {
    registry.setConfig(connectorId, config);
    return { success: true };
  });

  // Load config
  ipcMain.handle('connector-load-config', async (_event, connectorId: string) => {
    return registry.getConfig(connectorId) ?? null;
  });

  // Execute action
  ipcMain.handle('connector-execute', async (
    _event,
    connectorId: string,
    actionId: string,
    params?: Record<string, unknown>,
  ) => {
    return registry.executeAction(connectorId, actionId, params);
  });
}
