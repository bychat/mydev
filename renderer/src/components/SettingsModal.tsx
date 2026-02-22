import { useState, useEffect, useCallback } from 'react';
import type { AISettings } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (settings: AISettings) => void;
}

export default function SettingsModal({ open, onClose, onSaved }: Props) {
  const [provider, setProvider] = useState<'ollama' | 'openai'>('ollama');
  const [baseUrl, setBaseUrl] = useState('http://localhost:11434/v1');
  const [apiKey, setApiKey] = useState('ollama');
  const [selectedModel, setSelectedModel] = useState('');
  const [models, setModels] = useState<string[]>([]);
  const [ollamaAvailable, setOllamaAvailable] = useState<boolean | null>(null);
  const [loadingModels, setLoadingModels] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Load saved settings on open
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const settings = await window.electronAPI.aiLoadSettings();
        setProvider(settings.provider);
        setBaseUrl(settings.baseUrl);
        setApiKey(settings.apiKey);
        setSelectedModel(settings.selectedModel);
      } catch { /* use defaults */ }

      const available = await window.electronAPI.aiCheckOllama();
      setOllamaAvailable(available);
    })();
  }, [open]);

  // Fetch models when provider/url/key changes
  const fetchModels = useCallback(async () => {
    setLoadingModels(true);
    setError('');
    try {
      const list = await window.electronAPI.aiListModels(baseUrl, apiKey);
      setModels(list);
      if (list.length > 0 && !list.includes(selectedModel)) {
        setSelectedModel(list[0]);
      }
    } catch {
      setModels([]);
      setError('Failed to fetch models. Check your connection and credentials.');
    } finally {
      setLoadingModels(false);
    }
  }, [baseUrl, apiKey, selectedModel]);

  useEffect(() => {
    if (!open) return;
    if (!baseUrl) return;
    fetchModels();
  }, [open, provider, baseUrl, apiKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleProviderChange = (p: 'ollama' | 'openai') => {
    setProvider(p);
    setModels([]);
    setError('');
    if (p === 'ollama') {
      setBaseUrl('http://localhost:11434/v1');
      setApiKey('ollama');
    } else {
      setBaseUrl('https://api.openai.com/v1');
      setApiKey('');
    }
    setSelectedModel('');
  };

  const handleSave = async () => {
    if (!selectedModel) {
      setError('Please select a model.');
      return;
    }
    setSaving(true);
    const settings: AISettings = { provider, baseUrl, apiKey, selectedModel };
    await window.electronAPI.aiSaveSettings(settings);
    setSaving(false);
    onSaved(settings);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>⚙️ AI Settings</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Provider selector */}
          <label className="modal-label">Provider</label>
          <div className="provider-tabs">
            <button
              className={`provider-tab ${provider === 'ollama' ? 'active' : ''}`}
              onClick={() => handleProviderChange('ollama')}
            >
              🦙 Ollama
              {ollamaAvailable === true && <span className="dot green" />}
              {ollamaAvailable === false && <span className="dot red" />}
            </button>
            <button
              className={`provider-tab ${provider === 'openai' ? 'active' : ''}`}
              onClick={() => handleProviderChange('openai')}
            >
              🤖 OpenAI
            </button>
          </div>

          {/* Ollama status notice */}
          {provider === 'ollama' && ollamaAvailable === false && (
            <div className="modal-notice warn">
              Ollama is not running locally.{' '}
              <a href="https://ollama.com/download" target="_blank" rel="noreferrer">
                Download Ollama
              </a>{' '}
              and start it, then click Refresh.
              <button className="btn-link" onClick={fetchModels}>Refresh</button>
            </div>
          )}
          {provider === 'ollama' && ollamaAvailable === true && (
            <div className="modal-notice ok">✅ Ollama detected and running.</div>
          )}

          {/* Base URL */}
          <label className="modal-label">Base URL</label>
          <input
            className="modal-input"
            value={baseUrl}
            onChange={e => setBaseUrl(e.target.value)}
            placeholder={provider === 'ollama' ? 'http://localhost:11434/v1' : 'https://api.openai.com/v1'}
          />

          {/* API Key */}
          <label className="modal-label">API Key</label>
          <input
            className="modal-input"
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder={provider === 'ollama' ? 'ollama' : 'sk-...'}
          />
          {provider === 'openai' && !apiKey && (
            <div className="modal-notice warn">
              Enter your OpenAI API key to use OpenAI models.
            </div>
          )}

          {/* Model selector */}
          <label className="modal-label">
            Model
            <button className="btn-link" onClick={fetchModels} disabled={loadingModels}>
              {loadingModels ? '⟳ Loading…' : '↻ Refresh'}
            </button>
          </label>
          {models.length > 0 ? (
            <select
              className="modal-select"
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
            >
              {models.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          ) : (
            <div className="modal-notice muted">
              {loadingModels ? 'Fetching models…' : 'No models found. Check your connection.'}
            </div>
          )}

          {error && <div className="modal-notice warn">{error}</div>}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary modal-save" onClick={handleSave} disabled={saving || !selectedModel}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
