/**
 * NodeConfigDrawer — Right-side config panel for a selected workflow node.
 */
import { useState } from 'react';
import type { Node } from '@xyflow/react';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

import type { WfNodeData } from './workflow.types';

interface Props {
  open: boolean;
  node: Node<WfNodeData> | null;
  onClose: () => void;
  onUpdateNodeData: (nodeId: string, updates: Partial<WfNodeData>) => void;
  onDeleteNode: (nodeId: string) => void;
}

export function NodeConfigDrawer({ open, node, onClose, onUpdateNodeData, onDeleteNode }: Props) {
  if (!node) return null;

  const cfg = node.data.config as Record<string, unknown>;

  return (
    <Drawer
      anchor="right"
      open={open && !!node}
      onClose={onClose}
      PaperProps={{ sx: { width: 380, pt: 2 } }}
    >
      <Box sx={{ px: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: 24 }}>{node.data.icon}</Typography>
            <Typography variant="subtitle1" fontWeight={700}>{node.data.label}</Typography>
          </Box>
          <IconButton size="small" onClick={onClose}><CloseIcon /></IconButton>
        </Box>

        <Tabs value={0} sx={{ minHeight: 32, mb: 2 }}>
          <Tab label="Parameters" sx={{ minHeight: 32, py: 0, fontSize: 12 }} />
          <Tab label="Settings" sx={{ minHeight: 32, py: 0, fontSize: 12 }} />
        </Tabs>

        <Divider sx={{ mb: 2 }} />

        {/* Name */}
        <TextField
          label="Name"
          size="small"
          fullWidth
          value={node.data.label}
          onChange={(e) => onUpdateNodeData(node.id, { label: e.target.value })}
          sx={{ mb: 2 }}
        />

        {/* Type-specific config */}
        <TriggerConfig node={node} cfg={cfg} onUpdate={onUpdateNodeData} />
        <HttpRequestConfig node={node} cfg={cfg} onUpdate={onUpdateNodeData} />
        <LlmConfig node={node} cfg={cfg} onUpdate={onUpdateNodeData} />
        <DecisionConfig node={node} cfg={cfg} onUpdate={onUpdateNodeData} />
        <ActionConfig node={node} cfg={cfg} onUpdate={onUpdateNodeData} />

        <Box sx={{ flex: 1 }} />

        <Button
          variant="outlined"
          color="error"
          size="small"
          startIcon={<DeleteIcon />}
          onClick={() => onDeleteNode(node.id)}
          sx={{ mb: 2 }}
        >
          Delete Node
        </Button>

        <Button
          variant="contained"
          color="error"
          size="small"
          startIcon={<PlayArrowIcon />}
          sx={{ mb: 2, borderRadius: 6 }}
          onClick={async () => {
            onUpdateNodeData(node.id, { status: 'running' });
            try {
              await new Promise(resolve => setTimeout(resolve, 500));
              onUpdateNodeData(node.id, { status: 'completed' });
            } catch {
              onUpdateNodeData(node.id, { status: 'failed' });
            }
          }}
        >
          Execute step
        </Button>
      </Box>
    </Drawer>
  );
}

// ─── Type-specific config sub-components ─────────────────────────────────────

interface ConfigProps {
  node: Node<WfNodeData>;
  cfg: Record<string, unknown>;
  onUpdate: (nodeId: string, updates: Partial<WfNodeData>) => void;
}

function TriggerConfig({ node, cfg, onUpdate }: ConfigProps) {
  if (node.data.nodeType !== 'trigger') return null;
  return (
    <FormControl size="small" fullWidth sx={{ mb: 2 }}>
      <InputLabel>Trigger Type</InputLabel>
      <Select
        value={(cfg.triggerType as string) || 'manual'}
        label="Trigger Type"
        onChange={(e) => onUpdate(node.id, {
          config: { ...cfg, triggerType: e.target.value },
          subtitle: e.target.value as string,
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
  );
}

function HttpRequestConfig({ node, cfg, onUpdate }: ConfigProps) {
  if (node.data.nodeType !== 'httpRequest') return null;
  return (
    <>
      <FormControl size="small" fullWidth sx={{ mb: 2 }}>
        <InputLabel>Method</InputLabel>
        <Select
          value={(cfg.method as string) || 'GET'}
          label="Method"
          onChange={(e) => onUpdate(node.id, {
            config: { ...cfg, method: e.target.value },
            subtitle: `${e.target.value}: ${(cfg.url as string) || '...'}`,
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
        value={(cfg.url as string) || ''}
        onChange={(e) => onUpdate(node.id, {
          config: { ...cfg, url: e.target.value },
          subtitle: `${(cfg.method as string) || 'GET'}: ${e.target.value.slice(0, 40)}...`,
        })}
        sx={{ mb: 2 }}
        placeholder="https://api.example.com/..."
      />
      <FormControl size="small" fullWidth sx={{ mb: 2 }}>
        <InputLabel>Authentication</InputLabel>
        <Select
          value={(cfg.auth as string) || 'none'}
          label="Authentication"
          onChange={(e) => onUpdate(node.id, {
            config: { ...cfg, auth: e.target.value },
          })}
        >
          <MenuItem value="none">None</MenuItem>
          <MenuItem value="predefinedCredentialType">Predefined Credential Type</MenuItem>
          <MenuItem value="bearer">Bearer Token</MenuItem>
          <MenuItem value="basic">Basic Auth</MenuItem>
        </Select>
      </FormControl>
    </>
  );
}

function LlmConfig({ node, cfg, onUpdate }: ConfigProps) {
  if (node.data.nodeType !== 'llm') return null;
  return (
    <>
      <TextField
        label="System Message"
        size="small"
        fullWidth
        multiline
        rows={4}
        value={(cfg.systemPrompt as string) || ''}
        onChange={(e) => onUpdate(node.id, {
          config: { ...cfg, systemPrompt: e.target.value },
        })}
        sx={{ mb: 2 }}
      />
      <TextField
        label="Prompt (User Message)"
        size="small"
        fullWidth
        multiline
        rows={3}
        value={(cfg.prompt as string) || ''}
        onChange={(e) => onUpdate(node.id, {
          config: { ...cfg, prompt: e.target.value },
        })}
        sx={{ mb: 2 }}
        placeholder="{{ $json.prompt }}"
      />
      <TextField
        label="Max Iterations"
        size="small"
        type="number"
        fullWidth
        value={(cfg.maxIterations as number) || 10}
        onChange={(e) => onUpdate(node.id, {
          config: { ...cfg, maxIterations: parseInt(e.target.value) },
        })}
        sx={{ mb: 2 }}
      />
    </>
  );
}

function DecisionConfig({ node, cfg, onUpdate }: ConfigProps) {
  if (node.data.nodeType !== 'decision') return null;
  return (
    <>
      <FormControl size="small" fullWidth sx={{ mb: 2 }}>
        <InputLabel>Mode</InputLabel>
        <Select
          value={(cfg.mode as string) || 'rules'}
          label="Mode"
          onChange={(e) => onUpdate(node.id, {
            config: { ...cfg, mode: e.target.value },
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
        value={(cfg.condition as string) || ''}
        onChange={(e) => onUpdate(node.id, {
          config: { ...cfg, condition: e.target.value },
        })}
        sx={{ mb: 2 }}
        placeholder={'{{ $json.body.action }}'}
      />
      <Button variant="outlined" size="small" fullWidth sx={{ mb: 2 }}>
        + Add Routing Rule
      </Button>
    </>
  );
}

function ActionConfig({ node, cfg, onUpdate }: ConfigProps) {
  if (node.data.nodeType !== 'action') return null;
  return (
    <>
      <FormControl size="small" fullWidth sx={{ mb: 2 }}>
        <InputLabel>Connector</InputLabel>
        <Select
          value={(cfg.connectorId as string) || ''}
          label="Connector"
          onChange={(e) => onUpdate(node.id, {
            config: { ...cfg, connectorId: e.target.value },
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
          value={(cfg.actionId as string) || ''}
          label="Action"
          onChange={(e) => onUpdate(node.id, {
            config: { ...cfg, actionId: e.target.value },
            subtitle: `${(cfg.connectorId as string) || ''}:${e.target.value}`,
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
  );
}
