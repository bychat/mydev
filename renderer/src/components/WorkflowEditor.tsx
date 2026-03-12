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
 *
 * Sub-components live in ./workflow/ — this file is orchestration only.
 */
import { useCallback, useMemo, useState, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  addEdge,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
  type OnNodesChange,
  type OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';

import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import SaveIcon from '@mui/icons-material/Save';

import { useBackend } from '../context/BackendContext';

import {
  WorkflowNode,
  NodeConfigDrawer,
  NodePaletteDrawer,
  ExecutionsPanel,
  getPaletteForType,
  type WfNodeData,
  type EditorWorkflow,
  type RunLog,
  type NodePaletteEntry,
} from './workflow';

// ─── ReactFlow node type registration ───────────────────────────────────────

const nodeTypes: NodeTypes = {
  workflowNode: WorkflowNode as any,
};

// ─── ID generators ──────────────────────────────────────────────────────────

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

  // ── Load workflows on mount ──
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

  // ── Load runs ──
  useEffect(() => {
    (async () => {
      try {
        const saved = await backend.orchestratorListRuns() as RunLog[];
        setRuns(saved);
      } catch { /* ignore */ }
    })();
  }, []);

  // ── Subscribe to real-time events ──
  useEffect(() => {
    const unsub = backend.onOrchestratorEvent((event: any) => {
      if (event.category === 'step' || event.category === 'workflow') {
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

  // ── Add / Delete / Update nodes ──

  const addNode = useCallback((paletteItem: NodePaletteEntry) => {
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

  // ── Execute current workflow ──
  const executeWorkflow = useCallback(async () => {
    if (!activeWorkflowId || executing) return;
    setExecuting(true);

    setNodes(prev => prev.map(n => ({
      ...n,
      data: { ...n.data, status: 'pending' as const },
    })));

    try {
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

        setNodes(prev => prev.map(n => ({
          ...n,
          data: { ...n.data, status: 'completed' as const },
        })));
      }
    } catch (err) {
      console.error('Workflow execution failed:', err);
      setNodes(prev => prev.map(n => ({
        ...n,
        data: { ...n.data, status: n.data.status === 'completed' ? 'completed' : 'failed' as const },
      })));
    } finally {
      setExecuting(false);
    }
  }, [activeWorkflowId, activeWorkflow, nodes, edges, executing, saveWorkflow, backend]);

  // ── Render ──

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1, borderBottom: 1, borderColor: 'divider', bgcolor: 'grey.50' }}>
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

        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ minHeight: 36 }}>
          <Tab label="Editor" value="editor" sx={{ minHeight: 36, py: 0 }} />
          <Tab label="Executions" value="executions" sx={{ minHeight: 36, py: 0 }} />
        </Tabs>

        <Box sx={{ flex: 1 }} />

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
                  const palette = getPaletteForType(node.data?.nodeType);
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
          <NodePaletteDrawer
            open={paletteOpen}
            onClose={() => setPaletteOpen(false)}
            onAddNode={addNode}
          />

          {/* Node Config Drawer */}
          <NodeConfigDrawer
            open={drawerOpen}
            node={selectedNode}
            onClose={() => setDrawerOpen(false)}
            onUpdateNodeData={updateNodeData}
            onDeleteNode={deleteNode}
          />
        </Box>
      ) : (
        <ExecutionsPanel
          runs={workflowRuns}
          activeRunId={activeRunId}
          onSelectRun={setActiveRunId}
        />
      )}
    </Box>
  );
}
