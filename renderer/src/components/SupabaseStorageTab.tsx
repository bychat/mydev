/**
 * SupabaseStorageTab - Displays Supabase storage buckets and files in the editor area
 */
import { useState, useEffect } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import type { SupabaseBucket, SupabaseStorageObject } from '../types/supabase.types';
import { SupabaseIcon, ChevronDownIcon, ChevronRightIcon } from './icons';

// Format storage data as readable text for AI context
function formatStorageAsContext(buckets: SupabaseBucket[], objectsByBucket: Record<string, SupabaseStorageObject[]>): string {
  if (buckets.length === 0) return '# Supabase Storage\n\nNo buckets found.';
  
  let content = `# Supabase Storage\n\nTotal buckets: ${buckets.length}\n\n`;
  content += '| Name | ID | Public | Created | File Size Limit | Allowed MIME Types |\n';
  content += '|------|-------|--------|---------|-----------------|--------------------|\n';
  
  for (const bucket of buckets) {
    const created = bucket.created_at ? new Date(bucket.created_at).toLocaleDateString() : 'N/A';
    const sizeLimit = bucket.file_size_limit ? `${(bucket.file_size_limit / 1024 / 1024).toFixed(1)} MB` : 'No limit';
    const mimeTypes = bucket.allowed_mime_types?.join(', ') || 'All types';
    content += `| ${bucket.name} | ${bucket.id} | ${bucket.public ? 'Yes' : 'No'} | ${created} | ${sizeLimit} | ${mimeTypes} |\n`;
  }

  for (const [bucketId, objects] of Object.entries(objectsByBucket)) {
    if (objects.length > 0) {
      content += `\n## Bucket: ${bucketId}\n\n`;
      content += '| Name | Created | Updated |\n';
      content += '|------|---------|--------|\n';
      for (const obj of objects) {
        const created = obj.created_at ? new Date(obj.created_at).toLocaleDateString() : 'N/A';
        const updated = obj.updated_at ? new Date(obj.updated_at).toLocaleDateString() : 'N/A';
        content += `| ${obj.name} | ${created} | ${updated} |\n`;
      }
    }
  }
  
  return content;
}

export default function SupabaseStorageTab() {
  const { supabaseConfig, setTabData } = useWorkspace();
  const [buckets, setBuckets] = useState<SupabaseBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedBuckets, setExpandedBuckets] = useState<Set<string>>(new Set());
  const [bucketObjects, setBucketObjects] = useState<Record<string, SupabaseStorageObject[]>>({});
  const [loadingBuckets, setLoadingBuckets] = useState<Set<string>>(new Set());
  const [showCreateBucket, setShowCreateBucket] = useState(false);
  const [newBucketName, setNewBucketName] = useState('');
  const [newBucketPublic, setNewBucketPublic] = useState(false);
  const [creating, setCreating] = useState(false);
  const [opMessage, setOpMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const loadStorage = async () => {
    if (!supabaseConfig?.projectUrl || !supabaseConfig?.serviceRoleKey) {
      setError('Missing project URL or service role key. Add SUPABASE_SERVICE_ROLE_KEY to your .env file.');
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await window.electronAPI.supabaseGetStorage(
        supabaseConfig.projectUrl,
        supabaseConfig.serviceRoleKey
      );
      
      if (result.success) {
        setBuckets(result.buckets);
        setTabData('supabase:storage', formatStorageAsContext(result.buckets, bucketObjects));
      } else {
        setError(result.error || 'Failed to fetch storage buckets');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStorage();
  }, [supabaseConfig?.projectUrl, supabaseConfig?.serviceRoleKey]);

  const toggleBucket = async (bucketId: string) => {
    const next = new Set(expandedBuckets);
    if (next.has(bucketId)) {
      next.delete(bucketId);
      setExpandedBuckets(next);
      return;
    }
    
    next.add(bucketId);
    setExpandedBuckets(next);
    
    // Load objects if not already loaded
    if (!bucketObjects[bucketId]) {
      await loadBucketObjects(bucketId);
    }
  };

  const loadBucketObjects = async (bucketId: string) => {
    if (!supabaseConfig?.projectUrl || !supabaseConfig?.serviceRoleKey) return;
    
    setLoadingBuckets(prev => new Set(prev).add(bucketId));
    
    try {
      const result = await window.electronAPI.supabaseListObjects(
        supabaseConfig.projectUrl,
        supabaseConfig.serviceRoleKey,
        bucketId
      );
      
      if (result.success) {
        setBucketObjects(prev => {
          const updated = { ...prev, [bucketId]: result.objects };
          setTabData('supabase:storage', formatStorageAsContext(buckets, updated));
          return updated;
        });
      }
    } catch {
      // Silently handle - objects won't be shown
    } finally {
      setLoadingBuckets(prev => {
        const next = new Set(prev);
        next.delete(bucketId);
        return next;
      });
    }
  };

  const handleCreateBucket = async () => {
    if (!supabaseConfig?.projectUrl || !supabaseConfig?.serviceRoleKey || !newBucketName.trim()) return;
    
    setCreating(true);
    try {
      const result = await window.electronAPI.supabaseCreateBucket(
        supabaseConfig.projectUrl,
        supabaseConfig.serviceRoleKey,
        newBucketName.trim(),
        newBucketPublic
      );
      
      if (result.success) {
        setOpMessage({ text: `Bucket "${newBucketName}" created`, type: 'success' });
        setNewBucketName('');
        setNewBucketPublic(false);
        setShowCreateBucket(false);
        await loadStorage();
      } else {
        setOpMessage({ text: result.error || 'Failed to create bucket', type: 'error' });
      }
    } catch (err) {
      setOpMessage({ text: err instanceof Error ? err.message : 'Unknown error', type: 'error' });
    } finally {
      setCreating(false);
      setTimeout(() => setOpMessage(null), 4000);
    }
  };

  const handleDeleteBucket = async (bucketId: string, bucketName: string) => {
    if (!supabaseConfig?.projectUrl || !supabaseConfig?.serviceRoleKey) return;
    if (!confirm(`Delete bucket "${bucketName}"? This will delete all files in the bucket.`)) return;
    
    try {
      const result = await window.electronAPI.supabaseDeleteBucket(
        supabaseConfig.projectUrl,
        supabaseConfig.serviceRoleKey,
        bucketId
      );
      
      if (result.success) {
        setOpMessage({ text: `Bucket "${bucketName}" deleted`, type: 'success' });
        setExpandedBuckets(prev => {
          const next = new Set(prev);
          next.delete(bucketId);
          return next;
        });
        setBucketObjects(prev => {
          const next = { ...prev };
          delete next[bucketId];
          return next;
        });
        await loadStorage();
      } else {
        setOpMessage({ text: result.error || 'Failed to delete bucket', type: 'error' });
      }
    } catch (err) {
      setOpMessage({ text: err instanceof Error ? err.message : 'Unknown error', type: 'error' });
    } finally {
      setTimeout(() => setOpMessage(null), 4000);
    }
  };

  const handleDeleteObject = async (bucketId: string, objectName: string) => {
    if (!supabaseConfig?.projectUrl || !supabaseConfig?.serviceRoleKey) return;
    if (!confirm(`Delete "${objectName}" from bucket "${bucketId}"?`)) return;
    
    try {
      const result = await window.electronAPI.supabaseDeleteObject(
        supabaseConfig.projectUrl,
        supabaseConfig.serviceRoleKey,
        bucketId,
        [objectName]
      );
      
      if (result.success) {
        setOpMessage({ text: `"${objectName}" deleted`, type: 'success' });
        await loadBucketObjects(bucketId);
      } else {
        setOpMessage({ text: result.error || 'Failed to delete object', type: 'error' });
      }
    } catch (err) {
      setOpMessage({ text: err instanceof Error ? err.message : 'Unknown error', type: 'error' });
    } finally {
      setTimeout(() => setOpMessage(null), 4000);
    }
  };

  const handleCopyPublicUrl = async (bucketId: string, objectName: string) => {
    if (!supabaseConfig?.projectUrl) return;
    const url = await window.electronAPI.supabaseGetPublicUrl(
      supabaseConfig.projectUrl,
      bucketId,
      objectName
    );
    await navigator.clipboard.writeText(url);
    setOpMessage({ text: 'URL copied to clipboard', type: 'success' });
    setTimeout(() => setOpMessage(null), 3000);
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return 'No limit';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="sb-storage-tab">
      <div className="sb-storage-tab-header">
        <div className="sb-storage-tab-title">
          <SupabaseIcon size={20} />
          <h2>Storage</h2>
          <span className="sb-storage-count-badge">{buckets.length} buckets</span>
        </div>
        <div className="sb-storage-actions">
          <button
            className="sb-storage-create-btn"
            onClick={() => setShowCreateBucket(!showCreateBucket)}
            title="Create new bucket"
          >
            + New Bucket
          </button>
          <button 
            className="sb-refresh-btn" 
            onClick={loadStorage} 
            disabled={loading}
            title="Refresh storage"
          >
            🔄
          </button>
        </div>
      </div>

      {opMessage && (
        <div className={`sb-storage-op-msg ${opMessage.type}`}>
          {opMessage.type === 'success' ? '✓' : '⚠️'} {opMessage.text}
        </div>
      )}

      {showCreateBucket && (
        <div className="sb-storage-create-form">
          <input
            type="text"
            className="sb-storage-create-input"
            placeholder="Bucket name..."
            value={newBucketName}
            onChange={(e) => setNewBucketName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateBucket()}
            autoFocus
          />
          <label className="sb-storage-public-toggle">
            <input
              type="checkbox"
              checked={newBucketPublic}
              onChange={(e) => setNewBucketPublic(e.target.checked)}
            />
            <span>Public</span>
          </label>
          <div className="sb-storage-create-actions">
            <button
              className="sb-storage-confirm-btn"
              onClick={handleCreateBucket}
              disabled={!newBucketName.trim() || creating}
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
            <button
              className="sb-storage-cancel-btn"
              onClick={() => { setShowCreateBucket(false); setNewBucketName(''); }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="sb-storage-loading">
          <div className="sb-spinner"></div>
          <span>Loading storage buckets...</span>
        </div>
      )}

      {error && (
        <div className="sb-storage-error">
          <span className="sb-error-icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && buckets.length === 0 && (
        <div className="sb-storage-empty">
          <span>📁</span>
          <p>No storage buckets found</p>
          <p className="sb-storage-empty-hint">Create a bucket to start storing files</p>
        </div>
      )}

      {!loading && !error && buckets.length > 0 && (
        <div className="sb-storage-list">
          {buckets.map(bucket => (
            <div key={bucket.id} className="sb-storage-bucket">
              <div className="sb-storage-bucket-header" onClick={() => toggleBucket(bucket.id)}>
                <span className="sb-storage-bucket-chevron">
                  {expandedBuckets.has(bucket.id) ? <ChevronDownIcon size={12} /> : <ChevronRightIcon size={12} />}
                </span>
                <span className="sb-bucket-icon">🪣</span>
                <div className="sb-bucket-details">
                  <span className="sb-bucket-name">{bucket.name}</span>
                  <span className="sb-bucket-meta">
                    {bucket.public ? (
                      <span className="sb-status-badge sb-status-public">🌐 Public</span>
                    ) : (
                      <span className="sb-status-badge sb-status-private">🔒 Private</span>
                    )}
                    <span className="sb-bucket-size-limit">{formatSize(bucket.file_size_limit)}</span>
                  </span>
                </div>
                <div className="sb-bucket-actions">
                  <button
                    className="sb-bucket-action-btn"
                    onClick={(e) => { e.stopPropagation(); loadBucketObjects(bucket.id); }}
                    title="Refresh files"
                  >
                    🔄
                  </button>
                  <button
                    className="sb-bucket-action-btn sb-bucket-delete-btn"
                    onClick={(e) => { e.stopPropagation(); handleDeleteBucket(bucket.id, bucket.name); }}
                    title="Delete bucket"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              {expandedBuckets.has(bucket.id) && (
                <div className="sb-storage-bucket-content">
                  {loadingBuckets.has(bucket.id) ? (
                    <div className="sb-storage-objects-loading">
                      <div className="sb-spinner"></div>
                      <span>Loading files...</span>
                    </div>
                  ) : (bucketObjects[bucket.id]?.length || 0) === 0 ? (
                    <div className="sb-storage-objects-empty">
                      <span>Empty bucket</span>
                    </div>
                  ) : (
                    <div className="sb-storage-objects-list">
                      {bucketObjects[bucket.id]?.map((obj, idx) => (
                        <div key={obj.id || idx} className="sb-storage-object-row">
                          <span className="sb-storage-object-icon">
                            {obj.metadata && (obj.metadata as Record<string, unknown>).mimetype 
                              ? (String((obj.metadata as Record<string, unknown>).mimetype).startsWith('image/') ? '🖼️' : '📄')
                              : (obj.name?.endsWith('/') ? '📁' : '📄')
                            }
                          </span>
                          <span className="sb-storage-object-name">{obj.name}</span>
                          <span className="sb-storage-object-date">
                            {obj.created_at ? new Date(obj.created_at).toLocaleDateString() : ''}
                          </span>
                          <div className="sb-storage-object-actions">
                            {bucket.public && (
                              <button
                                className="sb-storage-obj-btn"
                                onClick={() => handleCopyPublicUrl(bucket.id, obj.name)}
                                title="Copy public URL"
                              >
                                🔗
                              </button>
                            )}
                            <button
                              className="sb-storage-obj-btn sb-storage-obj-delete"
                              onClick={() => handleDeleteObject(bucket.id, obj.name)}
                              title="Delete file"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
