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
  last_accessed_at: string;
  metadata: Record<string, unknown>;
}

export interface SupabaseStorageResult {
  success: boolean;
  buckets: SupabaseBucket[];
  error?: string;
}

export interface SupabaseStorageObjectsResult {
  success: boolean;
  objects: SupabaseStorageObject[];
  error?: string;
}

export interface SupabaseBucketOpResult {
  success: boolean;
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

/**
 * List objects in a storage bucket
 */
export async function listBucketObjects(
  projectUrl: string,
  serviceRoleKey: string,
  bucketId: string,
  prefix: string = '',
  limit: number = 100,
  offset: number = 0
): Promise<SupabaseStorageObjectsResult> {
  try {
    const response = await fetch(`${projectUrl}/storage/v1/object/list/${bucketId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prefix: prefix,
        limit: limit,
        offset: offset,
        sortBy: { column: 'name', order: 'asc' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        objects: [],
        error: `API error: ${response.status} - ${errorText}`,
      };
    }

    const objects = await response.json() as SupabaseStorageObject[];
    return {
      success: true,
      objects: objects || [],
    };
  } catch (error) {
    return {
      success: false,
      objects: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Create a new storage bucket
 */
export async function createBucket(
  projectUrl: string,
  serviceRoleKey: string,
  bucketName: string,
  isPublic: boolean = false
): Promise<SupabaseBucketOpResult> {
  try {
    const response = await fetch(`${projectUrl}/storage/v1/bucket`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: bucketName,
        id: bucketName,
        public: isPublic,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `API error: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorJson.error || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
      return { success: false, error: errorMessage };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Delete a storage bucket (must be empty)
 */
export async function deleteBucket(
  projectUrl: string,
  serviceRoleKey: string,
  bucketId: string
): Promise<SupabaseBucketOpResult> {
  try {
    // First empty the bucket
    await fetch(`${projectUrl}/storage/v1/bucket/${bucketId}/empty`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json',
      },
    });

    // Then delete the bucket
    const response = await fetch(`${projectUrl}/storage/v1/bucket/${bucketId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `API error: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorJson.error || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
      return { success: false, error: errorMessage };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Delete an object from a storage bucket
 */
export async function deleteStorageObject(
  projectUrl: string,
  serviceRoleKey: string,
  bucketId: string,
  objectPaths: string[]
): Promise<SupabaseBucketOpResult> {
  try {
    const response = await fetch(`${projectUrl}/storage/v1/object/${bucketId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prefixes: objectPaths }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `API error: ${response.status} - ${errorText}`,
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get public URL for a storage object
 */
export function getPublicUrl(projectUrl: string, bucketId: string, objectPath: string): string {
  return `${projectUrl}/storage/v1/object/public/${bucketId}/${objectPath}`;
}

/**
 * Table info interface
 */
export interface SupabaseTable {
  table_name: string;
  table_schema: string;
  table_type: string;
}

export interface SupabaseTablesResult {
  success: boolean;
  tables: SupabaseTable[];
  error?: string;
}

/**
 * Fetch tables from Supabase PostgreSQL database
 * Uses the pg_catalog to get table information
 */
export async function fetchSupabaseTables(projectUrl: string, serviceRoleKey: string): Promise<SupabaseTablesResult> {
  try {
    // Query the information_schema.tables via PostgREST
    // We need to use a raw SQL query via the /rest/v1/rpc endpoint or query a view
    // Since information_schema isn't directly exposed, we'll try a different approach
    
    // First, try to get tables from pg_catalog via a custom RPC (if exists)
    // If that fails, we'll query the PostgREST schema endpoint
    
    // Try the OpenAPI schema endpoint to get available tables
    const schemaResponse = await fetch(`${projectUrl}/rest/v1/`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Accept': 'application/openapi+json',
      },
    });

    if (schemaResponse.ok) {
      const schemaData = await schemaResponse.json() as { paths?: Record<string, unknown> };
      
      // Extract table names from OpenAPI paths
      const tables: SupabaseTable[] = [];
      if (schemaData.paths) {
        for (const path of Object.keys(schemaData.paths)) {
          // Paths look like "/tablename" 
          const tableName = path.replace(/^\//, '').split('?')[0];
          if (tableName && !tableName.includes('/') && tableName !== 'rpc') {
            tables.push({
              table_name: tableName,
              table_schema: 'public',
              table_type: 'BASE TABLE',
            });
          }
        }
      }
      
      // Sort alphabetically
      tables.sort((a, b) => a.table_name.localeCompare(b.table_name));
      
      return {
        success: true,
        tables,
      };
    }

    // Fallback: Try to get definitions from the schema
    const defResponse = await fetch(`${projectUrl}/rest/v1/`, {
      method: 'OPTIONS',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
      },
    });

    if (!defResponse.ok) {
      return {
        success: false,
        tables: [],
        error: `Could not fetch schema: ${defResponse.status}`,
      };
    }

    return {
      success: true,
      tables: [],
    };
  } catch (error) {
    return {
      success: false,
      tables: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * SQL Query result types
 */
export interface SqlQueryResult {
  success: boolean;
  data: Record<string, unknown>[];
  columns: string[];
  rowCount: number;
  error?: string;
  executionTime?: number;
}

/**
 * Execute a SQL query via Supabase PostgREST or pg_graphql
 * For read queries, we can use PostgREST. For raw SQL, we need pg_graphql or a custom RPC.
 */
export async function executeSupabaseQuery(
  projectUrl: string, 
  serviceRoleKey: string, 
  query: string
): Promise<SqlQueryResult> {
  const startTime = Date.now();
  
  try {
    // Clean the query
    const cleanQuery = query.trim().replace(/;$/, '').trim();
    
    // Check if it's a simple SELECT from a table
    const selectMatch = cleanQuery.match(/^SELECT\s+(.+?)\s+FROM\s+["']?(\w+)["']?(?:\s+(.*))?$/is);
    
    if (selectMatch) {
      const [, selectColumns, tableName, rest] = selectMatch;
      
      // Build PostgREST URL
      let url = `${projectUrl}/rest/v1/${tableName}`;
      const params = new URLSearchParams();
      
      // Handle column selection
      if (selectColumns.trim() !== '*') {
        const cols = selectColumns.split(',').map(c => c.trim()).join(',');
        params.set('select', cols);
      }
      
      // Handle WHERE clause (basic support)
      if (rest) {
        const whereMatch = rest.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+LIMIT|\s*$)/is);
        if (whereMatch) {
          const whereClause = whereMatch[1].trim();
          // Support multiple conditions with AND
          const conditions = whereClause.split(/\s+AND\s+/i);
          for (const cond of conditions) {
            const eqMatch = cond.trim().match(/(\w+)\s*=\s*['"]?([^'"]+)['"]?/);
            const neqMatch = cond.trim().match(/(\w+)\s*!=\s*['"]?([^'"]+)['"]?/);
            const gtMatch = cond.trim().match(/(\w+)\s*>\s*['"]?([^'"]+)['"]?/);
            const ltMatch = cond.trim().match(/(\w+)\s*<\s*['"]?([^'"]+)['"]?/);
            const likeMatch = cond.trim().match(/(\w+)\s+(?:I?LIKE)\s+'([^']+)'/i);
            const isNullMatch = cond.trim().match(/(\w+)\s+IS\s+NULL/i);
            const isNotNullMatch = cond.trim().match(/(\w+)\s+IS\s+NOT\s+NULL/i);
            
            if (isNotNullMatch) {
              params.set(isNotNullMatch[1], `not.is.null`);
            } else if (isNullMatch) {
              params.set(isNullMatch[1], `is.null`);
            } else if (likeMatch) {
              const pattern = likeMatch[2].replace(/%/g, '*');
              params.set(likeMatch[1], `ilike.${pattern}`);
            } else if (neqMatch) {
              params.set(neqMatch[1], `neq.${neqMatch[2]}`);
            } else if (gtMatch) {
              params.set(gtMatch[1], `gt.${gtMatch[2]}`);
            } else if (ltMatch) {
              params.set(ltMatch[1], `lt.${ltMatch[2]}`);
            } else if (eqMatch) {
              params.set(eqMatch[1], `eq.${eqMatch[2]}`);
            }
          }
        }
        
        // Handle LIMIT
        const limitMatch = rest.match(/LIMIT\s+(\d+)/i);
        if (limitMatch) {
          params.set('limit', limitMatch[1]);
        }
        
        // Handle ORDER BY
        const orderMatch = rest.match(/ORDER\s+BY\s+(\w+)(?:\s+(ASC|DESC))?/i);
        if (orderMatch) {
          const dir = orderMatch[2]?.toLowerCase() === 'desc' ? '.desc' : '.asc';
          params.set('order', `${orderMatch[1]}${dir}`);
        }
      }
      
      const queryString = params.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey,
          'Content-Type': 'application/json',
          'Prefer': 'count=exact',
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Query failed: ${response.status}`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorJson.error || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        return {
          success: false,
          data: [],
          columns: [],
          rowCount: 0,
          error: errorMessage,
          executionTime: Date.now() - startTime,
        };
      }
      
      const data = await response.json() as Record<string, unknown>[];
      const resultColumns = data.length > 0 ? Object.keys(data[0]) : [];
      
      return {
        success: true,
        data,
        columns: resultColumns,
        rowCount: data.length,
        executionTime: Date.now() - startTime,
      };
    }
    
    // Handle INSERT via PostgREST
    const insertMatch = cleanQuery.match(/^INSERT\s+INTO\s+["']?(\w+)["']?\s*\(([^)]+)\)\s*VALUES\s*\((.+)\)/is);
    if (insertMatch) {
      const [, tableName, columnsPart, valuesPart] = insertMatch;
      const columns = columnsPart.split(',').map(c => c.trim());
      const values = valuesPart.split(',').map(v => {
        const trimmed = v.trim();
        // Remove quotes from string values
        if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || 
            (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
          return trimmed.slice(1, -1);
        }
        if (trimmed.toLowerCase() === 'null') return null;
        if (trimmed.toLowerCase() === 'true') return true;
        if (trimmed.toLowerCase() === 'false') return false;
        const num = Number(trimmed);
        return isNaN(num) ? trimmed : num;
      });
      
      const body: Record<string, unknown> = {};
      columns.forEach((col, i) => { body[col] = values[i]; });
      
      const response = await fetch(`${projectUrl}/rest/v1/${tableName}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(body),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Insert failed: ${response.status}`;
        try { const errorJson = JSON.parse(errorText); errorMessage = errorJson.message || errorMessage; } catch { errorMessage = errorText || errorMessage; }
        return { success: false, data: [], columns: [], rowCount: 0, error: errorMessage, executionTime: Date.now() - startTime };
      }
      
      const data = await response.json() as Record<string, unknown>[];
      const resCols = Array.isArray(data) && data.length > 0 ? Object.keys(data[0]) : [];
      return { success: true, data: Array.isArray(data) ? data : [], columns: resCols, rowCount: Array.isArray(data) ? data.length : 0, executionTime: Date.now() - startTime };
    }
    
    // Handle DELETE via PostgREST
    const deleteMatch = cleanQuery.match(/^DELETE\s+FROM\s+["']?(\w+)["']?(?:\s+WHERE\s+(.+))?$/is);
    if (deleteMatch) {
      const [, tableName, whereClause] = deleteMatch;
      let url = `${projectUrl}/rest/v1/${tableName}`;
      
      if (whereClause) {
        const params = new URLSearchParams();
        const eqMatch = whereClause.trim().match(/(\w+)\s*=\s*['"]?([^'"]+)['"]?/);
        if (eqMatch) {
          params.set(eqMatch[1], `eq.${eqMatch[2]}`);
        }
        const queryString = params.toString();
        if (queryString) url += `?${queryString}`;
      }
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Delete failed: ${response.status}`;
        try { const errorJson = JSON.parse(errorText); errorMessage = errorJson.message || errorMessage; } catch { errorMessage = errorText || errorMessage; }
        return { success: false, data: [], columns: [], rowCount: 0, error: errorMessage, executionTime: Date.now() - startTime };
      }
      
      const data = await response.json() as Record<string, unknown>[];
      const resCols = Array.isArray(data) && data.length > 0 ? Object.keys(data[0]) : [];
      return { success: true, data: Array.isArray(data) ? data : [], columns: resCols, rowCount: Array.isArray(data) ? data.length : 0, executionTime: Date.now() - startTime };
    }
    
    // Handle UPDATE via PostgREST
    const updateMatch = cleanQuery.match(/^UPDATE\s+["']?(\w+)["']?\s+SET\s+(.+?)\s+WHERE\s+(.+)$/is);
    if (updateMatch) {
      const [, tableName, setPart, whereClause] = updateMatch;
      const params = new URLSearchParams();
      
      // Parse WHERE clause
      const eqMatch = whereClause.trim().match(/(\w+)\s*=\s*['"]?([^'"]+)['"]?/);
      if (eqMatch) {
        params.set(eqMatch[1], `eq.${eqMatch[2]}`);
      }
      
      // Parse SET clause
      const body: Record<string, unknown> = {};
      const setPairs = setPart.split(',');
      for (const pair of setPairs) {
        const setMatch = pair.trim().match(/(\w+)\s*=\s*(.+)/);
        if (setMatch) {
          let val: unknown = setMatch[2].trim();
          if (typeof val === 'string') {
            if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
              val = (val as string).slice(1, -1);
            } else if ((val as string).toLowerCase() === 'null') {
              val = null;
            } else if ((val as string).toLowerCase() === 'true') {
              val = true;
            } else if ((val as string).toLowerCase() === 'false') {
              val = false;
            } else {
              const num = Number(val);
              if (!isNaN(num)) val = num;
            }
          }
          body[setMatch[1]] = val;
        }
      }
      
      const queryString = params.toString();
      const url = `${projectUrl}/rest/v1/${tableName}${queryString ? `?${queryString}` : ''}`;
      
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(body),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Update failed: ${response.status}`;
        try { const errorJson = JSON.parse(errorText); errorMessage = errorJson.message || errorMessage; } catch { errorMessage = errorText || errorMessage; }
        return { success: false, data: [], columns: [], rowCount: 0, error: errorMessage, executionTime: Date.now() - startTime };
      }
      
      const data = await response.json() as Record<string, unknown>[];
      const resCols = Array.isArray(data) && data.length > 0 ? Object.keys(data[0]) : [];
      return { success: true, data: Array.isArray(data) ? data : [], columns: resCols, rowCount: Array.isArray(data) ? data.length : 0, executionTime: Date.now() - startTime };
    }
    
    // For complex queries, try RPC if available
    // First, let's try to call a generic SQL execution RPC (if user has set one up)
    const rpcResponse = await fetch(`${projectUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: cleanQuery }),
    });
    
    if (rpcResponse.ok) {
      const data = await rpcResponse.json() as Record<string, unknown>[];
      const rpcColumns = Array.isArray(data) && data.length > 0 ? Object.keys(data[0]) : [];
      
      return {
        success: true,
        data: Array.isArray(data) ? data : [],
        columns: rpcColumns,
        rowCount: Array.isArray(data) ? data.length : 0,
        executionTime: Date.now() - startTime,
      };
    }
    
    // If no exec_sql RPC, return helpful error
    return {
      success: false,
      data: [],
      columns: [],
      rowCount: 0,
      error: 'Complex queries require an exec_sql RPC function. Simple SELECT, INSERT, UPDATE, and DELETE queries are supported via PostgREST.',
      executionTime: Date.now() - startTime,
    };
    
  } catch (error) {
    return {
      success: false,
      data: [],
      columns: [],
      rowCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
      executionTime: Date.now() - startTime,
    };
  }
}
