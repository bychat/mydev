/**
 * Credentials types for plugin integrations
 */

/** Supported plugin/credential types */
export type PluginType = 
  | 'github'
  | 'atlassian'
  | 'supabase'
  | 'openai'
  | 'anthropic'
  | 'ollama';

/** Base credential interface */
export interface CredentialBase {
  id: string;
  pluginType: PluginType;
  name: string;
  createdAt: string;
  updatedAt: string;
}

/** GitHub credential */
export interface GitHubCredential extends CredentialBase {
  pluginType: 'github';
  token: string;
}

/** Atlassian/Jira credential */
export interface AtlassianCredential extends CredentialBase {
  pluginType: 'atlassian';
  domain: string;
  email: string;
  apiToken: string;
}

/** Supabase credential */
export interface SupabaseCredential extends CredentialBase {
  pluginType: 'supabase';
  projectUrl: string;
  serviceRoleKey: string;
}

/** OpenAI credential */
export interface OpenAICredential extends CredentialBase {
  pluginType: 'openai';
  apiKey: string;
  baseUrl?: string;
}

/** Anthropic credential */
export interface AnthropicCredential extends CredentialBase {
  pluginType: 'anthropic';
  apiKey: string;
}

/** Ollama credential */
export interface OllamaCredential extends CredentialBase {
  pluginType: 'ollama';
  baseUrl: string;
}

/** Union type for all credentials */
export type Credential = 
  | GitHubCredential
  | AtlassianCredential
  | SupabaseCredential
  | OpenAICredential
  | AnthropicCredential
  | OllamaCredential;

/** Plugin metadata for UI display */
export interface PluginMetadata {
  id: PluginType;
  name: string;
  description: string;
  icon: string;
  category: 'ai' | 'source-control' | 'database' | 'project-management';
  fields: PluginFieldConfig[];
}

/** Field configuration for credential forms */
export interface PluginFieldConfig {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url';
  placeholder?: string;
  required?: boolean;
  helperText?: string;
}

/** All credentials stored */
export interface CredentialsStore {
  credentials: Credential[];
}

/** Result type for credential operations */
export interface CredentialResult {
  success: boolean;
  error?: string;
  credential?: Credential;
}

/** Result type for test connection */
export interface CredentialTestResult {
  success: boolean;
  error?: string;
  message?: string;
}
