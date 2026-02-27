/**
 * AgentsPanel - Visual canvas showing the agentic flow pipeline
 * Uses @xyflow/react (React Flow) to render agents and their connections
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

/* ─── Agent node type definitions ─── */
interface AgentNodeData {
  label: string;
  description: string;
  category: 'entry' | 'classification' | 'research' | 'planning' | 'execution' | 'verification' | 'output';
  icon: string;
  promptKey?: string;
  inputs?: string[];
  outputs?: string[];
  [key: string]: unknown;
}

/* ─── Custom Agent Node component ─── */
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
  entry: 'Entry Point',
  classification: 'Classification',
  research: 'Research',
  planning: 'Planning',
  execution: 'Execution',
  verification: 'Verification',
  output: 'Output',
};

function AgentNode({ data }: NodeProps<Node<AgentNodeData>>) {
  const [expanded, setExpanded] = useState(false);
  const colors = categoryColors[data.category] || categoryColors.output;

  return (
    <div
      className="agent-flow-node"
      style={{
        background: colors.bg,
        borderColor: colors.border,
        borderWidth: 2,
        borderStyle: 'solid',
        borderRadius: 12,
        padding: '12px 16px',
        minWidth: 200,
        maxWidth: 280,
        boxShadow: '0 2px 8px rgba(0,0,0,.08)',
        cursor: 'pointer',
        transition: 'box-shadow 0.2s',
      }}
      onClick={() => setExpanded(!expanded)}
    >
      <Handle type="target" position={Position.Top} style={{ background: colors.border, width: 8, height: 8 }} />

      {/* Category badge */}
      <div style={{
        display: 'inline-block',
        fontSize: '0.62rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: colors.accent,
        background: `${colors.accent}14`,
        padding: '2px 8px',
        borderRadius: 6,
        marginBottom: 6,
      }}>
        {categoryLabels[data.category] || data.category}
      </div>

      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: '1.2rem' }}>{data.icon}</span>
        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1a1a2e' }}>{data.label}</span>
      </div>

      {/* Description */}
      <div style={{ fontSize: '0.72rem', color: '#666', lineHeight: 1.45 }}>
        {data.description}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${colors.border}33` }}>
          {data.inputs && data.inputs.length > 0 && (
            <div style={{ fontSize: '0.68rem', color: '#888', marginBottom: 4 }}>
              <strong>Inputs:</strong> {data.inputs.join(', ')}
            </div>
          )}
          {data.outputs && data.outputs.length > 0 && (
            <div style={{ fontSize: '0.68rem', color: '#888', marginBottom: 4 }}>
              <strong>Outputs:</strong> {data.outputs.join(', ')}
            </div>
          )}
          {data.promptKey && (
            <div style={{
              fontSize: '0.65rem',
              color: colors.accent,
              fontFamily: "'SF Mono', 'Fira Code', monospace",
              background: `${colors.accent}0a`,
              padding: '3px 6px',
              borderRadius: 4,
              marginTop: 4,
            }}>
              prompt: {data.promptKey}
            </div>
          )}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} style={{ background: colors.border, width: 8, height: 8 }} />
    </div>
  );
}

/* ─── Flow data — defines the agent pipeline ─── */
const agentNodes: Node<AgentNodeData>[] = [
  {
    id: 'user-input',
    type: 'agentNode',
    position: { x: 300, y: 0 },
    data: {
      label: 'User Message',
      description: 'The user sends a message or coding request via the chat panel.',
      category: 'entry',
      icon: '💬',
      outputs: ['message text', 'attached files', 'chat mode'],
    },
  },
  {
    id: 'check-agent',
    type: 'agentNode',
    position: { x: 300, y: 140 },
    data: {
      label: 'Check Agent (Triage)',
      description: 'Classifies whether the request needs file changes or is just a question/explanation.',
      category: 'classification',
      icon: '🔍',
      promptKey: 'checkAgentPrompt',
      inputs: ['user message', 'recent chat history'],
      outputs: ['{ needsFileChanges: boolean }'],
    },
  },
  {
    id: 'research-agent',
    type: 'agentNode',
    position: { x: 80, y: 300 },
    data: {
      label: 'Research Agent',
      description: 'Picks 4-9 relevant files from the workspace tree to build context for the response.',
      category: 'research',
      icon: '📚',
      promptKey: 'researchAgentPrompt',
      inputs: ['user question', 'workspace file list'],
      outputs: ['relevant file paths (JSON array)'],
    },
  },
  {
    id: 'chat-response',
    type: 'agentNode',
    position: { x: 520, y: 300 },
    data: {
      label: 'Chat Response (Streaming)',
      description: 'When no file changes needed: streams a helpful response with workspace context.',
      category: 'output',
      icon: '💡',
      promptKey: 'systemPrompt',
      inputs: ['user message', 'researched file contents', 'system context'],
      outputs: ['streamed markdown response'],
    },
  },
  {
    id: 'action-planner',
    type: 'agentNode',
    position: { x: 80, y: 460 },
    data: {
      label: 'Action Planner',
      description: 'Determines which files need to be created, updated, or deleted. Produces an action plan (max 10 files).',
      category: 'planning',
      icon: '📋',
      promptKey: 'actionPlannerPrompt',
      inputs: ['user message', 'chat history', 'workspace files'],
      outputs: ['FileActionPlan[] (file, action, description)'],
    },
  },
  {
    id: 'file-reader',
    type: 'agentNode',
    position: { x: -120, y: 620 },
    data: {
      label: 'File Reader',
      description: 'Reads current content of each file targeted for update. Provides context to the code editor.',
      category: 'execution',
      icon: '📖',
      inputs: ['file paths from action plan'],
      outputs: ['file contents'],
    },
  },
  {
    id: 'code-editor',
    type: 'agentNode',
    position: { x: 160, y: 620 },
    data: {
      label: 'Code Editor Agent',
      description: 'Generates SEARCH/REPLACE blocks for updates, full content for creates, or delete markers. Runs per-file.',
      category: 'execution',
      icon: '✏️',
      promptKey: 'codeEditorPrompt',
      inputs: ['file content', 'action plan item', 'user request'],
      outputs: ['SEARCH/REPLACE blocks or new file content'],
    },
  },
  {
    id: 'file-writer',
    type: 'agentNode',
    position: { x: 160, y: 780 },
    data: {
      label: 'File Writer',
      description: 'Applies the SEARCH/REPLACE edits, creates new files, or deletes files on disk. Records diffs.',
      category: 'execution',
      icon: '💾',
      inputs: ['SEARCH/REPLACE blocks', 'file path', 'action type'],
      outputs: ['diff { before, after }', 'success/error status'],
    },
  },
  {
    id: 'verification',
    type: 'agentNode',
    position: { x: 160, y: 940 },
    data: {
      label: 'Verification Agent',
      description: 'Evaluates if all changes satisfy the original request. If not, lists missing changes for another pass.',
      category: 'verification',
      icon: '✅',
      promptKey: 'verificationPrompt',
      inputs: ['user request', 'changed files summary'],
      outputs: ['{ satisfied, reason, missingChanges[] }'],
    },
  },
  {
    id: 'commit-msg',
    type: 'agentNode',
    position: { x: 420, y: 940 },
    data: {
      label: 'Commit Message Generator',
      description: 'Generates a conventional commit message from the applied changes (optional, user-triggered).',
      category: 'output',
      icon: '📝',
      promptKey: 'commitMessagePrompt',
      inputs: ['file diffs', 'action descriptions'],
      outputs: ['commit message string'],
    },
  },
];

const agentEdges: Edge[] = [
  // User → Check Agent
  { id: 'e-user-check', source: 'user-input', target: 'check-agent', animated: true, style: { stroke: '#f59e0b', strokeWidth: 2 } },

  // Check Agent → Research (both paths start with research)
  { id: 'e-check-research', source: 'check-agent', target: 'research-agent', label: 'always', style: { stroke: '#22c55e', strokeWidth: 2 }, labelStyle: { fontSize: 10, fill: '#888' } },

  // Check Agent → Chat Response (needsFileChanges = false)
  { id: 'e-check-chat', source: 'check-agent', target: 'chat-response', label: 'no changes', style: { stroke: '#64748b', strokeWidth: 2 }, labelStyle: { fontSize: 10, fill: '#888' } },

  // Research → Action Planner (when file changes needed)
  { id: 'e-research-planner', source: 'research-agent', target: 'action-planner', label: 'needs changes', style: { stroke: '#a855f7', strokeWidth: 2 }, labelStyle: { fontSize: 10, fill: '#888' } },

  // Research → Chat Response (feeds context)
  { id: 'e-research-chat', source: 'research-agent', target: 'chat-response', label: 'context', style: { stroke: '#22c55e', strokeWidth: 1.5, strokeDasharray: '5,5' }, labelStyle: { fontSize: 10, fill: '#888' } },

  // Action Planner → File Reader
  { id: 'e-planner-reader', source: 'action-planner', target: 'file-reader', style: { stroke: '#ef4444', strokeWidth: 2 } },

  // File Reader → Code Editor
  { id: 'e-reader-editor', source: 'file-reader', target: 'code-editor', style: { stroke: '#ef4444', strokeWidth: 2 } },

  // Action Planner → Code Editor (plan)
  { id: 'e-planner-editor', source: 'action-planner', target: 'code-editor', label: 'plan', style: { stroke: '#a855f7', strokeWidth: 1.5, strokeDasharray: '5,5' }, labelStyle: { fontSize: 10, fill: '#888' } },

  // Code Editor → File Writer
  { id: 'e-editor-writer', source: 'code-editor', target: 'file-writer', animated: true, style: { stroke: '#ef4444', strokeWidth: 2 } },

  // File Writer → Verification
  { id: 'e-writer-verify', source: 'file-writer', target: 'verification', style: { stroke: '#14b8a6', strokeWidth: 2 } },

  // Verification → Action Planner (retry loop)
  { id: 'e-verify-retry', source: 'verification', target: 'action-planner', label: 'not satisfied → retry', style: { stroke: '#a855f7', strokeWidth: 1.5, strokeDasharray: '5,5' }, labelStyle: { fontSize: 10, fill: '#888' } },

  // Verification → Commit Message
  { id: 'e-verify-commit', source: 'verification', target: 'commit-msg', label: 'satisfied', style: { stroke: '#14b8a6', strokeWidth: 2 }, labelStyle: { fontSize: 10, fill: '#888' } },
];

/* ─── Node types map ─── */
const nodeTypes: NodeTypes = {
  agentNode: AgentNode,
};

/* ─── Main Panel ─── */
export default function AgentsPanel() {
  const [selectedNode, setSelectedNode] = useState<Node<AgentNodeData> | null>(null);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node<AgentNodeData>) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const selectedData = selectedNode?.data as AgentNodeData | undefined;
  const selectedColors = selectedData ? categoryColors[selectedData.category] || categoryColors.output : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', background: '#fafafa' }}>
      {/* Header bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        borderBottom: '1px solid #e8e8e8',
        background: '#fff',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '1.1rem' }}>🤖</span>
          <h2 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1a1a2e', margin: 0 }}>Agent Pipeline</h2>
          <span style={{ fontSize: '0.68rem', color: '#999', fontWeight: 500 }}>View Only</span>
        </div>
        {/* Legend */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {Object.entries(categoryLabels).map(([key, label]) => {
            const c = categoryColors[key];
            return (
              <span key={key} style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: '0.62rem',
                fontWeight: 600,
                color: c.accent,
                background: c.bg,
                border: `1px solid ${c.border}40`,
                padding: '2px 8px',
                borderRadius: 4,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.border, flexShrink: 0 }} />
                {label}
              </span>
            );
          })}
        </div>
      </div>

      {/* React Flow canvas */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <ReactFlow
          nodes={agentNodes}
          edges={agentEdges}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={true}
          proOptions={{ hideAttribution: true }}
          minZoom={0.3}
          maxZoom={1.5}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#ddd" />
          <Controls showInteractive={false} />
          <MiniMap
            nodeColor={(n) => {
              const d = n.data as AgentNodeData;
              return categoryColors[d.category]?.border || '#999';
            }}
            style={{ borderRadius: 8, border: '1px solid #e0e0e0' }}
          />
        </ReactFlow>
      </div>

      {/* Selected node detail panel */}
      {selectedData && selectedColors && (
        <div style={{
          flexShrink: 0,
          padding: '10px 12px',
          borderTop: `2px solid ${selectedColors.border}`,
          background: selectedColors.bg,
          maxHeight: 180,
          overflowY: 'auto',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: '1.1rem' }}>{selectedData.icon}</span>
            <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#1a1a2e' }}>{selectedData.label}</span>
            <span style={{
              fontSize: '0.58rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              color: selectedColors.accent,
              background: `${selectedColors.accent}14`,
              padding: '1px 6px',
              borderRadius: 4,
              letterSpacing: '0.05em',
            }}>
              {categoryLabels[selectedData.category]}
            </span>
          </div>
          <p style={{ fontSize: '0.72rem', color: '#555', lineHeight: 1.5, marginBottom: 6 }}>
            {selectedData.description}
          </p>
          {selectedData.inputs && (
            <div style={{ fontSize: '0.68rem', color: '#777', marginBottom: 3 }}>
              <strong>Inputs:</strong> {selectedData.inputs.join(' → ')}
            </div>
          )}
          {selectedData.outputs && (
            <div style={{ fontSize: '0.68rem', color: '#777', marginBottom: 3 }}>
              <strong>Outputs:</strong> {selectedData.outputs.join(' → ')}
            </div>
          )}
          {selectedData.promptKey && (
            <div style={{
              fontSize: '0.65rem',
              color: selectedColors.accent,
              fontFamily: "'SF Mono', 'Fira Code', monospace",
              background: `${selectedColors.accent}0a`,
              padding: '3px 8px',
              borderRadius: 4,
              marginTop: 4,
              display: 'inline-block',
            }}>
              Configurable prompt: <strong>{selectedData.promptKey}</strong>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
