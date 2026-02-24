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
 * Recursively find .env files containing "supabase"
 */
function findSupabaseEnvFile(dir: string, maxDepth: number = 4, currentDepth: number = 0): { filePath: string; content: string } | null {
  if (currentDepth > maxDepth) return null;
  
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
            return { filePath, content };
          }
        } catch {
          // Skip files we can't read
        }
      }
    }
    
    // Then recurse into subdirectories
    for (const entry of entries) {
      if (entry.isDirectory() && !SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
        const result = findSupabaseEnvFile(path.join(dir, entry.name), maxDepth, currentDepth + 1);
        if (result) return result;
      }
    }
  } catch {
    // Skip directories we can't read
  }
  
  return null;
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
  };

  // Search for .env file containing "supabase"
  const found = findSupabaseEnvFile(folderPath);
  
  if (found) {
    result.detected = true;
    result.sourceFile = found.filePath;
    result.projectUrl = extractUrl(found.content);
    if (result.projectUrl) {
      result.projectRef = extractProjectRef(result.projectUrl);
    }
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
