/**
 * CredentialsPanel - Settings page for managing plugin credentials using MUI
 */
import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Card,
  CardContent,
  TextField,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar,
  Chip,
  CircularProgress,
  Divider,
  InputAdornment,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useBackend } from '../context/BackendContext';
import type {
  PluginType,
  Credential,
  PluginMetadata,
  PluginFieldConfig,
  GitHubCredential,
  AtlassianCredential,
  SupabaseCredential,
  OpenAICredential,
  AnthropicCredential,
  OllamaCredential,
} from '../types/credentials.types';

// Plugin metadata definitions
const PLUGIN_METADATA: PluginMetadata[] = [
  {
    id: 'github',
    name: 'GitHub',
    description: 'Access GitHub repositories, workflows, and issues',
    icon: '🐙',
    category: 'source-control',
    fields: [
      { key: 'token', label: 'Personal Access Token', type: 'password', placeholder: 'ghp_xxxxxxxxxxxx', required: true, helperText: 'Generate from GitHub Settings > Developer settings > Personal access tokens' },
    ],
  },
  {
    id: 'atlassian',
    name: 'Atlassian/Jira',
    description: 'Connect to Jira for project and issue tracking',
    icon: '🔷',
    category: 'project-management',
    fields: [
      { key: 'domain', label: 'Domain', type: 'text', placeholder: 'yourcompany.atlassian.net', required: true },
      { key: 'email', label: 'Email', type: 'text', placeholder: 'you@company.com', required: true },
      { key: 'apiToken', label: 'API Token', type: 'password', placeholder: 'Atlassian API token', required: true, helperText: 'Generate from id.atlassian.com/manage-profile/security/api-tokens' },
    ],
  },
  {
    id: 'supabase',
    name: 'Supabase',
    description: 'Connect to Supabase for database and auth',
    icon: '⚡',
    category: 'database',
    fields: [
      { key: 'projectUrl', label: 'Project URL', type: 'url', placeholder: 'https://xxxxx.supabase.co', required: true },
      { key: 'serviceRoleKey', label: 'Service Role Key', type: 'password', placeholder: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', required: true, helperText: 'Found in Project Settings > API > service_role key' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'Connect to OpenAI API for AI chat capabilities',
    icon: '🤖',
    category: 'ai',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'sk-xxxxxxxxxxxx', required: true },
      { key: 'baseUrl', label: 'Base URL (optional)', type: 'url', placeholder: 'https://api.openai.com/v1', required: false, helperText: 'Leave empty for default OpenAI endpoint' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Connect to Anthropic API for Claude AI',
    icon: '🧠',
    category: 'ai',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'sk-ant-xxxxxxxxxxxx', required: true },
    ],
  },
  {
    id: 'ollama',
    name: 'Ollama',
    description: 'Connect to local Ollama instance for AI models',
    icon: '🦙',
    category: 'ai',
    fields: [
      { key: 'baseUrl', label: 'Base URL', type: 'url', placeholder: 'http://localhost:11434', required: true },
    ],
  },
];

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div role="tabpanel" hidden={value !== index} style={{ height: '100%' }}>
      {value === index && <Box sx={{ p: 2, height: '100%', overflow: 'auto' }}>{children}</Box>}
    </div>
  );
}

interface CredentialFormData {
  name: string;
  [key: string]: string;
}

export default function CredentialsPanel() {
  const backend = useBackend();
  const [tabValue, setTabValue] = useState(0);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCredential, setEditingCredential] = useState<Credential | null>(null);
  const [formData, setFormData] = useState<CredentialFormData>({ name: '' });
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({ open: false, message: '', severity: 'info' });
  const [saving, setSaving] = useState(false);

  // Get plugin types for tabs
  const pluginTypes = useMemo(() => PLUGIN_METADATA.map(p => p.id), []);
  const currentPlugin = PLUGIN_METADATA[tabValue];

  // Load credentials on mount
  useEffect(() => {
    loadCredentials();
  }, []);

  const loadCredentials = async () => {
    setLoading(true);
    try {
      const result = await backend.credentialsLoad();
      if (result.success && result.credentials) {
        setCredentials(result.credentials);
      }
    } catch (err) {
      console.error('Failed to load credentials:', err);
      setSnackbar({ open: true, message: 'Failed to load credentials', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Get credentials for current plugin type
  const currentCredentials = useMemo(() => {
    return credentials.filter(c => c.pluginType === currentPlugin.id);
  }, [credentials, currentPlugin]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const openAddDialog = () => {
    setEditingCredential(null);
    setFormData({ name: `${currentPlugin.name} Connection` });
    setTestResult(null);
    setDialogOpen(true);
  };

  const openEditDialog = (credential: Credential) => {
    setEditingCredential(credential);
    // Populate form with credential data
    const data: CredentialFormData = { name: credential.name };
    currentPlugin.fields.forEach(field => {
      // Use type-safe property access based on credential type
      const credentialRecord = credential as unknown as Record<string, string>;
      data[field.key] = credentialRecord[field.key] || '';
    });
    setFormData(data);
    setTestResult(null);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingCredential(null);
    setFormData({ name: '' });
    setTestResult(null);
    setShowPasswords({});
  };

  const handleFormChange = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const togglePasswordVisibility = (key: string) => {
    setShowPasswords(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      // Build credential object for testing
      const testCredential = buildCredential();
      const result = await backend.credentialsTest(testCredential);
      setTestResult(result);
    } catch (err) {
      setTestResult({ success: false, error: err instanceof Error ? err.message : 'Test failed' });
    } finally {
      setTesting(false);
    }
  };

  const buildCredential = (): Credential => {
    const now = new Date().toISOString();
    const base = {
      id: editingCredential?.id || crypto.randomUUID(),
      pluginType: currentPlugin.id,
      name: formData.name,
      createdAt: editingCredential?.createdAt || now,
      updatedAt: now,
    };

    switch (currentPlugin.id) {
      case 'github':
        return { ...base, pluginType: 'github', token: formData.token } as GitHubCredential;
      case 'atlassian':
        return { ...base, pluginType: 'atlassian', domain: formData.domain, email: formData.email, apiToken: formData.apiToken } as AtlassianCredential;
      case 'supabase':
        return { ...base, pluginType: 'supabase', projectUrl: formData.projectUrl, serviceRoleKey: formData.serviceRoleKey } as SupabaseCredential;
      case 'openai':
        return { ...base, pluginType: 'openai', apiKey: formData.apiKey, baseUrl: formData.baseUrl || undefined } as OpenAICredential;
      case 'anthropic':
        return { ...base, pluginType: 'anthropic', apiKey: formData.apiKey } as AnthropicCredential;
      case 'ollama':
        return { ...base, pluginType: 'ollama', baseUrl: formData.baseUrl } as OllamaCredential;
      default:
        throw new Error('Unknown plugin type');
    }
  };

  const saveCredential = async () => {
    setSaving(true);
    try {
      const credential = buildCredential();
      const result = await backend.credentialsSave(credential);
      
      if (result.success && result.credential) {
        // Update local state
        setCredentials(prev => {
          const idx = prev.findIndex(c => c.id === result.credential!.id);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = result.credential!;
            return updated;
          }
          return [...prev, result.credential!];
        });
        setSnackbar({ open: true, message: editingCredential ? 'Credential updated' : 'Credential saved', severity: 'success' });
        handleCloseDialog();
      } else {
        setSnackbar({ open: true, message: result.error || 'Failed to save credential', severity: 'error' });
      }
    } catch (err) {
      setSnackbar({ open: true, message: err instanceof Error ? err.message : 'Failed to save credential', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const deleteCredential = async (id: string) => {
    try {
      const result = await backend.credentialsDelete(id);
      if (result.success) {
        setCredentials(prev => prev.filter(c => c.id !== id));
        setSnackbar({ open: true, message: 'Credential deleted', severity: 'success' });
      } else {
        setSnackbar({ open: true, message: result.error || 'Failed to delete credential', severity: 'error' });
      }
    } catch (err) {
      setSnackbar({ open: true, message: err instanceof Error ? err.message : 'Failed to delete credential', severity: 'error' });
    }
  };

  const isFormValid = () => {
    if (!formData.name) return false;
    return currentPlugin.fields.every(field => {
      if (field.required) {
        return formData[field.key] && formData[field.key].trim() !== '';
      }
      return true;
    });
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'ai': return 'primary';
      case 'source-control': return 'secondary';
      case 'database': return 'success';
      case 'project-management': return 'warning';
      default: return 'default';
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', bgcolor: '#f7f7f7' }}>
        <CircularProgress size={40} />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#f7f7f7' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: '1px solid #e8e8e8', display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600, color: '#333' }}>
          🔐 Credentials
        </Typography>
        <Box sx={{ flex: 1 }} />
        <IconButton size="small" onClick={loadCredentials} title="Refresh">
          <RefreshIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Plugin Tabs */}
      <Box sx={{ borderBottom: '1px solid #e8e8e8' }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            minHeight: 40,
            '& .MuiTab-root': {
              minHeight: 40,
              textTransform: 'none',
              fontSize: '0.8rem',
              fontWeight: 500,
            },
          }}
        >
          {PLUGIN_METADATA.map(plugin => (
            <Tab
              key={plugin.id}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <span>{plugin.icon}</span>
                  <span>{plugin.name}</span>
                  {credentials.filter(c => c.pluginType === plugin.id).length > 0 && (
                    <Chip
                      size="small"
                      label={credentials.filter(c => c.pluginType === plugin.id).length}
                      sx={{ height: 18, fontSize: '0.65rem', ml: 0.5 }}
                    />
                  )}
                </Box>
              }
            />
          ))}
        </Tabs>
      </Box>

      {/* Tab Content */}
      {PLUGIN_METADATA.map((plugin, index) => (
        <TabPanel key={plugin.id} value={tabValue} index={index}>
          {/* Plugin Info */}
          <Card sx={{ mb: 2 }}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h6" sx={{ fontSize: '1rem' }}>
                  {plugin.icon} {plugin.name}
                </Typography>
                <Chip
                  label={plugin.category.replace('-', ' ')}
                  size="small"
                  color={getCategoryColor(plugin.category) as any}
                  sx={{ fontSize: '0.65rem', height: 20 }}
                />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontSize: '0.8rem' }}>
                {plugin.description}
              </Typography>
            </CardContent>
          </Card>

          {/* Credentials List */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2" sx={{ fontSize: '0.75rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Saved Credentials
            </Typography>
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={openAddDialog}
              sx={{ textTransform: 'none', fontSize: '0.75rem' }}
            >
              Add
            </Button>
          </Box>

          {credentials.filter(c => c.pluginType === plugin.id).length === 0 ? (
            <Card sx={{ bgcolor: '#fafafa' }}>
              <CardContent sx={{ textAlign: 'center', py: 3 }}>
                <Typography color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                  No {plugin.name} credentials configured yet.
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={openAddDialog}
                  sx={{ mt: 1.5, textTransform: 'none' }}
                >
                  Add {plugin.name} Credential
                </Button>
              </CardContent>
            </Card>
          ) : (
            <List sx={{ bgcolor: '#fff', borderRadius: 1, border: '1px solid #e0e0e0' }}>
              {credentials
                .filter(c => c.pluginType === plugin.id)
                .map((credential, idx, arr) => (
                  <ListItem
                    key={credential.id}
                    sx={{
                      borderBottom: idx < arr.length - 1 ? '1px solid #f0f0f0' : 'none',
                      '&:hover': { bgcolor: '#fafafa' },
                    }}
                  >
                    <ListItemText
                      primary={
                        <Typography sx={{ fontSize: '0.85rem', fontWeight: 500 }}>
                          {credential.name}
                        </Typography>
                      }
                      secondary={
                        <Typography sx={{ fontSize: '0.7rem', color: '#999' }}>
                          Added {new Date(credential.createdAt).toLocaleDateString()}
                        </Typography>
                      }
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        size="small"
                        onClick={() => openEditDialog(credential)}
                        title="Edit"
                        sx={{ mr: 0.5 }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => deleteCredential(credential.id)}
                        title="Delete"
                        color="error"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
            </List>
          )}
        </TabPanel>
      ))}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontSize: '1rem', py: 1.5 }}>
          {editingCredential ? `Edit ${currentPlugin.name} Credential` : `Add ${currentPlugin.name} Credential`}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            fullWidth
            label="Name"
            value={formData.name}
            onChange={e => handleFormChange('name', e.target.value)}
            size="small"
            sx={{ mb: 2 }}
            placeholder="Give this credential a name"
          />
          
          <Divider sx={{ my: 2 }} />

          {currentPlugin.fields.map(field => (
            <TextField
              key={field.key}
              fullWidth
              label={field.label}
              value={formData[field.key] || ''}
              onChange={e => handleFormChange(field.key, e.target.value)}
              type={field.type === 'password' && !showPasswords[field.key] ? 'password' : 'text'}
              size="small"
              required={field.required}
              placeholder={field.placeholder}
              helperText={field.helperText}
              sx={{ mb: 2 }}
              InputProps={
                field.type === 'password'
                  ? {
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            size="small"
                            onClick={() => togglePasswordVisibility(field.key)}
                            edge="end"
                          >
                            {showPasswords[field.key] ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }
                  : undefined
              }
            />
          ))}

          {/* Test Result */}
          {testResult && (
            <Alert
              severity={testResult.success ? 'success' : 'error'}
              sx={{ mt: 1, mb: 2 }}
              icon={testResult.success ? <CheckIcon /> : <CloseIcon />}
            >
              {testResult.success ? testResult.message || 'Connection successful!' : testResult.error || 'Connection failed'}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.5 }}>
          <Button onClick={handleCloseDialog} color="inherit" sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            onClick={testConnection}
            disabled={!isFormValid() || testing}
            sx={{ textTransform: 'none' }}
            startIcon={testing ? <CircularProgress size={16} /> : undefined}
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </Button>
          <Button
            onClick={saveCredential}
            variant="contained"
            disabled={!isFormValid() || saving}
            sx={{ textTransform: 'none' }}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
