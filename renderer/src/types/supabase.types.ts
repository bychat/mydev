/**
 * Supabase integration types
 */

export interface SupabaseConfig {
  /** Whether Supabase was detected in the project */
  detected: boolean;
  /** The Supabase project URL if found */
  projectUrl: string | null;
  /** The project reference ID extracted from URL */
  projectRef: string | null;
  /** Source file where config was found */
  sourceFile: string | null;
}
