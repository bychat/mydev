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

export function loadAISettings(): AISettings {
  return readJSON<AISettings>(AI_SETTINGS_FILE(), { ...DEFAULT_OLLAMA });
}

export function saveAISettings(settings: AISettings): void {
  writeJSON(AI_SETTINGS_FILE(), settings);
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

export function loadAtlassianConnections(): AtlassianConnection[] {
  return readJSON<AtlassianConnection[]>(ATLASSIAN_FILE(), []);
}

export function saveAtlassianConnections(connections: AtlassianConnection[]): void {
  writeJSON(ATLASSIAN_FILE(), connections);
}
