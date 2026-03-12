/**
 * WorkflowNode — Custom ReactFlow node for the visual workflow editor.
 */
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';

import { STATUS_COLORS, getPaletteForType } from './workflow.constants';
import type { WfNodeData } from './workflow.types';

export function WorkflowNode({ data, selected }: NodeProps<Node<WfNodeData>>) {
  const palette = getPaletteForType(data.nodeType);
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
