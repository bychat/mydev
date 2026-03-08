/**
 * AgentsPanel - Full agent builder with:
 *   - Agent list sidebar (create, rename, delete, duplicate)
 *   - Visual pipeline canvas (editable nodes, tools, prompts)
 *   - Execution trace viewer (real-time step-by-step visibility)
 */
import { useCallback, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeTypes,
  Handle,
  Position,
  type NodeProps,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type {
  AgentNode as AgentNodeType,
  AgentTool,
  PhaseCategory,
  AgentTrace,
  TraceStep,
  AgentEdge as AgentEdgeType,
} from '../types/agent.types';
import { ALL_AGENT_TOOLS } from '../types/agent.types';
import { useAgentExecution } from '../context/AgentExecutionContext';

/* ─── Constants ─── */
const categoryColors: Record<string, { bg: string; border: string; accent: string }> = {
  entry:          { bg: '#f0f7ff', border: '#3b82f6', accent: '#2563eb' },
  classification: { bg: '#fef9f0', border: '#f59e0b', accent: '#d97706' },
  research:       { bg: '#f0fdf4', border: '#22c55e', accent: '#16a34a' },
  planning:       { bg: '#fdf4ff', border: '#a855f7', accent: '#9333ea' },
  execution:      { bg: '#fff1f2', border: '#ef4444', accent: '#dc2626' },
  verification:   { bg: '#f0fdfa', border: '#14b8a6', accent: '#0d9488' },
  output:         { bg: '#f8fafc', border: '#64748b', accent: '#475569' },
};
const categoryLabels: Record<string, string> = {
  entry: 'Entry Point', classification: 'Classification', research: 'Research',
  planning: 'Planning', execution: 'Execution', verification: 'Verification', output: 'Output',
};

/* ─── Custom Flow Node ─── */
interface FlowNodeData extends Record<string, unknown> {
  label: string;
  description: string;
  category: PhaseCategory;
  icon: string;
  promptKey?: string;
  tools?: AgentTool[];
  enabled: boolean;
  onToggle?: (id: string) => void;
  onEditTools?: (id: string) => void;
  nodeId: string;
}

function AgentFlowNode({ data }: NodeProps<Node<FlowNodeData>>) {
  const colors = categoryColors[data.category] || categoryColors.output;
  const dimmed = !data.enabled;
  return (
    <div style={{
      background: dimmed ? '#f5f5f5' : colors.bg,
      borderColor: dimmed ? '#ccc' : colors.border,
      borderWidth: 2, borderStyle: 'solid', borderRadius: 12,
      padding: '10px 14px', minWidth: 190, maxWidth: 260,
      opacity: dimmed ? 0.55 : 1,
      boxShadow: '0 2px 8px rgba(0,0,0,.06)',
    }}>
      <Handle type="target" position={Position.Top} style={{ background: colors.border, width: 8, height: 8 }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{
          fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase',
          color: colors.accent, background: `${colors.accent}14`,
          padding: '1px 6px', borderRadius: 5,
        }}>{categoryLabels[data.category]}</span>
        {data.onToggle && (
          <button
            onClick={e => { e.stopPropagation(); data.onToggle!(data.nodeId); }}
            style={{
              fontSize: '0.6rem', padding: '1px 5px', borderRadius: 4,
              border: '1px solid #ccc', background: data.enabled ? '#e8fce8' : '#fce8e8',
              cursor: 'pointer', color: data.enabled ? '#16a34a' : '#dc2626',
            }}
          >{data.enabled ? 'ON' : 'OFF'}</button>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
        <span style={{ fontSize: '1.1rem' }}>{data.icon}</span>
        <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#1a1a2e' }}>{data.label}</span>
      </div>
      <div style={{ fontSize: '0.68rem', color: '#777', lineHeight: 1.4 }}>{data.description}</div>
      {data.tools && data.tools.length > 0 && (
        <div style={{ marginTop: 5, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {data.tools.filter(t => t.enabled).map(t => (
            <span key={t.id} style={{
              fontSize: '0.58rem', padding: '1px 5px', borderRadius: 4,
              background: '#e8e8ff', color: '#555', border: '1px solid #d0d0ff',
            }}>{t.icon} {t.label}</span>
          ))}
          {data.onEditTools && (
            <button
              onClick={e => { e.stopPropagation(); data.onEditTools!(data.nodeId); }}
              style={{
                fontSize: '0.58rem', padding: '1px 5px', borderRadius: 4,
                background: '#f0f0f0', color: '#888', border: '1px solid #ddd', cursor: 'pointer',
              }}
            >⚙ Tools</button>
          )}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: colors.border, width: 8, height: 8 }} />
    </div>
  );
}
const nodeTypes: NodeTypes = { agentNode: AgentFlowNode };

/* ─── Trace Step Row (list item — compact) ─── */
function TraceStepRow({ step, selected, onSelect }: { step: TraceStep; selected: boolean; onSelect: () => void }) {
  const colors = categoryColors[step.category] || categoryColors.output;
  const statusIcon = step.status === 'running' ? '⏳' : step.status === 'success' ? '✅' : step.status === 'error' ? '❌' : '⏭️';
  return (
    <div
      onClick={onSelect}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
        cursor: 'pointer', fontSize: '0.75rem',
        background: selected ? '#f0f5ff' : 'transparent',
        borderLeft: selected ? '3px solid #3b82f6' : '3px solid transparent',
        borderBottom: '1px solid #f0f0f0',
        transition: 'background 0.15s',
      }}
    >
      <span style={{ fontSize: '0.9rem' }}>{statusIcon}</span>
      <span style={{
        fontSize: '0.58rem', fontWeight: 700, color: colors.accent,
        background: `${colors.accent}12`, padding: '1px 5px', borderRadius: 4,
        textTransform: 'uppercase', flexShrink: 0,
      }}>{step.category}</span>
      <span style={{ fontWeight: 600, color: '#333', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{step.summary}</span>
      {step.durationMs != null && <span style={{ fontSize: '0.6rem', color: '#aaa', flexShrink: 0 }}>{step.durationMs}ms</span>}
    </div>
  );
}

/* ─── n8n-style Step Detail Panel (Input / Parameters / Output) ─── */
type DetailTab = 'parameters' | 'input' | 'output' | 'settings';

function StepDetailPanel({ step }: { step: TraceStep }) {
  const [tab, setTab] = useState<DetailTab>('parameters');
  const colors = categoryColors[step.category] || categoryColors.output;

  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    fontSize: '0.72rem', fontWeight: active ? 700 : 500,
    padding: '6px 14px', cursor: 'pointer', border: 'none',
    borderBottom: active ? `2px solid ${colors.accent}` : '2px solid transparent',
    background: 'transparent', color: active ? colors.accent : '#888',
    transition: 'all 0.15s',
  });

  const fieldLabelStyle: React.CSSProperties = {
    fontSize: '0.68rem', fontWeight: 600, color: '#888', textTransform: 'uppercase',
    letterSpacing: '0.03em', marginBottom: 4, display: 'block',
  };

  const fieldValueStyle: React.CSSProperties = {
    fontSize: '0.76rem', padding: '8px 12px', border: '1px solid #e5e7eb',
    borderRadius: 8, background: '#f9fafb', color: '#333',
    fontFamily: "'SF Mono', 'Menlo', monospace", lineHeight: 1.5,
    wordBreak: 'break-word',
  };

  const aiAutoFilledBadge = (label: string) => (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: '0.68rem', color: '#7c3aed', background: '#f5f3ff',
      border: '1px solid #ddd6fe', borderRadius: 6, padding: '3px 10px',
      marginBottom: 6,
    }}>
      <span style={{ fontSize: '0.8rem' }}>✨</span>
      Defined automatically by the <strong>model</strong>
      <button style={{
        border: 'none', background: 'none', cursor: 'pointer',
        color: '#a78bfa', fontSize: '0.72rem', padding: '0 2px',
      }}>×</button>
    </div>
  );

  const formatData = (data: unknown): string => {
    if (data == null) return '—';
    if (typeof data === 'string') return data;
    return JSON.stringify(data, null, 2);
  };

  const inputEntries: [string, unknown][] = step.input != null
    ? (typeof step.input === 'object' && !Array.isArray(step.input)
      ? Object.entries(step.input as Record<string, unknown>)
      : [['data', step.input]])
    : [];

  const outputEntries: [string, unknown][] = step.output != null
    ? (typeof step.output === 'object' && !Array.isArray(step.output)
      ? Object.entries(step.output as Record<string, unknown>)
      : [['result', step.output]])
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Step header */}
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid #e8e8e8', background: '#fff',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: '1.1rem' }}>
          {step.type === 'llm-call' ? '🧠' : step.type === 'file-read' ? '📖' : step.type === 'file-write' ? '💾' : step.type === 'file-search' ? '🔍' : step.type === 'text-search' ? '🔎' : step.type === 'integration-call' ? '🔌' : '⚡'}
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1a1a2e' }}>{step.nodeLabel}</div>
          <div style={{ fontSize: '0.68rem', color: '#999' }}>{step.summary}</div>
        </div>
        <div style={{
          fontSize: '0.6rem', fontWeight: 700, color: colors.accent,
          background: `${colors.accent}12`, padding: '2px 8px', borderRadius: 4,
          textTransform: 'uppercase',
        }}>{step.category}</div>
        {step.durationMs != null && (
          <div style={{ fontSize: '0.68rem', color: '#aaa' }}>{step.durationMs}ms</div>
        )}
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex', borderBottom: '1px solid #e8e8e8', background: '#fff',
        padding: '0 8px',
      }}>
        {(['parameters', 'input', 'output', 'settings'] as DetailTab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={tabBtnStyle(tab === t)}>
            {t === 'parameters' ? 'Parameters' : t === 'input' ? `Input${inputEntries.length ? ` (${inputEntries.length})` : ''}` : t === 'output' ? `Output${outputEntries.length ? ` (${outputEntries.length})` : ''}` : 'Settings'}
          </button>
        ))}
        {/* Execute step button (visual only — mirrors n8n) */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', padding: '0 4px' }}>
          <span style={{
            fontSize: '0.65rem', padding: '3px 10px', borderRadius: 4,
            background: step.status === 'success' ? '#dcfce7' : step.status === 'error' ? '#fee2e2' : step.status === 'running' ? '#fef9c3' : '#f3f4f6',
            color: step.status === 'success' ? '#16a34a' : step.status === 'error' ? '#dc2626' : step.status === 'running' ? '#ca8a04' : '#6b7280',
            fontWeight: 600,
          }}>
            {step.status === 'success' ? '✓ Success' : step.status === 'error' ? '✗ Error' : step.status === 'running' ? '● Running' : '⏭ Skipped'}
          </span>
        </div>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto', background: '#fafafa' }}>
        {/* ─── Parameters Tab ─── */}
        {tab === 'parameters' && (
          <div style={{ padding: 16 }}>
            {step.error && (
              <div style={{
                padding: '10px 14px', borderRadius: 8, marginBottom: 12,
                background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626',
                fontSize: '0.75rem',
              }}>
                <strong>⚠ Error:</strong> {step.error}
              </div>
            )}

            {/* Method / Type */}
            <div style={{ marginBottom: 14 }}>
              <span style={fieldLabelStyle}>Method</span>
              <div style={{
                ...fieldValueStyle, display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '6px 12px', fontSize: '0.76rem',
              }}>
                <span style={{
                  background: step.type === 'llm-call' ? '#dbeafe' : '#dcfce7',
                  color: step.type === 'llm-call' ? '#2563eb' : '#16a34a',
                  padding: '2px 8px', borderRadius: 4, fontWeight: 700, fontSize: '0.68rem',
                  fontFamily: "'SF Mono', monospace",
                }}>
                  {step.type === 'llm-call' ? 'LLM' : step.type === 'file-read' ? 'READ' : step.type === 'file-write' ? 'WRITE' : step.type === 'file-search' ? 'SEARCH' : step.type === 'text-search' ? 'GREP' : step.type === 'tool-call' ? 'TOOL' : 'API'}
                </span>
                <span>{step.nodeLabel}</span>
              </div>
            </div>

            {/* URL / Target — show as "auto filled by model" */}
            <div style={{ marginBottom: 14 }}>
              <span style={fieldLabelStyle}>Target</span>
              {aiAutoFilledBadge('target')}
              <div style={fieldValueStyle}>
                {step.type === 'llm-call' ? 'AI Model Endpoint' : step.type === 'file-read' || step.type === 'file-write' ? 'Workspace File System' : 'Tool Invocation'}
              </div>
            </div>

            {/* Chosen Files (if applicable) */}
            {step.chosenFiles && step.chosenFiles.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <span style={fieldLabelStyle}>Chosen Files ({step.chosenFiles.length})</span>
                <div style={{ ...fieldValueStyle, padding: 0, overflow: 'hidden' }}>
                  {step.chosenFiles.map((f, i) => (
                    <div key={i} style={{
                      padding: '6px 12px', fontSize: '0.72rem', color: '#333',
                      borderBottom: i < step.chosenFiles!.length - 1 ? '1px solid #e5e7eb' : 'none',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      <span style={{ color: '#3b82f6' }}>📄</span> {f}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stop Reason */}
            {step.stopReason && (
              <div style={{ marginBottom: 14 }}>
                <span style={fieldLabelStyle}>Stop Reason</span>
                <div style={fieldValueStyle}>{step.stopReason}</div>
              </div>
            )}

            {/* Tokens */}
            {step.tokens && (
              <div style={{ marginBottom: 14 }}>
                <span style={fieldLabelStyle}>Token Usage</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['prompt', 'completion', 'total'] as const).map(k => (
                    <div key={k} style={{
                      flex: 1, textAlign: 'center', padding: '8px', borderRadius: 8,
                      background: '#fff', border: '1px solid #e5e7eb',
                    }}>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: '#333' }}>{step.tokens![k]}</div>
                      <div style={{ fontSize: '0.6rem', color: '#999', textTransform: 'uppercase' }}>{k}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── Input Tab (n8n style — left panel "No input data" or data) ─── */}
        {tab === 'input' && (
          <div style={{ padding: 16 }}>
            {inputEntries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#bbb' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: 6 }}>→|</div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#999' }}>No input data</div>
                <div style={{ fontSize: '0.7rem', marginTop: 4, color: '#ccc' }}>
                  Execute previous nodes to view input data
                </div>
              </div>
            ) : (
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
                <div style={{
                  display: 'grid', gridTemplateColumns: 'minmax(100px, 0.3fr) 1fr',
                  fontSize: '0.68rem', fontWeight: 700, color: '#888',
                  textTransform: 'uppercase', padding: '8px 12px',
                  background: '#f9fafb', borderBottom: '1px solid #e5e7eb',
                }}>
                  <span>Field</span><span>Value</span>
                </div>
                {inputEntries.map(([key, val], i) => (
                  <div key={key} style={{
                    display: 'grid', gridTemplateColumns: 'minmax(100px, 0.3fr) 1fr',
                    padding: '8px 12px', fontSize: '0.74rem',
                    borderBottom: i < inputEntries.length - 1 ? '1px solid #f0f0f0' : 'none',
                    alignItems: 'start',
                  }}>
                    <span style={{ fontWeight: 600, color: '#555', fontFamily: "'SF Mono', monospace", fontSize: '0.7rem' }}>{key}</span>
                    <pre style={{
                      margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      fontSize: '0.7rem', color: '#333', fontFamily: "'SF Mono', monospace",
                      maxHeight: 200, overflow: 'auto',
                    }}>{typeof val === 'string' ? val : JSON.stringify(val, null, 2)}</pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── Output Tab ─── */}
        {tab === 'output' && (
          <div style={{ padding: 16 }}>
            {outputEntries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#bbb' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: 6 }}>|→</div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#999' }}>No output data</div>
                <div style={{ fontSize: '0.7rem', marginTop: 4, color: '#ccc' }}>
                  {step.status === 'running' ? 'Step is still running…' : 'Execute step to see output'}
                </div>
              </div>
            ) : (
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
                <div style={{
                  display: 'grid', gridTemplateColumns: 'minmax(100px, 0.3fr) 1fr',
                  fontSize: '0.68rem', fontWeight: 700, color: '#888',
                  textTransform: 'uppercase', padding: '8px 12px',
                  background: '#f9fafb', borderBottom: '1px solid #e5e7eb',
                }}>
                  <span>Field</span><span>Value</span>
                </div>
                {outputEntries.map(([key, val], i) => (
                  <div key={key} style={{
                    display: 'grid', gridTemplateColumns: 'minmax(100px, 0.3fr) 1fr',
                    padding: '8px 12px', fontSize: '0.74rem',
                    borderBottom: i < outputEntries.length - 1 ? '1px solid #f0f0f0' : 'none',
                    alignItems: 'start',
                  }}>
                    <span style={{ fontWeight: 600, color: '#555', fontFamily: "'SF Mono', monospace", fontSize: '0.7rem' }}>{key}</span>
                    <pre style={{
                      margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      fontSize: '0.7rem', color: '#333', fontFamily: "'SF Mono', monospace",
                      maxHeight: 200, overflow: 'auto',
                    }}>{typeof val === 'string' ? val : JSON.stringify(val, null, 2)}</pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── Settings Tab ─── */}
        {tab === 'settings' && (
          <div style={{ padding: 16 }}>
            <div style={{
              padding: '10px 14px', borderRadius: 8, marginBottom: 14,
              background: '#f0f5ff', border: '1px solid #bfdbfe', fontSize: '0.72rem', color: '#3b82f6',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span>→</span> Execution will continue even if the node fails
            </div>

            <div style={{ marginBottom: 14 }}>
              <span style={fieldLabelStyle}>Node ID</span>
              <div style={fieldValueStyle}>{step.nodeId}</div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <span style={fieldLabelStyle}>Type</span>
              <div style={fieldValueStyle}>{step.type}</div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <span style={fieldLabelStyle}>Category</span>
              <div style={{
                ...fieldValueStyle, display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: colors.border }} />
                {step.category}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <span style={fieldLabelStyle}>Timestamp</span>
              <div style={fieldValueStyle}>{new Date(step.timestamp).toLocaleString()}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Tools Editor Modal ─── */
function ToolsEditorModal({ nodeId, nodeLabel, tools, onSave, onClose }: {
  nodeId: string; nodeLabel: string; tools: AgentTool[];
  onSave: (nodeId: string, tools: AgentTool[]) => void; onClose: () => void;
}) {
  const [localTools, setLocalTools] = useState<AgentTool[]>(() =>
    ALL_AGENT_TOOLS.map(t => {
      const existing = tools.find(e => e.id === t.id);
      return existing ? { ...t, enabled: existing.enabled } : { ...t };
    })
  );
  const toggleTool = (toolId: string) => setLocalTools(prev => prev.map(t => t.id === toolId ? { ...t, enabled: !t.enabled } : t));
  const integrations = Array.from(new Set(ALL_AGENT_TOOLS.map(t => t.integration).filter(Boolean)));

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 20, minWidth: 400, maxWidth: 500, maxHeight: '70vh', overflow: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,.15)' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 12px', fontSize: '0.9rem' }}>⚙️ Tools for "{nodeLabel}"</h3>
        <p style={{ fontSize: '0.72rem', color: '#888', marginBottom: 12 }}>Toggle which integrations this node can use. Tools correspond to sidebar features.</p>
        {integrations.map(intg => (
          <div key={intg} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#999', textTransform: 'uppercase', marginBottom: 4 }}>{intg}</div>
            {localTools.filter(t => t.integration === intg).map(tool => (
              <label key={tool.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: '0.78rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={tool.enabled} onChange={() => toggleTool(tool.id)} />
                <span>{tool.icon}</span>
                <span>{tool.label}</span>
              </label>
            ))}
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #ddd', background: '#f8f8f8', cursor: 'pointer', fontSize: '0.78rem' }}>Cancel</button>
          <button onClick={() => { onSave(nodeId, localTools.filter(t => t.enabled)); onClose(); }} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#3b82f6', color: '#fff', cursor: 'pointer', fontSize: '0.78rem' }}>Save</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Node Editor Modal ─── */
function NodeEditorModal({ node, onSave, onDelete, onClose }: {
  node: AgentNodeType;
  onSave: (updated: AgentNodeType) => void;
  onDelete: (nodeId: string) => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState(node.label);
  const [description, setDescription] = useState(node.description);
  const [category, setCategory] = useState<PhaseCategory>(node.category);
  const [icon, setIcon] = useState(node.icon);
  const [promptKey, setPromptKey] = useState(node.promptKey ?? '');
  const [customPrompt, setCustomPrompt] = useState(node.customPrompt ?? '');

  const handleSave = () => {
    onSave({
      ...node,
      label, description, category, icon,
      promptKey: promptKey || undefined,
      customPrompt: customPrompt || undefined,
    });
    onClose();
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', fontSize: '0.78rem', padding: '6px 10px',
    border: '1px solid #ddd', borderRadius: 6, outline: 'none',
    boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: '0.7rem', fontWeight: 600, color: '#666', marginBottom: 3, display: 'block',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 20, minWidth: 420, maxWidth: 520, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,.15)' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 14px', fontSize: '0.9rem' }}>✏️ Edit Node</h3>

        <div style={{ marginBottom: 10 }}>
          <span style={labelStyle}>Icon & Label</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={icon} onChange={e => setIcon(e.target.value)} style={{ ...inputStyle, width: 50, textAlign: 'center' }} />
            <input value={label} onChange={e => setLabel(e.target.value)} style={inputStyle} />
          </div>
        </div>

        <div style={{ marginBottom: 10 }}>
          <span style={labelStyle}>Description</span>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
        </div>

        <div style={{ marginBottom: 10 }}>
          <span style={labelStyle}>Phase Category</span>
          <select value={category} onChange={e => setCategory(e.target.value as PhaseCategory)}
            style={{ ...inputStyle, cursor: 'pointer' }}>
            {Object.entries(categoryLabels).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 10 }}>
          <span style={labelStyle}>Prompt Key (optional)</span>
          <input value={promptKey} onChange={e => setPromptKey(e.target.value)}
            placeholder="e.g. researchAgentPrompt" style={inputStyle} />
        </div>

        <div style={{ marginBottom: 10 }}>
          <span style={labelStyle}>Custom Prompt Override (optional)</span>
          <textarea value={customPrompt} onChange={e => setCustomPrompt(e.target.value)}
            rows={4} placeholder="Leave empty to use the default prompt from prompt settings…"
            style={{ ...inputStyle, resize: 'vertical', fontFamily: "'SF Mono', monospace", fontSize: '0.7rem' }} />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 16 }}>
          <button onClick={() => { if (confirm(`Delete node "${node.label}"?`)) { onDelete(node.id); onClose(); } }}
            style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: '0.78rem' }}>🗑 Delete Node</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #ddd', background: '#f8f8f8', cursor: 'pointer', fontSize: '0.78rem' }}>Cancel</button>
            <button onClick={handleSave} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#3b82f6', color: '#fff', cursor: 'pointer', fontSize: '0.78rem' }}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Add Node Modal ─── */
function AddNodeModal({ onAdd, onClose, existingNodes }: {
  onAdd: (node: AgentNodeType) => void;
  onClose: () => void;
  existingNodes: AgentNodeType[];
}) {
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<PhaseCategory>('execution');
  const [icon, setIcon] = useState('⚡');
  const [hasTools, setHasTools] = useState(false);

  const handleAdd = () => {
    if (!label.trim()) return;
    // Position below the last node
    const maxY = existingNodes.reduce((max, n) => Math.max(max, n.position.y), 0);
    const newNode: AgentNodeType = {
      id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      label: label.trim(),
      description: description.trim() || `Custom ${label.trim()} node`,
      category,
      icon,
      enabled: true,
      position: { x: 200, y: maxY + 160 },
      tools: hasTools ? ALL_AGENT_TOOLS.map(t => ({ ...t, enabled: false })) : undefined,
    };
    onAdd(newNode);
    onClose();
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', fontSize: '0.78rem', padding: '6px 10px',
    border: '1px solid #ddd', borderRadius: 6, outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 20, minWidth: 400, maxWidth: 480, boxShadow: '0 8px 32px rgba(0,0,0,.15)' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 14px', fontSize: '0.9rem' }}>➕ Add New Node</h3>

        <div style={{ marginBottom: 10 }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#666', marginBottom: 3, display: 'block' }}>Icon & Label</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={icon} onChange={e => setIcon(e.target.value)} style={{ ...inputStyle, width: 50, textAlign: 'center' }} />
            <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Node name…" autoFocus style={inputStyle} />
          </div>
        </div>

        <div style={{ marginBottom: 10 }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#666', marginBottom: 3, display: 'block' }}>Description</span>
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            rows={2} placeholder="What does this node do?"
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
        </div>

        <div style={{ marginBottom: 10 }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#666', marginBottom: 3, display: 'block' }}>Phase Category</span>
          <select value={category} onChange={e => setCategory(e.target.value as PhaseCategory)}
            style={{ ...inputStyle, cursor: 'pointer' }}>
            {Object.entries(categoryLabels).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', cursor: 'pointer', marginBottom: 10 }}>
          <input type="checkbox" checked={hasTools} onChange={e => setHasTools(e.target.checked)} />
          Enable tool selection for this node
        </label>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #ddd', background: '#f8f8f8', cursor: 'pointer', fontSize: '0.78rem' }}>Cancel</button>
          <button onClick={handleAdd} disabled={!label.trim()} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#3b82f6', color: '#fff', cursor: 'pointer', fontSize: '0.78rem', opacity: label.trim() ? 1 : 0.5 }}>Add Node</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main AgentsPanel ─── */
type PanelView = 'canvas' | 'trace';

export default function AgentsPanel() {
  const {
    agents, activeAgent, activeAgentId, setActiveAgentId,
    createAgent, updateAgent, deleteAgent, renameAgent, duplicateAgent,
    traces,
  } = useAgentExecution();

  const [view, setView] = useState<PanelView>('canvas');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');
  const [toolsEditing, setToolsEditing] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [nodeEditing, setNodeEditing] = useState<string | null>(null);
  const [addingNode, setAddingNode] = useState(false);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);

  const isEditable = !activeAgent.isDefault;

  const toggleNode = useCallback((nodeId: string) => {
    if (!isEditable) return;
    updateAgent({ ...activeAgent, nodes: activeAgent.nodes.map((n: AgentNodeType) => n.id === nodeId ? { ...n, enabled: !n.enabled } : n) });
  }, [activeAgent, isEditable, updateAgent]);

  const handleEditTools = useCallback((nodeId: string) => {
    if (!isEditable) return;
    setToolsEditing(nodeId);
  }, [isEditable]);

  const handleSaveTools = useCallback((nodeId: string, enabledTools: AgentTool[]) => {
    updateAgent({
      ...activeAgent,
      nodes: activeAgent.nodes.map((n: AgentNodeType) => {
        if (n.id !== nodeId) return n;
        return { ...n, tools: ALL_AGENT_TOOLS.map(t => ({ ...t, enabled: enabledTools.some(e => e.id === t.id) })) };
      }),
    });
  }, [activeAgent, updateAgent]);

  const handleEditNode = useCallback((nodeId: string) => {
    if (!isEditable) return;
    setNodeEditing(nodeId);
  }, [isEditable]);

  const handleSaveNode = useCallback((updated: AgentNodeType) => {
    updateAgent({
      ...activeAgent,
      nodes: activeAgent.nodes.map((n: AgentNodeType) => n.id === updated.id ? updated : n),
    });
  }, [activeAgent, updateAgent]);

  const handleDeleteNode = useCallback((nodeId: string) => {
    updateAgent({
      ...activeAgent,
      nodes: activeAgent.nodes.filter((n: AgentNodeType) => n.id !== nodeId),
      edges: activeAgent.edges.filter((e: AgentEdgeType) => e.source !== nodeId && e.target !== nodeId),
    });
    if (selectedNode === nodeId) setSelectedNode(null);
  }, [activeAgent, updateAgent, selectedNode]);

  const handleAddNode = useCallback((node: AgentNodeType) => {
    updateAgent({
      ...activeAgent,
      nodes: [...activeAgent.nodes, node],
    });
    setSelectedNode(node.id);
  }, [activeAgent, updateAgent]);

  const flowNodes = useMemo((): Node<FlowNodeData>[] => activeAgent.nodes.map((n: AgentNodeType) => ({
    id: n.id, type: 'agentNode', position: n.position,
    data: {
      label: n.label, description: n.description, category: n.category,
      icon: n.icon, promptKey: n.promptKey, tools: n.tools,
      enabled: n.enabled, nodeId: n.id,
      onToggle: isEditable ? toggleNode : undefined,
      onEditTools: isEditable && n.tools ? handleEditTools : undefined,
    },
  })), [activeAgent, isEditable, toggleNode, handleEditTools]);

  const flowEdges = useMemo((): Edge[] => activeAgent.edges.map((e: AgentEdgeType) => ({
    id: e.id, source: e.source, target: e.target, label: e.label,
    animated: e.animated,
    style: {
      stroke: categoryColors[activeAgent.nodes.find((n: AgentNodeType) => n.id === e.source)?.category || 'output']?.border || '#999',
      strokeWidth: 2, ...(e.label ? { strokeDasharray: '5,5' } : {}),
    },
    labelStyle: { fontSize: 10, fill: '#888' },
  })), [activeAgent]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createAgent(newName.trim());
    setNewName('');
    setCreating(false);
  };

  const handleStartRename = (id: string, name: string) => { setEditingName(id); setEditNameValue(name); };
  const handleFinishRename = async () => {
    if (editingName && editNameValue.trim()) await renameAgent(editingName, editNameValue.trim());
    setEditingName(null);
  };

  const toolsEditNode = toolsEditing ? activeAgent.nodes.find((n: AgentNodeType) => n.id === toolsEditing) : null;
  const nodeEditNode = nodeEditing ? activeAgent.nodes.find((n: AgentNodeType) => n.id === nodeEditing) : null;

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', background: '#fafafa' }}>
      {/* ─── Agent List Sidebar ─── */}
      <div style={{ width: 220, flexShrink: 0, borderRight: '1px solid #e8e8e8', background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <h3 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700 }}>🤖 Agents</h3>
            <button onClick={() => setCreating(!creating)} style={{ fontSize: '0.85rem', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 4, color: '#3b82f6' }} title="Create new agent">+</button>
          </div>
          {creating && (
            <div style={{ display: 'flex', gap: 4 }}>
              <input
                autoFocus value={newName} onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                placeholder="Agent name…"
                style={{ flex: 1, fontSize: '0.75rem', padding: '4px 8px', border: '1px solid #ddd', borderRadius: 6, outline: 'none' }}
              />
              <button onClick={handleCreate} disabled={!newName.trim()} style={{ fontSize: '0.72rem', padding: '4px 8px', borderRadius: 6, border: 'none', background: '#3b82f6', color: '#fff', cursor: 'pointer', opacity: newName.trim() ? 1 : 0.5 }}>Create</button>
            </div>
          )}
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {agents.map(agent => (
            <div
              key={agent.id} onClick={() => setActiveAgentId(agent.id)}
              style={{
                padding: '8px 12px', cursor: 'pointer',
                background: agent.id === activeAgentId ? '#f0f5ff' : 'transparent',
                borderLeft: agent.id === activeAgentId ? '3px solid #3b82f6' : '3px solid transparent',
                fontSize: '0.78rem',
              }}
            >
              {editingName === agent.id ? (
                <input
                  autoFocus value={editNameValue} onChange={e => setEditNameValue(e.target.value)}
                  onBlur={handleFinishRename}
                  onKeyDown={e => { if (e.key === 'Enter') handleFinishRename(); if (e.key === 'Escape') setEditingName(null); }}
                  onClick={e => e.stopPropagation()}
                  style={{ width: '100%', fontSize: '0.75rem', padding: '2px 6px', border: '1px solid #3b82f6', borderRadius: 4, outline: 'none' }}
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: agent.id === activeAgentId ? 700 : 500 }}>
                    {agent.isDefault ? '⭐ ' : '📄 '}{agent.name}
                  </span>
                  {!agent.isDefault && agent.id === activeAgentId && (
                    <div style={{ display: 'flex', gap: 2 }}>
                      <button onClick={e => { e.stopPropagation(); handleStartRename(agent.id, agent.name); }} title="Rename" style={{ fontSize: '0.65rem', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>✏️</button>
                      <button onClick={e => { e.stopPropagation(); duplicateAgent(agent.id); }} title="Duplicate" style={{ fontSize: '0.65rem', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>📋</button>
                      <button onClick={e => { e.stopPropagation(); if (confirm(`Delete "${agent.name}"?`)) deleteAgent(agent.id); }} title="Delete" style={{ fontSize: '0.65rem', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>🗑️</button>
                    </div>
                  )}
                </div>
              )}
              {agent.id === activeAgentId && (
                <div style={{ fontSize: '0.65rem', color: '#999', marginTop: 2 }}>
                  {agent.nodes.filter((n: AgentNodeType) => n.enabled).length}/{agent.nodes.length} nodes active
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ─── Main Area ─── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderBottom: '1px solid #e8e8e8', background: '#fff', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '1.1rem' }}>{activeAgent.isDefault ? '⭐' : '📄'}</span>
            <h2 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1a1a2e', margin: 0 }}>{activeAgent.name}</h2>
            <span style={{
              fontSize: '0.65rem', fontWeight: 500, padding: '1px 6px', borderRadius: 4,
              ...(activeAgent.isDefault ? { color: '#999', background: '#f0f0f0' } : { color: '#3b82f6', background: '#f0f5ff' }),
            }}>{activeAgent.isDefault ? 'Read Only' : 'Editable'}</span>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {isEditable && view === 'canvas' && (
              <button onClick={() => setAddingNode(true)} style={{
                fontSize: '0.72rem', padding: '4px 10px', borderRadius: 6,
                border: '1px solid #22c55e', cursor: 'pointer',
                background: '#f0fdf4', color: '#16a34a',
              }}>➕ Add Node</button>
            )}
            {(['canvas', 'trace'] as PanelView[]).map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                fontSize: '0.72rem', padding: '4px 10px', borderRadius: 6,
                border: '1px solid #ddd', cursor: 'pointer',
                background: view === v ? '#3b82f6' : '#fff',
                color: view === v ? '#fff' : '#555',
              }}>{v === 'canvas' ? '🔧 Pipeline' : `📊 Traces${traces.length > 0 ? ` (${traces.length})` : ''}`}</button>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {Object.entries(categoryLabels).map(([key, label]) => {
              const c = categoryColors[key];
              return (
                <span key={key} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  fontSize: '0.58rem', fontWeight: 600, color: c.accent,
                  background: c.bg, border: `1px solid ${c.border}40`,
                  padding: '1px 6px', borderRadius: 4,
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: c.border }} />{label}
                </span>
              );
            })}
          </div>
        </div>

        {/* Canvas or Trace */}
        {view === 'canvas' ? (
          <div style={{ flex: 1, minHeight: 0 }}>
            <ReactFlow
              nodes={flowNodes} edges={flowEdges} nodeTypes={nodeTypes}
              fitView fitViewOptions={{ padding: 0.2 }}
              nodesDraggable={!activeAgent.isDefault} nodesConnectable={false} elementsSelectable
              proOptions={{ hideAttribution: true }} minZoom={0.3} maxZoom={1.5}
              onNodeClick={(_, node) => setSelectedNode(node.id)}
              onNodeDoubleClick={(_, node) => handleEditNode(node.id)}
              onPaneClick={() => setSelectedNode(null)}
            >
              <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#ddd" />
              <Controls showInteractive={false} />
              <MiniMap
                nodeColor={n => {
                  const d = n.data as FlowNodeData;
                  return categoryColors[d.category]?.border || '#999';
                }}
                style={{ borderRadius: 8, border: '1px solid #e0e0e0' }}
              />
            </ReactFlow>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {traces.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', marginBottom: 8 }}>📊</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>No traces yet</div>
                  <div style={{ fontSize: '0.72rem', marginTop: 4 }}>Run the agent from the Chat panel in Agent mode to see execution traces here.</div>
                </div>
              </div>
            ) : (
              <>
                {/* Left: Trace list + step list */}
                <div style={{ width: 300, flexShrink: 0, borderRight: '1px solid #e8e8e8', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fff' }}>
                  {/* Trace selector */}
                  <div style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0', background: '#f8f8f8' }}>
                    <select
                      value={selectedTraceId ?? traces[traces.length - 1]?.id ?? ''}
                      onChange={e => { setSelectedTraceId(e.target.value); setSelectedStepId(null); }}
                      style={{
                        width: '100%', fontSize: '0.72rem', padding: '5px 8px',
                        border: '1px solid #ddd', borderRadius: 6, outline: 'none',
                        background: '#fff', cursor: 'pointer',
                      }}
                    >
                      {traces.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.status === 'running' ? '⏳' : t.status === 'success' ? '✓' : '✗'} {t.agentName} — "{t.userRequest.slice(0, 50)}{t.userRequest.length > 50 ? '…' : ''}"
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Step list */}
                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    {(() => {
                      const currentTrace = traces.find(t => t.id === (selectedTraceId ?? traces[traces.length - 1]?.id));
                      if (!currentTrace) return null;
                      return currentTrace.steps.map(step => (
                        <TraceStepRow
                          key={step.id}
                          step={step}
                          selected={selectedStepId === step.id}
                          onSelect={() => setSelectedStepId(step.id)}
                        />
                      ));
                    })()}
                  </div>

                  {/* Trace summary footer */}
                  {(() => {
                    const currentTrace = traces.find(t => t.id === (selectedTraceId ?? traces[traces.length - 1]?.id));
                    if (!currentTrace) return null;
                    const successCount = currentTrace.steps.filter(s => s.status === 'success').length;
                    const errorCount = currentTrace.steps.filter(s => s.status === 'error').length;
                    return (
                      <div style={{
                        padding: '8px 12px', borderTop: '1px solid #f0f0f0', background: '#f8f8f8',
                        fontSize: '0.65rem', color: '#888', display: 'flex', gap: 10,
                      }}>
                        <span>{currentTrace.steps.length} steps</span>
                        <span style={{ color: '#16a34a' }}>✓ {successCount}</span>
                        {errorCount > 0 && <span style={{ color: '#dc2626' }}>✗ {errorCount}</span>}
                        {currentTrace.totalDurationMs != null && (
                          <span style={{ marginLeft: 'auto' }}>{(currentTrace.totalDurationMs / 1000).toFixed(1)}s total</span>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Right: Detail panel (n8n style) */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  {(() => {
                    const currentTrace = traces.find(t => t.id === (selectedTraceId ?? traces[traces.length - 1]?.id));
                    const step = currentTrace?.steps.find(s => s.id === selectedStepId);
                    if (!step) {
                      return (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb' }}>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🖱️</div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#999' }}>Select a step</div>
                            <div style={{ fontSize: '0.72rem', marginTop: 4 }}>Click on a step in the list to view its parameters, input, and output.</div>
                          </div>
                        </div>
                      );
                    }
                    return <StepDetailPanel step={step} />;
                  })()}
                </div>
              </>
            )}
          </div>
        )}

        {/* Selected node detail */}
        {view === 'canvas' && selectedNode && (() => {
          const node = activeAgent.nodes.find((n: AgentNodeType) => n.id === selectedNode);
          if (!node) return null;
          const c = categoryColors[node.category] || categoryColors.output;
          return (
            <div style={{ flexShrink: 0, padding: '10px 14px', borderTop: `2px solid ${c.border}`, background: c.bg, maxHeight: 180, overflowY: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: '1.1rem' }}>{node.icon}</span>
                <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>{node.label}</span>
                <span style={{ fontSize: '0.55rem', fontWeight: 700, textTransform: 'uppercase', color: c.accent, background: `${c.accent}14`, padding: '1px 5px', borderRadius: 4 }}>{categoryLabels[node.category]}</span>
                <span style={{ fontSize: '0.6rem', padding: '1px 6px', borderRadius: 4, background: node.enabled ? '#dcfce7' : '#fee2e2', color: node.enabled ? '#16a34a' : '#dc2626' }}>{node.enabled ? 'Enabled' : 'Disabled'}</span>
                {isEditable && (
                  <button onClick={() => handleEditNode(node.id)} style={{
                    fontSize: '0.65rem', padding: '2px 8px', borderRadius: 4,
                    border: '1px solid #ddd', background: '#fff', cursor: 'pointer', color: '#3b82f6', marginLeft: 'auto',
                  }}>✏️ Edit Node</button>
                )}
              </div>
              <p style={{ fontSize: '0.72rem', color: '#555', lineHeight: 1.5, marginBottom: 4 }}>{node.description}</p>
              {node.inputs && <div style={{ fontSize: '0.68rem', color: '#777', marginBottom: 3 }}><strong>Inputs:</strong> {node.inputs.join(' → ')}</div>}
              {node.outputs && <div style={{ fontSize: '0.68rem', color: '#777', marginBottom: 3 }}><strong>Outputs:</strong> {node.outputs.join(' → ')}</div>}
              {node.promptKey && (
                <div style={{ fontSize: '0.65rem', color: c.accent, fontFamily: "'SF Mono', monospace", background: `${c.accent}0a`, padding: '3px 8px', borderRadius: 4, marginTop: 4, display: 'inline-block' }}>
                  prompt: <strong>{node.promptKey}</strong>
                </div>
              )}
              {node.customPrompt && (
                <details style={{ marginTop: 6 }}>
                  <summary style={{ fontSize: '0.65rem', cursor: 'pointer', color: c.accent, fontWeight: 600 }}>Custom Prompt Override</summary>
                  <pre style={{ fontSize: '0.6rem', background: '#f0f0f0', padding: 6, borderRadius: 4, overflow: 'auto', maxHeight: 100, marginTop: 4 }}>{node.customPrompt}</pre>
                </details>
              )}
            </div>
          );
        })()}
      </div>

      {/* Tools Modal */}
      {toolsEditing && toolsEditNode && (
        <ToolsEditorModal nodeId={toolsEditNode.id} nodeLabel={toolsEditNode.label} tools={toolsEditNode.tools || []} onSave={handleSaveTools} onClose={() => setToolsEditing(null)} />
      )}

      {/* Node Editor Modal */}
      {nodeEditing && nodeEditNode && (
        <NodeEditorModal node={nodeEditNode} onSave={handleSaveNode} onDelete={handleDeleteNode} onClose={() => setNodeEditing(null)} />
      )}

      {/* Add Node Modal */}
      {addingNode && (
        <AddNodeModal existingNodes={activeAgent.nodes} onAdd={handleAddNode} onClose={() => setAddingNode(false)} />
      )}
    </div>
  );
}
