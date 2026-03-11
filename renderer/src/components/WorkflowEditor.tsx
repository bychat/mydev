/**
 * WorkflowEditor — n8n-style visual workflow builder using ReactFlow.
 *
 * Features:
 *  • Drag-and-drop node palette (triggers, actions, LLM, decision, etc.)
 *  • Connector action picker when adding Action nodes
 *  • Decision node with if/switch routing rules
 *  • Execution log panel showing step-by-step run data
 *  • Past runs list (Run 1, Run 2, Run 3) with greyed-out history
 *  • Persist workflows to storage via IPC
 */
import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  BackgroundVariant,
  addEdge,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
  type NodeProps,
  type OnNodesChange,
  type OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Drawer from '@mui/material/Drawer';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';

import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';
import HistoryIcon from '@mui/icons-material/History';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import ScheduleIcon from '@mui/icons-material/Schedule';

import { useBackend } from '../context/BackendContext';

// ─── Types ──────────────────────────────────────────────────────────────────

interface WfNodeData {
  label: string;
  icon: string;
  nodeType: string;
  config: Record<string, unknown>;
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  subtitle?: string;
  [key: string]: unknown;
}

interface EditorWorkflow {
  id: string;
  name: string;
  description?: string;
  nodes: Node<WfNodeData>[];
  edges: Edge[];
  createdAt: string;
  updatedAt: string;
}

interface RunLog {
  id: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  finishedAt?: string;
  steps: Array<{
    nodeId: string;
    label: string;
    status: string;
    durationMs?: number;
    input?: unknown;
    output?: unknown;
    error?: string;
  }>;
}

// ─── Node Palette ───────────────────────────────────────────────────────────

const NODE_PALETTE = [
  { type: 'trigger', label: 'Trigger', icon: '⚡', color: '#f59e0b', description: 'Manual, Schedule, Webhook, Event' },
  { type: 'action', label: 'Action', icon: '🔧', color: '#3b82f6', description: 'Connector action (GitHub, Jira, etc.)' },
  { type: 'llm', label: 'AI Agent', icon: '🤖', color: '#8b5cf6', description: 'LLM call with prompt' },
  { type: 'decision', label: 'Switch / If', icon: '🔀', color: '#ef4444', description: 'Conditional branching' },
  { type: 'transform', label: 'Transform', icon: '🔄', color: '#06b6d4', description: 'Data transformation' },
  { type: 'human', label: 'Human Input', icon: '👤', color: '#10b981', description: 'Wait for user input' },
  { type: 'output', label: 'Output', icon: '📤', color: '#64748b', description: 'Send result' },
  { type: 'delay', label: 'Delay', icon: '⏱️', color: '#78716c', description: 'Wait/sleep' },
  { type: 'httpRequest', label: 'HTTP Request', icon: '🌐', color: '#2563eb', description: 'Make an HTTP request' },
  { type: 'splitOut', label: 'Split Out', icon: '⤴️', color: '#7c3aed', description: 'Split array into items' },
];

const STATUS_COLORS: Record<string, string> = {
  pending: '#94a3b8',
  running: '#3b82f6',
  completed: '#22c55e',
  failed: '#ef4444',
  skipped: '#a1a1aa',
};

// ─── Custom Node Component ──────────────────────────────────────────────────

function WorkflowNode({ data, selected }: NodeProps<Node<WfNodeData>>) {
  const palette = NODE_PALETTE.find(p => p.type === data.nodeType);
  const borderColor = data.status ? STATUS_COLORS[data.status] : (palette?.color || '#94a3b8');
  const isRunning = data.status === 'running';
  const isCompleted = data.status === 'completed';
  const isFailed = data.status === 'failed';

  return (
    <Paper
      elevation={selected ? 4 : 1}
      sx={{
        minWidth: 160,
        maxWidth: 220,
        border: 2,
        borderColor,
        borderRadius: 2,
        overflow: 'hidden',
        opacity: data.status === 'skipped' ? 0.5 : 1,
        transition: 'all 0.2s',
        ...(isRunning && {
          boxShadow: `0 0 12px ${borderColor}40`,
          animation: 'pulse 1.5s infinite',
        }),
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: borderColor, width: 10, height: 10 }} />

      {/* Header */}
      <Box sx={{ px: 1.5, py: 1, bgcolor: `${palette?.color || '#94a3b8'}15`, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography sx={{ fontSize: 18 }}>{data.icon || palette?.icon}</Typography>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" noWrap sx={{ fontWeight: 600, fontSize: 12 }}>{data.label}</Typography>
          {data.subtitle && (
            <Typography variant="caption" noWrap sx={{ color: 'text.secondary', fontSize: 10 }}>{data.subtitle}</Typography>
          )}
        </Box>
        {/* Status indicator */}
        {isCompleted && <CheckCircleIcon sx={{ fontSize: 16, color: '#22c55e' }} />}
        {isFailed && <ErrorIcon sx={{ fontSize: 16, color: '#ef4444' }} />}
        {isRunning && <HourglassEmptyIcon sx={{ fontSize: 16, color: '#3b82f6', animation: 'spin 1s infinite' }} />}
      </Box>

      {/* Output handles */}
      {data.nodeType === 'decision' ? (
        <>
          <Handle type="source" position={Position.Right} id="true" style={{ background: '#22c55e', top: '30%', width: 10, height: 10 }} />
          <Handle type="source" position={Position.Right} id="false" style={{ background: '#ef4444', top: '70%', width: 10, height: 10 }} />
          <Box sx={{ position: 'absolute', right: -50, top: '25%', fontSize: 10, color: '#22c55e' }}>Success</Box>
          <Box sx={{ position: 'absolute', right: -36, top: '65%', fontSize: 10, color: '#ef4444' }}>Error</Box>
        </>
      ) : (
        <Handle type="source" position={Position.Right} style={{ background: borderColor, width: 10, height: 10 }} />
      )}
    </Paper>
  );
}

const nodeTypes: NodeTypes = {
  workflowNode: WorkflowNode as any,
};

// ─── Add Node Button (shown on edges) ──────────────────────────────────────

let nodeIdCounter = 0;
const genNodeId = () => `wfn-${Date.now()}-${++nodeIdCounter}`;
const genEdgeId = () => `wfe-${Date.now()}-${++nodeIdCounter}`;
const genWorkflowId = () => `wf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// ─── Main Component ─────────────────────────────────────────────────────────

export default function WorkflowEditor() {
  const backend = useBackend();

  // State
  const [workflows, setWorkflows] = useState<EditorWorkflow[]>([]);
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<Node<WfNodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node<WfNodeData> | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'executions'>('editor');
  const [runs, setRuns] = useState<RunLog[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);

  const activeWorkflow = workflows.find(w => w.id === activeWorkflowId);

  // Load workflows on mount
  useEffect(() => {
    (async () => {
      try {
        const saved = await backend.orchestratorListEditorWorkflows() as EditorWorkflow[];
        setWorkflows(saved);
        if (saved.length > 0) {
          setActiveWorkflowId(saved[0].id);
          setNodes(saved[0].nodes);
          setEdges(saved[0].edges);
        }
      } catch { /* ignore */ }
    })();
  }, []);

  // Load runs
  useEffect(() => {
    (async () => {
      try {
        const saved = await backend.orchestratorListRuns() as RunLog[];
        setRuns(saved);
      } catch { /* ignore */ }
    })();
  }, []);

  // Subscribe to real-time events
  useEffect(() => {
    const unsub = backend.onOrchestratorEvent((event: any) => {
      if (event.category === 'step' || event.category === 'workflow') {
        // Update node status based on step events
        if (event.data?.stepId) {
          setNodes(prev => prev.map(n =>
            n.id === event.data.stepId
              ? { ...n, data: { ...n.data, status: event.data.status } }
              : n
          ));
        }
      }
    });
    return unsub;
  }, [backend]);

  // ── Node/Edge change handlers ──

  const onNodesChange: OnNodesChange<Node<WfNodeData>> = useCallback((changes) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  const onEdgesChange: OnEdgesChange = useCallback((changes) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  const onConnect = useCallback((connection: Connection) => {
    setEdges((eds) => addEdge({ ...connection, id: genEdgeId(), animated: true }, eds));
  }, []);

  const onNodeClick = useCallback((_: any, node: Node<WfNodeData>) => {
    setSelectedNode(node);
    setDrawerOpen(true);
  }, []);

  // ── Workflow CRUD ──

  const createWorkflow = useCallback(async () => {
    const id = genWorkflowId();
    const triggerNode: Node<WfNodeData> = {
      id: genNodeId(),
      type: 'workflowNode',
      position: { x: 100, y: 200 },
      data: {
        label: 'Manual Trigger',
        icon: '⚡',
        nodeType: 'trigger',
        config: { triggerType: 'manual' },
        subtitle: 'manual',
      },
    };

    const wf: EditorWorkflow = {
      id,
      name: `Workflow ${workflows.length + 1}`,
      nodes: [triggerNode],
      edges: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setWorkflows(prev => [...prev, wf]);
    setActiveWorkflowId(id);
    setNodes([triggerNode]);
    setEdges([]);
    await backend.orchestratorSaveEditorWorkflow(wf);
  }, [workflows, backend]);

  const saveWorkflow = useCallback(async () => {
    if (!activeWorkflowId) return;
    const wf: EditorWorkflow = {
      id: activeWorkflowId,
      name: activeWorkflow?.name || 'Untitled',
      description: activeWorkflow?.description,
      nodes,
      edges,
      createdAt: activeWorkflow?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setWorkflows(prev => prev.map(w => w.id === activeWorkflowId ? wf : w));
    await backend.orchestratorSaveEditorWorkflow(wf);
  }, [activeWorkflowId, activeWorkflow, nodes, edges, backend]);

  const deleteWorkflow = useCallback(async () => {
    if (!activeWorkflowId) return;
    setWorkflows(prev => prev.filter(w => w.id !== activeWorkflowId));
    await backend.orchestratorDeleteEditorWorkflow(activeWorkflowId);
    setActiveWorkflowId(workflows.length > 1 ? workflows.find(w => w.id !== activeWorkflowId)?.id || null : null);
    setNodes([]);
    setEdges([]);
  }, [activeWorkflowId, workflows, backend]);

  // ── Add Node ──

  const addNode = useCallback((paletteItem: typeof NODE_PALETTE[0]) => {
    const newNode: Node<WfNodeData> = {
      id: genNodeId(),
      type: 'workflowNode',
      position: { x: 300 + Math.random() * 200, y: 100 + Math.random() * 300 },
      data: {
        label: paletteItem.label,
        icon: paletteItem.icon,
        nodeType: paletteItem.type,
        config: {},
        subtitle: paletteItem.description,
      },
    };
    setNodes(prev => [...prev, newNode]);
    setPaletteOpen(false);
  }, []);

  const deleteNode = useCallback((nodeId: string) => {
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    setEdges(prev => prev.filter(e => e.source !== nodeId && e.target !== nodeId));
    setDrawerOpen(false);
    setSelectedNode(null);
  }, []);

  // ── Update node config ──

  const updateNodeData = useCallback((nodeId: string, updates: Partial<WfNodeData>) => {
    setNodes(prev => prev.map(n =>
      n.id === nodeId ? { ...n, data: { ...n.data, ...updates } } : n
    ));
    if (selectedNode?.id === nodeId) {
      setSelectedNode(prev => prev ? { ...prev, data: { ...prev.data, ...updates } } : null);
    }
  }, [selectedNode]);

  // ── Runs for current workflow ──
  const workflowRuns = useMemo(() =>
    runs.filter(r => r.workflowId === activeWorkflowId),
    [runs, activeWorkflowId]
  );

  const activeRun = runs.find(r => r.id === activeRunId);

  // ── Execute current workflow ──
  const executeWorkflow = useCallback(async () => {
    if (!activeWorkflowId || executing) return;
    setExecuting(true);

    // Set all nodes to 'pending' status first
    setNodes(prev => prev.map(n => ({
      ...n,
      data: { ...n.data, status: 'pending' as const },
    })));

    try {
      // Save first
      await saveWorkflow();

      const result = await backend.orchestratorExecuteWorkflow({
        id: activeWorkflowId,
        name: activeWorkflow?.name || 'Untitled',
        nodes,
        edges,
      });

      if (result.success && result.run) {
        const run = result.run as RunLog;
        setRuns(prev => [...prev, run]);
        setActiveRunId(run.id);

        // Mark all nodes as completed
        setNodes(prev => prev.map(n => ({
          ...n,
          data: { ...n.data, status: 'completed' as const },
        })));
      }
    } catch (err) {
      console.error('Workflow execution failed:', err);
      // Mark all nodes as failed
      setNodes(prev => prev.map(n => ({
        ...n,
        data: { ...n.data, status: n.data.status === 'completed' ? 'completed' : 'failed' as const },
      })));
    } finally {
      setExecuting(false);
    }
  }, [activeWorkflowId, activeWorkflow, nodes, edges, executing, saveWorkflow, backend]);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1, borderBottom: 1, borderColor: 'divider', bgcolor: 'grey.50' }}>
        {/* Workflow selector */}
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Workflow</InputLabel>
          <Select
            value={activeWorkflowId || ''}
            label="Workflow"
            onChange={(e) => {
              const wf = workflows.find(w => w.id === e.target.value);
              if (wf) {
                setActiveWorkflowId(wf.id);
                setNodes(wf.nodes);
                setEdges(wf.edges);
              }
            }}
          >
            {workflows.map(w => (
              <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <Tooltip title="New Workflow">
          <IconButton size="small" onClick={createWorkflow}><AddIcon /></IconButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem />

        {/* Tabs */}
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ minHeight: 36 }}>
          <Tab label="Editor" value="editor" sx={{ minHeight: 36, py: 0 }} />
          <Tab label="Executions" value="executions" sx={{ minHeight: 36, py: 0 }} />
        </Tabs>

        <Box sx={{ flex: 1 }} />

        {/* Actions */}
        <Button size="small" startIcon={<SaveIcon />} onClick={saveWorkflow} variant="outlined">
          Save
        </Button>
        <Button
          size="small"
          startIcon={executing ? <StopIcon /> : <PlayArrowIcon />}
          variant="contained"
          color="error"
          sx={{ borderRadius: 6 }}
          onClick={executeWorkflow}
          disabled={!activeWorkflowId || (executing && false)}
        >
          {executing ? 'Executing…' : 'Execute workflow'}
        </Button>
      </Box>

      {activeTab === 'editor' ? (
        <Box sx={{ flex: 1, display: 'flex', position: 'relative' }}>
          {/* ReactFlow Canvas */}
          <Box sx={{ flex: 1 }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              nodeTypes={nodeTypes}
              fitView
              defaultEdgeOptions={{ animated: true, style: { stroke: '#94a3b8', strokeWidth: 2 } }}
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e2e8f0" />
              <Controls />
              <MiniMap
                nodeColor={(node: any) => {
                  const palette = NODE_PALETTE.find(p => p.type === node.data?.nodeType);
                  return palette?.color || '#94a3b8';
                }}
                maskColor="rgba(0,0,0,0.08)"
              />
            </ReactFlow>
          </Box>

          {/* Add Node FAB */}
          <Tooltip title="Add node">
            <Button
              variant="contained"
              sx={{
                position: 'absolute',
                bottom: 24,
                left: '50%',
                transform: 'translateX(-50%)',
                borderRadius: 8,
                minWidth: 120,
                zIndex: 10,
              }}
              startIcon={<AddIcon />}
              onClick={() => setPaletteOpen(true)}
            >
              Add Step
            </Button>
          </Tooltip>

          {/* Node Palette Drawer */}
          <Drawer
            anchor="right"
            open={paletteOpen}
            onClose={() => setPaletteOpen(false)}
            PaperProps={{ sx: { width: 300, pt: 2 } }}
          >
            <Box sx={{ px: 2, pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="subtitle1" fontWeight={700}>Add Node</Typography>
              <IconButton size="small" onClick={() => setPaletteOpen(false)}><CloseIcon /></IconButton>
            </Box>
            <Divider />
            <List>
              {NODE_PALETTE.map(item => (
                <ListItemButton key={item.type} onClick={() => addNode(item)} sx={{ gap: 1.5 }}>
                  <Box
                    sx={{
                      width: 36, height: 36, borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      bgcolor: `${item.color}18`, border: 1, borderColor: `${item.color}40`,
                    }}
                  >
                    <Typography sx={{ fontSize: 18 }}>{item.icon}</Typography>
                  </Box>
                  <ListItemText
                    primary={item.label}
                    secondary={item.description}
                    primaryTypographyProps={{ fontSize: 13, fontWeight: 600 }}
                    secondaryTypographyProps={{ fontSize: 11 }}
                  />
                </ListItemButton>
              ))}
            </List>
          </Drawer>

          {/* Node Config Drawer */}
          <Drawer
            anchor="right"
            open={drawerOpen && !!selectedNode}
            onClose={() => setDrawerOpen(false)}
            PaperProps={{ sx: { width: 380, pt: 2 } }}
          >
            {selectedNode && (
              <Box sx={{ px: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Drawer Header */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography sx={{ fontSize: 24 }}>{selectedNode.data.icon}</Typography>
                    <Typography variant="subtitle1" fontWeight={700}>{selectedNode.data.label}</Typography>
                  </Box>
                  <IconButton size="small" onClick={() => setDrawerOpen(false)}><CloseIcon /></IconButton>
                </Box>

                <Tabs value={0} sx={{ minHeight: 32, mb: 2 }}>
                  <Tab label="Parameters" sx={{ minHeight: 32, py: 0, fontSize: 12 }} />
                  <Tab label="Settings" sx={{ minHeight: 32, py: 0, fontSize: 12 }} />
                </Tabs>

                <Divider sx={{ mb: 2 }} />

                {/* Node label */}
                <TextField
                  label="Name"
                  size="small"
                  fullWidth
                  value={selectedNode.data.label}
                  onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })}
                  sx={{ mb: 2 }}
                />

                {/* Type-specific config */}
                {selectedNode.data.nodeType === 'trigger' && (
                  <FormControl size="small" fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Trigger Type</InputLabel>
                    <Select
                      value={(selectedNode.data.config as any).triggerType || 'manual'}
                      label="Trigger Type"
                      onChange={(e) => updateNodeData(selectedNode.id, {
                        config: { ...selectedNode.data.config, triggerType: e.target.value },
                        subtitle: e.target.value,
                      })}
                    >
                      <MenuItem value="manual">Manual</MenuItem>
                      <MenuItem value="schedule">Schedule (Cron)</MenuItem>
                      <MenuItem value="webhook">Webhook</MenuItem>
                      <MenuItem value="event">Event</MenuItem>
                      <MenuItem value="on-chat">On Chat Message</MenuItem>
                      <MenuItem value="on-commit">On Git Commit</MenuItem>
                    </Select>
                  </FormControl>
                )}

                {selectedNode.data.nodeType === 'httpRequest' && (
                  <>
                    <FormControl size="small" fullWidth sx={{ mb: 2 }}>
                      <InputLabel>Method</InputLabel>
                      <Select
                        value={(selectedNode.data.config as any).method || 'GET'}
                        label="Method"
                        onChange={(e) => updateNodeData(selectedNode.id, {
                          config: { ...selectedNode.data.config, method: e.target.value },
                          subtitle: `${e.target.value}: ${(selectedNode.data.config as any).url || '...'}`,
                        })}
                      >
                        {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => (
                          <MenuItem key={m} value={m}>{m}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <TextField
                      label="URL"
                      size="small"
                      fullWidth
                      value={(selectedNode.data.config as any).url || ''}
                      onChange={(e) => updateNodeData(selectedNode.id, {
                        config: { ...selectedNode.data.config, url: e.target.value },
                        subtitle: `${(selectedNode.data.config as any).method || 'GET'}: ${e.target.value.slice(0, 40)}...`,
                      })}
                      sx={{ mb: 2 }}
                      placeholder="https://api.example.com/..."
                    />
                    <FormControl size="small" fullWidth sx={{ mb: 2 }}>
                      <InputLabel>Authentication</InputLabel>
                      <Select
                        value={(selectedNode.data.config as any).auth || 'none'}
                        label="Authentication"
                        onChange={(e) => updateNodeData(selectedNode.id, {
                          config: { ...selectedNode.data.config, auth: e.target.value },
                        })}
                      >
                        <MenuItem value="none">None</MenuItem>
                        <MenuItem value="predefinedCredentialType">Predefined Credential Type</MenuItem>
                        <MenuItem value="bearer">Bearer Token</MenuItem>
                        <MenuItem value="basic">Basic Auth</MenuItem>
                      </Select>
                    </FormControl>
                  </>
                )}

                {selectedNode.data.nodeType === 'llm' && (
                  <>
                    <TextField
                      label="System Message"
                      size="small"
                      fullWidth
                      multiline
                      rows={4}
                      value={(selectedNode.data.config as any).systemPrompt || ''}
                      onChange={(e) => updateNodeData(selectedNode.id, {
                        config: { ...selectedNode.data.config, systemPrompt: e.target.value },
                      })}
                      sx={{ mb: 2 }}
                    />
                    <TextField
                      label="Prompt (User Message)"
                      size="small"
                      fullWidth
                      multiline
                      rows={3}
                      value={(selectedNode.data.config as any).prompt || ''}
                      onChange={(e) => updateNodeData(selectedNode.id, {
                        config: { ...selectedNode.data.config, prompt: e.target.value },
                      })}
                      sx={{ mb: 2 }}
                      placeholder="{{ $json.prompt }}"
                    />
                    <TextField
                      label="Max Iterations"
                      size="small"
                      type="number"
                      fullWidth
                      value={(selectedNode.data.config as any).maxIterations || 10}
                      onChange={(e) => updateNodeData(selectedNode.id, {
                        config: { ...selectedNode.data.config, maxIterations: parseInt(e.target.value) },
                      })}
                      sx={{ mb: 2 }}
                    />
                  </>
                )}

                {selectedNode.data.nodeType === 'decision' && (
                  <>
                    <FormControl size="small" fullWidth sx={{ mb: 2 }}>
                      <InputLabel>Mode</InputLabel>
                      <Select
                        value={(selectedNode.data.config as any).mode || 'rules'}
                        label="Mode"
                        onChange={(e) => updateNodeData(selectedNode.id, {
                          config: { ...selectedNode.data.config, mode: e.target.value },
                          subtitle: `mode: ${e.target.value}`,
                        })}
                      >
                        <MenuItem value="rules">Rules</MenuItem>
                        <MenuItem value="expression">Expression</MenuItem>
                      </Select>
                    </FormControl>
                    <Typography variant="caption" sx={{ mb: 1, color: 'text.secondary' }}>Routing Rules</Typography>
                    <TextField
                      label="Condition Expression"
                      size="small"
                      fullWidth
                      multiline
                      rows={2}
                      value={(selectedNode.data.config as any).condition || ''}
                      onChange={(e) => updateNodeData(selectedNode.id, {
                        config: { ...selectedNode.data.config, condition: e.target.value },
                      })}
                      sx={{ mb: 2 }}
                      placeholder={'{{ $json.body.action }}'}
                    />
                    <Button variant="outlined" size="small" fullWidth sx={{ mb: 2 }}>
                      + Add Routing Rule
                    </Button>
                  </>
                )}

                {selectedNode.data.nodeType === 'action' && (
                  <>
                    <FormControl size="small" fullWidth sx={{ mb: 2 }}>
                      <InputLabel>Connector</InputLabel>
                      <Select
                        value={(selectedNode.data.config as any).connectorId || ''}
                        label="Connector"
                        onChange={(e) => updateNodeData(selectedNode.id, {
                          config: { ...selectedNode.data.config, connectorId: e.target.value },
                        })}
                      >
                        <MenuItem value="github">GitHub</MenuItem>
                        <MenuItem value="atlassian">Atlassian / Jira</MenuItem>
                        <MenuItem value="supabase">Supabase</MenuItem>
                      </Select>
                    </FormControl>
                    <FormControl size="small" fullWidth sx={{ mb: 2 }}>
                      <InputLabel>Action</InputLabel>
                      <Select
                        value={(selectedNode.data.config as any).actionId || ''}
                        label="Action"
                        onChange={(e) => updateNodeData(selectedNode.id, {
                          config: { ...selectedNode.data.config, actionId: e.target.value },
                          subtitle: `${(selectedNode.data.config as any).connectorId || ''}:${e.target.value}`,
                        })}
                      >
                        <MenuItem value="list-repos">List Repositories</MenuItem>
                        <MenuItem value="get-file">Get a file in GitHub</MenuItem>
                        <MenuItem value="create-file">Create a file in GitHub</MenuItem>
                        <MenuItem value="list-files">List files in GitHub</MenuItem>
                        <MenuItem value="list-issues">List Issues</MenuItem>
                        <MenuItem value="create-issue">Create Issue</MenuItem>
                        <MenuItem value="fetch-projects">Fetch Projects</MenuItem>
                        <MenuItem value="execute-query">Execute SQL Query</MenuItem>
                      </Select>
                    </FormControl>
                  </>
                )}

                <Box sx={{ flex: 1 }} />

                {/* Delete node */}
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  startIcon={<DeleteIcon />}
                  onClick={() => deleteNode(selectedNode.id)}
                  sx={{ mb: 2 }}
                >
                  Delete Node
                </Button>

                {/* Execute step button */}
                <Button
                  variant="contained"
                  color="error"
                  size="small"
                  startIcon={<PlayArrowIcon />}
                  sx={{ mb: 2, borderRadius: 6 }}
                  onClick={async () => {
                    if (!selectedNode) return;
                    updateNodeData(selectedNode.id, { status: 'running' });
                    try {
                      // Simulate single step execution
                      await new Promise(resolve => setTimeout(resolve, 500));
                      updateNodeData(selectedNode.id, { status: 'completed' });
                    } catch {
                      updateNodeData(selectedNode.id, { status: 'failed' });
                    }
                  }}
                >
                  Execute step
                </Button>
              </Box>
            )}
          </Drawer>
        </Box>
      ) : (
        /* Executions tab */
        <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Runs list */}
          <Box sx={{ width: 260, borderRight: 1, borderColor: 'divider', overflow: 'auto' }}>
            <Box sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
              <HistoryIcon sx={{ fontSize: 18 }} />
              <Typography variant="subtitle2" fontWeight={700}>Past Runs</Typography>
            </Box>
            <Divider />
            {workflowRuns.length === 0 && (
              <Typography sx={{ p: 2, color: 'text.secondary', fontSize: 12 }}>
                No executions yet. Run the workflow to see results here.
              </Typography>
            )}
            <List dense>
              {workflowRuns.map((run, idx) => (
                <ListItemButton
                  key={run.id}
                  selected={run.id === activeRunId}
                  onClick={() => setActiveRunId(run.id)}
                  sx={{
                    opacity: run.status === 'completed' || run.status === 'failed' ? 0.7 : 1,
                    ...(run.id === activeRunId && { opacity: 1 }),
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 28 }}>
                    {run.status === 'completed' && <CheckCircleIcon sx={{ fontSize: 16, color: '#22c55e' }} />}
                    {run.status === 'failed' && <ErrorIcon sx={{ fontSize: 16, color: '#ef4444' }} />}
                    {run.status === 'running' && <HourglassEmptyIcon sx={{ fontSize: 16, color: '#3b82f6' }} />}
                  </ListItemIcon>
                  <ListItemText
                    primary={`Run ${workflowRuns.length - idx}`}
                    secondary={new Date(run.startedAt).toLocaleString()}
                    primaryTypographyProps={{ fontSize: 12, fontWeight: 600 }}
                    secondaryTypographyProps={{ fontSize: 10 }}
                  />
                  <Chip
                    label={run.status}
                    size="small"
                    sx={{
                      fontSize: 10,
                      height: 20,
                      bgcolor: STATUS_COLORS[run.status] + '20',
                      color: STATUS_COLORS[run.status],
                    }}
                  />
                </ListItemButton>
              ))}
            </List>
          </Box>

          {/* Run detail */}
          <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
            {activeRun ? (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight={700}>
                    Run {workflowRuns.indexOf(activeRun) + 1}
                  </Typography>
                  <Chip
                    label={activeRun.status}
                    size="small"
                    sx={{ bgcolor: STATUS_COLORS[activeRun.status] + '20', color: STATUS_COLORS[activeRun.status] }}
                  />
                  {activeRun.finishedAt && (
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {((new Date(activeRun.finishedAt).getTime() - new Date(activeRun.startedAt).getTime()) / 1000).toFixed(1)}s
                    </Typography>
                  )}
                </Box>
                <Divider sx={{ mb: 2 }} />

                {/* Step-by-step log */}
                <Stack spacing={1}>
                  {activeRun.steps.map((step, idx) => (
                    <Paper
                      key={idx}
                      variant="outlined"
                      sx={{
                        p: 1.5,
                        borderLeft: 3,
                        borderColor: STATUS_COLORS[step.status] || '#94a3b8',
                        opacity: step.status === 'skipped' ? 0.5 : 1,
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        {step.status === 'completed' && <CheckCircleIcon sx={{ fontSize: 14, color: '#22c55e' }} />}
                        {step.status === 'failed' && <ErrorIcon sx={{ fontSize: 14, color: '#ef4444' }} />}
                        {step.status === 'running' && <HourglassEmptyIcon sx={{ fontSize: 14, color: '#3b82f6' }} />}
                        <Typography variant="subtitle2" sx={{ fontSize: 12, fontWeight: 600 }}>{step.label}</Typography>
                        {step.durationMs !== undefined && (
                          <Typography variant="caption" sx={{ color: 'text.secondary', ml: 'auto' }}>
                            {(step.durationMs / 1000).toFixed(2)}s
                          </Typography>
                        )}
                      </Box>
                      {step.error && (
                        <Typography variant="caption" sx={{ color: 'error.main', display: 'block' }}>{String(step.error)}</Typography>
                      )}
                      {step.input != null && (
                        <Box sx={{ mt: 0.5 }}>
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>INPUT</Typography>
                          <Box sx={{ bgcolor: 'grey.50', borderRadius: 1, p: 0.5, mt: 0.25, maxHeight: 100, overflow: 'auto' }}>
                            <Typography sx={{ fontSize: 10, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                              {typeof step.input === 'string' ? step.input : JSON.stringify(step.input, null, 2)}
                            </Typography>
                          </Box>
                        </Box>
                      )}
                      {step.output != null && (
                        <Box sx={{ mt: 0.5 }}>
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>OUTPUT</Typography>
                          <Box sx={{ bgcolor: 'grey.50', borderRadius: 1, p: 0.5, mt: 0.25, maxHeight: 100, overflow: 'auto' }}>
                            <Typography sx={{ fontSize: 10, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                              {typeof step.output === 'string' ? step.output : JSON.stringify(step.output, null, 2)}
                            </Typography>
                          </Box>
                        </Box>
                      )}
                    </Paper>
                  ))}
                </Stack>
              </>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'text.secondary' }}>
                <Typography>Select a run to view execution details</Typography>
              </Box>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}
