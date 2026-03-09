/**
 * Credentials REST API routes
 */
import { Router } from 'express';
import {
  loadCredentials,
  saveCredential,
  deleteCredential,
  getCredentialsByType,
  type Credential,
  type PluginType,
} from '../../main/storage';

const router = Router();

// Load all credentials
router.get('/credentials', (_req, res) => {
  try {
    const credentials = loadCredentials();
    res.json({ success: true, credentials });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Failed to load credentials' });
  }
});

// Load credentials by plugin type
router.get('/credentials/type/:pluginType', (req, res) => {
  try {
    const pluginType = req.params.pluginType as PluginType;
    const credentials = getCredentialsByType(pluginType);
    res.json({ success: true, credentials });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Failed to load credentials' });
  }
});

// Save/update a credential
router.post('/credentials', (req, res) => {
  try {
    const credential = req.body as Credential;
    const saved = saveCredential(credential);
    res.json({ success: true, credential: saved });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Failed to save credential' });
  }
});

// Delete a credential
router.post('/credentials/:id/delete', (req, res) => {
  try {
    const deleted = deleteCredential(req.params.id);
    if (deleted) {
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: 'Credential not found' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Failed to delete credential' });
  }
});

// Test a credential connection
router.post('/credentials/test', async (req, res) => {
  try {
    const credential = req.body as Credential;

    // Basic validation based on credential type
    switch (credential.pluginType) {
      case 'github':
        if (!credential.token) {
          res.json({ success: false, error: 'Token is required' });
          return;
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
          res.json({ success: true, message: `Connected as ${user.login}` });
          return;
        }
        res.json({ success: false, error: 'Invalid token or authentication failed' });
        return;

      case 'atlassian':
        if (!credential.domain || !credential.email || !credential.apiToken) {
          res.json({ success: false, error: 'Domain, email, and API token are required' });
          return;
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
          res.json({ success: true, message: `Connected as ${user.displayName}` });
          return;
        }
        res.json({ success: false, error: 'Invalid credentials or domain' });
        return;

      case 'supabase':
        if (!credential.projectUrl || !credential.serviceRoleKey) {
          res.json({ success: false, error: 'Project URL and service role key are required' });
          return;
        }
        // Test Supabase API access using the health endpoint
        try {
          const sbResponse = await fetch(`${credential.projectUrl}/rest/v1/`, {
            headers: {
              'apikey': credential.serviceRoleKey,
              'Authorization': `Bearer ${credential.serviceRoleKey}`,
            },
          });
          // Accept 200-299 status codes, or 401 with proper error message (means API is reachable but auth failed)
          if (sbResponse.ok) {
            res.json({ success: true, message: 'Connected to Supabase project' });
            return;
          }
          if (sbResponse.status === 401) {
            res.json({ success: false, error: 'Invalid service role key - authentication failed' });
            return;
          }
          res.json({ success: false, error: `Supabase API returned status ${sbResponse.status}` });
          return;
        } catch {
          res.json({ success: false, error: 'Could not connect to Supabase project URL' });
          return;
        }

      case 'openai':
        if (!credential.apiKey) {
          res.json({ success: false, error: 'API key is required' });
          return;
        }
        // Test OpenAI API access
        const oaiBaseUrl = credential.baseUrl || 'https://api.openai.com/v1';
        const oaiResponse = await fetch(`${oaiBaseUrl}/models`, {
          headers: {
            'Authorization': `Bearer ${credential.apiKey}`,
          },
        });
        if (oaiResponse.ok) {
          res.json({ success: true, message: 'Connected to OpenAI API' });
          return;
        }
        res.json({ success: false, error: 'Invalid API key' });
        return;

      case 'anthropic':
        if (!credential.apiKey) {
          res.json({ success: false, error: 'API key is required' });
          return;
        }
        // Anthropic doesn't have a simple test endpoint, so we validate the key format
        if (credential.apiKey.startsWith('sk-ant-')) {
          res.json({ success: true, message: 'API key format is valid' });
          return;
        }
        res.json({ success: false, error: 'Invalid API key format (should start with sk-ant-)' });
        return;

      case 'ollama':
        if (!credential.baseUrl) {
          res.json({ success: false, error: 'Base URL is required' });
          return;
        }
        // Test Ollama API access
        try {
          const ollamaResponse = await fetch(`${credential.baseUrl}/api/tags`);
          if (ollamaResponse.ok) {
            res.json({ success: true, message: 'Connected to Ollama' });
            return;
          }
          res.json({ success: false, error: 'Could not connect to Ollama server' });
          return;
        } catch {
          res.json({ success: false, error: 'Could not connect to Ollama server' });
          return;
        }

      default:
        res.json({ success: false, error: 'Unknown plugin type' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Connection test failed' });
  }
});

export default router;
