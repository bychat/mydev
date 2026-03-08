/**
 * Centralized user-data persistence layer.
 *
 * All JSON settings / credential files that live in the user-data directory
 * are read / written through this module. Domain modules (ai, prompts,
 * atlassian, etc.) stay pure — they never know *where* data is stored.
 */
import * as fs from 'fs';
import * as path from 'path';
import { getUserDataDir } from '../core/dataDir';

// ── helpers ──────────────────────────────────────────────────────────────────

function dataFile(name: string): string {
  return path.join(getUserDataDir(), name);
}

function readJSON<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return fallback;
  }
}

function writeJSON(file: string, data: unknown): void {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

// ── AI Settings ──────────────────────────────────────────────────────────────

import type { AISettings } from './ai';

const AI_SETTINGS_FILE = () => dataFile('ai-settings.json');

const DEFAULT_OLLAMA: AISettings = {
  provider: 'ollama',
  baseUrl: 'http://localhost:11434/v1',
  apiKey: 'ollama',
  selectedModel: '',
};

/**
 * Build default AI settings from environment variables.
 * Priority: ANTHROPIC_API_KEY → OPENAI_API_KEY → Ollama (local).
 */
function defaultsFromEnv(): AISettings {
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const openaiBase = process.env.OPENAI_BASE_URL?.trim();
  const ollamaBase = process.env.OLLAMA_BASE_URL?.trim();
  const defaultModel = process.env.BYCHAT_MODEL?.trim() || '';

  if (anthropicKey) {
    return { provider: 'anthropic', baseUrl: 'anthropic', apiKey: anthropicKey, selectedModel: defaultModel };
  }
  if (openaiKey) {
    return { provider: 'openai', baseUrl: openaiBase || 'https://api.openai.com/v1', apiKey: openaiKey, selectedModel: defaultModel };
  }
  return {
    provider: 'ollama',
    baseUrl: ollamaBase || 'http://localhost:11434/v1',
    apiKey: 'ollama',
    selectedModel: defaultModel,
  };
}

export function loadAISettings(): AISettings {
  const saved = readJSON<AISettings | null>(AI_SETTINGS_FILE(), null);
  const envDefaults = defaultsFromEnv();
  const envKeys = loadEnvApiKeys();

  if (saved) {
    // For the saved provider, prefer the .env key if one exists (it's the
    // source of truth for credentials), otherwise keep the saved key.
    const envForProvider = envKeys[saved.provider];
    const apiKey = envForProvider?.apiKey || saved.apiKey || envDefaults.apiKey;
    const baseUrl = saved.provider === 'ollama'
      ? (saved.baseUrl || envForProvider?.baseUrl || envDefaults.baseUrl)
      : (saved.baseUrl || envDefaults.baseUrl);

    return {
      provider: saved.provider,
      baseUrl,
      apiKey,
      selectedModel: saved.selectedModel || envDefaults.selectedModel,
    };
  }

  return envDefaults;
}

export function saveAISettings(settings: AISettings): void {
  writeJSON(AI_SETTINGS_FILE(), settings);
}

/** Return env-based API keys for every known provider (used by settings UI to pre-fill fields). */
export function loadEnvApiKeys(): Record<string, { apiKey: string; baseUrl: string }> {
  const result: Record<string, { apiKey: string; baseUrl: string }> = {};

  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (anthropicKey) {
    result.anthropic = { apiKey: anthropicKey, baseUrl: 'anthropic' };
  }

  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  if (openaiKey) {
    result.openai = { apiKey: openaiKey, baseUrl: process.env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1' };
  }

  const ollamaBase = process.env.OLLAMA_BASE_URL?.trim();
  result.ollama = { apiKey: 'ollama', baseUrl: ollamaBase || 'http://localhost:11434/v1' };

  return result;
}

// ── Prompt Settings ──────────────────────────────────────────────────────────

import type { PromptSettings } from './prompts';
import { DEFAULT_PROMPTS } from './prompts';

const PROMPTS_FILE = () => dataFile('prompt-settings.json');

export function loadPromptSettings(): PromptSettings {
  const saved = readJSON<Partial<PromptSettings>>(PROMPTS_FILE(), {});
  return { ...DEFAULT_PROMPTS, ...saved };
}

export function savePromptSettings(prompts: PromptSettings): void {
  writeJSON(PROMPTS_FILE(), prompts);
}

export function resetPromptSettings(): PromptSettings {
  writeJSON(PROMPTS_FILE(), DEFAULT_PROMPTS);
  return { ...DEFAULT_PROMPTS };
}

// ── Atlassian Connections ────────────────────────────────────────────────────

import type { AtlassianConnection } from './atlassian';

const ATLASSIAN_FILE = () => dataFile('atlassian-connections.json');

/**
 * Load Atlassian connections from JSON file, merging in any connection
 * defined via environment variables (ATLASSIAN_DOMAIN, ATLASSIAN_EMAIL,
 * ATLASSIAN_API_TOKEN). The env-based connection is always first and
 * won't be duplicated if it already exists in the saved file.
 */
export function loadAtlassianConnections(): AtlassianConnection[] {
  const saved = readJSON<AtlassianConnection[]>(ATLASSIAN_FILE(), []);

  // Check for env-based connection
  const domain = process.env.ATLASSIAN_DOMAIN;
  const email = process.env.ATLASSIAN_EMAIL;
  const apiToken = process.env.ATLASSIAN_API_TOKEN;

  if (domain && email && apiToken) {
    const envConnection: AtlassianConnection = { domain, email, apiToken };
    // Don't duplicate if this domain+email already exists
    const exists = saved.some(c => c.domain === domain && c.email === email);
    if (!exists) {
      return [envConnection, ...saved];
    }
    // Update token in case it changed in env
    return saved.map(c =>
      c.domain === domain && c.email === email ? { ...c, apiToken } : c,
    );
  }

  return saved;
}

export function saveAtlassianConnections(connections: AtlassianConnection[]): void {
  writeJSON(ATLASSIAN_FILE(), connections);
}

// ── MCP Servers ──────────────────────────────────────────────────────────────

import type { McpServerConfig } from './mcpServers';

const MCP_SERVERS_FILE = () => dataFile('mcp-servers.json');

export function loadMcpServers(): McpServerConfig[] {
  return readJSON<McpServerConfig[]>(MCP_SERVERS_FILE(), []);
}

export function saveMcpServers(servers: McpServerConfig[]): void {
  writeJSON(MCP_SERVERS_FILE(), servers);
}
