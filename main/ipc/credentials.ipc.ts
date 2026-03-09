/**
 * Credentials IPC handlers — load/save/delete credentials for plugins
 */
import { ipcMain } from 'electron';
import {
  loadCredentials,
  saveCredential,
  deleteCredential,
  getCredentialsByType,
  type Credential,
  type PluginType,
} from '../storage';

export function registerCredentialsIpc(): void {
  // Load all credentials
  ipcMain.handle('credentials-load', async () => {
    try {
      const credentials = loadCredentials();
      return { success: true, credentials };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to load credentials' };
    }
  });

  // Load credentials by plugin type
  ipcMain.handle('credentials-load-by-type', async (_event, pluginType: PluginType) => {
    try {
      const credentials = getCredentialsByType(pluginType);
      return { success: true, credentials };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to load credentials' };
    }
  });

  // Save/update a credential
  ipcMain.handle('credentials-save', async (_event, credential: Credential) => {
    try {
      const saved = saveCredential(credential);
      return { success: true, credential: saved };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to save credential' };
    }
  });

  // Delete a credential
  ipcMain.handle('credentials-delete', async (_event, credentialId: string) => {
    try {
      const deleted = deleteCredential(credentialId);
      if (deleted) {
        return { success: true };
      }
      return { success: false, error: 'Credential not found' };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to delete credential' };
    }
  });

  // Test a credential connection (basic validation)
  ipcMain.handle('credentials-test', async (_event, credential: Credential) => {
    try {
      // Basic validation based on credential type
      switch (credential.pluginType) {
        case 'github':
          if (!credential.token) {
            return { success: false, error: 'Token is required' };
          }
          // Test GitHub API access
          const ghResponse = await fetch('https://api.github.com/user', {
            headers: {
              'Authorization': `Bearer ${credential.token}`,
              'Accept': 'application/vnd.github.v3+json',
            },
          });
          if (ghResponse.ok) {
            const user = await ghResponse.json() as { login: string };
            return { success: true, message: `Connected as ${user.login}` };
          }
          return { success: false, error: 'Invalid token or authentication failed' };

        case 'atlassian':
          if (!credential.domain || !credential.email || !credential.apiToken) {
            return { success: false, error: 'Domain, email, and API token are required' };
          }
          // Test Atlassian API access
          const atAuth = Buffer.from(`${credential.email}:${credential.apiToken}`).toString('base64');
          const atResponse = await fetch(`https://${credential.domain}/rest/api/3/myself`, {
            headers: {
              'Authorization': `Basic ${atAuth}`,
              'Accept': 'application/json',
            },
          });
          if (atResponse.ok) {
            const user = await atResponse.json() as { displayName: string };
            return { success: true, message: `Connected as ${user.displayName}` };
          }
          return { success: false, error: 'Invalid credentials or domain' };

        case 'supabase':
          if (!credential.projectUrl || !credential.serviceRoleKey) {
            return { success: false, error: 'Project URL and service role key are required' };
          }
          // Test Supabase API access
          try {
            const sbResponse = await fetch(`${credential.projectUrl}/rest/v1/`, {
              headers: {
                'apikey': credential.serviceRoleKey,
                'Authorization': `Bearer ${credential.serviceRoleKey}`,
              },
            });
            // Accept 200-299 status codes
            if (sbResponse.ok) {
              return { success: true, message: 'Connected to Supabase project' };
            }
            if (sbResponse.status === 401) {
              return { success: false, error: 'Invalid service role key - authentication failed' };
            }
            return { success: false, error: `Supabase API returned status ${sbResponse.status}` };
          } catch {
            return { success: false, error: 'Could not connect to Supabase project URL' };
          }

        case 'openai':
          if (!credential.apiKey) {
            return { success: false, error: 'API key is required' };
          }
          // Test OpenAI API access
          const oaiBaseUrl = credential.baseUrl || 'https://api.openai.com/v1';
          const oaiResponse = await fetch(`${oaiBaseUrl}/models`, {
            headers: {
              'Authorization': `Bearer ${credential.apiKey}`,
            },
          });
          if (oaiResponse.ok) {
            return { success: true, message: 'Connected to OpenAI API' };
          }
          return { success: false, error: 'Invalid API key' };

        case 'anthropic':
          if (!credential.apiKey) {
            return { success: false, error: 'API key is required' };
          }
          // Anthropic doesn't have a simple test endpoint, so we validate the key format
          if (credential.apiKey.startsWith('sk-ant-')) {
            return { success: true, message: 'API key format is valid' };
          }
          return { success: false, error: 'Invalid API key format (should start with sk-ant-)' };

        case 'ollama':
          if (!credential.baseUrl) {
            return { success: false, error: 'Base URL is required' };
          }
          // Test Ollama API access
          try {
            const ollamaResponse = await fetch(`${credential.baseUrl}/api/tags`);
            if (ollamaResponse.ok) {
              return { success: true, message: 'Connected to Ollama' };
            }
            return { success: false, error: 'Could not connect to Ollama server' };
          } catch {
            return { success: false, error: 'Could not connect to Ollama server' };
          }

        default:
          return { success: false, error: 'Unknown plugin type' };
      }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Connection test failed' };
    }
  });
}
