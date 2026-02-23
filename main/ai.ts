import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export interface AISettings {
  provider: 'ollama' | 'openai';
  baseUrl: string;
  apiKey: string;
  selectedModel: string;
}

const SETTINGS_FILE = (): string => path.join(app.getPath('userData'), 'ai-settings.json');

const DEFAULT_OLLAMA: AISettings = {
  provider: 'ollama',
  baseUrl: 'http://localhost:11434/v1',
  apiKey: 'ollama',
  selectedModel: '',
};

export function loadSettings(): AISettings {
  try {
    const data = fs.readFileSync(SETTINGS_FILE(), 'utf-8');
    return JSON.parse(data);
  } catch {
    return { ...DEFAULT_OLLAMA };
  }
}

export function saveSettings(settings: AISettings): void {
  fs.writeFileSync(SETTINGS_FILE(), JSON.stringify(settings, null, 2), 'utf-8');
}

export async function checkOllama(): Promise<boolean> {
  try {
    const res = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function listModels(baseUrl: string, apiKey: string): Promise<string[]> {
  try {
    const client = new OpenAI({ baseURL: baseUrl, apiKey });
    const list = await client.models.list();
    const models: string[] = [];
    for await (const m of list) {
      models.push(m.id);
    }
    return models.sort();
  } catch {
    return [];
  }
}

export async function chatComplete(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[],
  signal?: AbortSignal,
): Promise<string> {
  const client = new OpenAI({ baseURL: baseUrl, apiKey });
  const response = await client.chat.completions.create(
    { model, messages },
    { signal },
  );
  return response.choices[0]?.message?.content ?? '';
}

/**
 * Streaming chat completion — yields chunks as they arrive.
 * onChunk is called with each text delta.
 * Returns the full assembled response.
 */
export async function chatCompleteStream(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[],
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const client = new OpenAI({ baseURL: baseUrl, apiKey });
  const stream = await client.chat.completions.create(
    { model, messages, stream: true },
    { signal },
  );

  let full = '';
  for await (const part of stream) {
    const delta = part.choices[0]?.delta?.content;
    if (delta) {
      full += delta;
      onChunk(delta);
    }
  }
  return full;
}
