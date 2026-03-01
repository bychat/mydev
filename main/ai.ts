import OpenAI from 'openai';

export interface AISettings {
  provider: 'ollama' | 'openai';
  baseUrl: string;
  apiKey: string;
  selectedModel: string;
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
