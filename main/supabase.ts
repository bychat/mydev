/**
 * Supabase configuration detection module
 * Simply scans workspace for any .env file containing "supabase"
 */
import * as fs from 'fs';
import * as path from 'path';

export interface SupabaseConfig {
  detected: boolean;
  projectUrl: string | null;
  projectRef: string | null;
  sourceFile: string | null;
  serviceRoleKey?: string | null;
}

export interface SupabaseUser {
  id: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  app_metadata: Record<string, unknown>;
  user_metadata: Record<string, unknown>;
}

export interface SupabaseUsersResult {
  success: boolean;
  users: SupabaseUser[];
  error?: string;
}

export interface SupabaseBucket {
  id: string;
  name: string;
  public: boolean;
  created_at: string;
  updated_at: string;
  file_size_limit: number | null;
  allowed_mime_types: string[] | null;
}

export interface SupabaseStorageObject {
  id: string;
  name: string;
  bucket_id: string;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
}

export interface SupabaseStorageResult {
  success: boolean;
  buckets: SupabaseBucket[];
  error?: string;
}

// Directories to skip when scanning
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.nuxt',
  '.output',
  'coverage',
  '.cache',
]);

/**
 * Extract project URL from env content
 */
function extractUrl(content: string): string | null {
  // Look for any URL containing supabase.co
  const match = content.match(/https?:\/\/[a-z0-9-]+\.supabase\.co[^\s"']*/i);
  return match ? match[0] : null;
}

/**
 * Extract project reference from Supabase URL
 */
function extractProjectRef(url: string): string | null {
  const match = url.match(/https?:\/\/([a-z0-9-]+)\.supabase\.co/i);
  return match ? match[1] : null;
}

/**
 * Extract service role key from env content
 */
function extractServiceRoleKey(content: string): string | null {
  // Look for SUPABASE_SERVICE_ROLE_KEY or similar patterns
  const patterns = [
    /SUPABASE_SERVICE_ROLE_KEY\s*=\s*["']?([a-zA-Z0-9._-]+)["']?/i,
    /SERVICE_ROLE_KEY\s*=\s*["']?([a-zA-Z0-9._-]+)["']?/i,
    /SUPABASE_SERVICE_KEY\s*=\s*["']?([a-zA-Z0-9._-]+)["']?/i,
  ];
  
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) return match[1];
  }
  return null;
}

interface EnvFileInfo {
  filePath: string;
  content: string;
  hasServiceRoleKey: boolean;
  hasProjectUrl: boolean;
}

/**
 * Recursively find ALL .env files containing "supabase"
 */
function findAllSupabaseEnvFiles(dir: string, maxDepth: number = 4, currentDepth: number = 0): EnvFileInfo[] {
  const results: EnvFileInfo[] = [];
  
  if (currentDepth > maxDepth) return results;
  
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    // First check files in current directory
    for (const entry of entries) {
      if (entry.isFile() && entry.name.startsWith('.env')) {
        const filePath = path.join(dir, entry.name);
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          // Simple case-insensitive search for "supabase"
          if (content.toLowerCase().includes('supabase')) {
            results.push({
              filePath,
              content,
              hasServiceRoleKey: extractServiceRoleKey(content) !== null,
              hasProjectUrl: extractUrl(content) !== null,
            });
          }
        } catch {
          // Skip files we can't read
        }
      }
    }
    
    // Then recurse into subdirectories
    for (const entry of entries) {
      if (entry.isDirectory() && !SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
        const subResults = findAllSupabaseEnvFiles(path.join(dir, entry.name), maxDepth, currentDepth + 1);
        results.push(...subResults);
      }
    }
  } catch {
    // Skip directories we can't read
  }
  
  return results;
}

/**
 * Find the best Supabase env file - prioritizes files with service role key
 */
function findBestSupabaseEnvFile(dir: string): { filePath: string; content: string; serviceRoleKey: string | null; projectUrl: string | null } | null {
  const allEnvFiles = findAllSupabaseEnvFiles(dir);
  
  if (allEnvFiles.length === 0) return null;
  
  // Sort: prioritize files with service role key, then files with project URL
  allEnvFiles.sort((a, b) => {
    // Service role key is most important
    if (a.hasServiceRoleKey && !b.hasServiceRoleKey) return -1;
    if (!a.hasServiceRoleKey && b.hasServiceRoleKey) return 1;
    // Then project URL
    if (a.hasProjectUrl && !b.hasProjectUrl) return -1;
    if (!a.hasProjectUrl && b.hasProjectUrl) return 1;
    return 0;
  });
  
  // If the best file has the service role key, use it
  const bestFile = allEnvFiles[0];
  
  // But we might need to combine info from multiple files
  // e.g., project URL from one file, service role key from another
  let projectUrl = extractUrl(bestFile.content);
  let serviceRoleKey = extractServiceRoleKey(bestFile.content);
  let sourceFile = bestFile.filePath;
  
  // If we don't have a service role key, search other files
  if (!serviceRoleKey) {
    for (const envFile of allEnvFiles) {
      const key = extractServiceRoleKey(envFile.content);
      if (key) {
        serviceRoleKey = key;
        // If we got the key from a different file, note it
        if (envFile.filePath !== sourceFile) {
          console.log(`[Supabase] Found service role key in: ${envFile.filePath}`);
        }
        break;
      }
    }
  }
  
  // If we don't have a project URL, search other files
  if (!projectUrl) {
    for (const envFile of allEnvFiles) {
      const url = extractUrl(envFile.content);
      if (url) {
        projectUrl = url;
        break;
      }
    }
  }
  
  return {
    filePath: sourceFile,
    content: bestFile.content,
    serviceRoleKey,
    projectUrl,
  };
}

/**
 * Detect Supabase configuration in a workspace folder
 */
export function detectSupabaseConfig(folderPath: string): SupabaseConfig {
  const result: SupabaseConfig = {
    detected: false,
    projectUrl: null,
    projectRef: null,
    sourceFile: null,
    serviceRoleKey: null,
  };

  // Search for .env files containing "supabase" and find the best one
  const found = findBestSupabaseEnvFile(folderPath);
  
  if (found) {
    result.detected = true;
    result.sourceFile = found.filePath;
    result.projectUrl = found.projectUrl;
    if (result.projectUrl) {
      result.projectRef = extractProjectRef(result.projectUrl);
    }
    result.serviceRoleKey = found.serviceRoleKey;
    return result;
  }

  // Also check for supabase CLI config directory
  const supabaseConfigPath = path.join(folderPath, 'supabase', 'config.toml');
  try {
    if (fs.existsSync(supabaseConfigPath)) {
      result.detected = true;
      result.sourceFile = supabaseConfigPath;
    }
  } catch {
    // Ignore
  }

  return result;
}

/**
 * Fetch users from Supabase using Admin API
 */
export async function fetchSupabaseUsers(projectUrl: string, serviceRoleKey: string): Promise<SupabaseUsersResult> {
  try {
    const response = await fetch(`${projectUrl}/auth/v1/admin/users`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        users: [],
        error: `API error: ${response.status} - ${errorText}`,
      };
    }

    const data = await response.json() as { users?: SupabaseUser[] };
    return {
      success: true,
      users: data.users || [],
    };
  } catch (error) {
    return {
      success: false,
      users: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Fetch storage buckets from Supabase
 */
export async function fetchSupabaseStorage(projectUrl: string, serviceRoleKey: string): Promise<SupabaseStorageResult> {
  try {
    const response = await fetch(`${projectUrl}/storage/v1/bucket`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        buckets: [],
        error: `API error: ${response.status} - ${errorText}`,
      };
    }

    const buckets = await response.json() as SupabaseBucket[];
    return {
      success: true,
      buckets: buckets || [],
    };
  } catch (error) {
    return {
      success: false,
      buckets: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
