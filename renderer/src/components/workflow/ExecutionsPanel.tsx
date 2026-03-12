/**
 * ExecutionsPanel — Past runs list + step-by-step run detail view.
 */
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import HistoryIcon from '@mui/icons-material/History';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';

import { STATUS_COLORS } from './workflow.constants';
import type { RunLog } from './workflow.types';

interface Props {
  runs: RunLog[];
  activeRunId: string | null;
  onSelectRun: (id: string) => void;
}

export function ExecutionsPanel({ runs, activeRunId, onSelectRun }: Props) {
  const activeRun = runs.find(r => r.id === activeRunId);

  return (
    <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      {/* Runs list */}
      <Box sx={{ width: 260, borderRight: 1, borderColor: 'divider', overflow: 'auto' }}>
        <Box sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
          <HistoryIcon sx={{ fontSize: 18 }} />
          <Typography variant="subtitle2" fontWeight={700}>Past Runs</Typography>
        </Box>
        <Divider />
        {runs.length === 0 && (
          <Typography sx={{ p: 2, color: 'text.secondary', fontSize: 12 }}>
            No executions yet. Run the workflow to see results here.
          </Typography>
        )}
        <List dense>
          {runs.map((run, idx) => (
            <ListItemButton
              key={run.id}
              selected={run.id === activeRunId}
              onClick={() => onSelectRun(run.id)}
              sx={{
                opacity: run.status === 'completed' || run.status === 'failed' ? 0.7 : 1,
                ...(run.id === activeRunId && { opacity: 1 }),
              }}
            >
              <ListItemIcon sx={{ minWidth: 28 }}>
                <StatusIcon status={run.status} size={16} />
              </ListItemIcon>
              <ListItemText
                primary={`Run ${runs.length - idx}`}
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
          <RunDetail run={activeRun} runIndex={runs.indexOf(activeRun) + 1} />
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'text.secondary' }}>
            <Typography>Select a run to view execution details</Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}

// ─── Run Detail ──────────────────────────────────────────────────────────────

function RunDetail({ run, runIndex }: { run: RunLog; runIndex: number }) {
  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={700}>Run {runIndex}</Typography>
        <Chip
          label={run.status}
          size="small"
          sx={{ bgcolor: STATUS_COLORS[run.status] + '20', color: STATUS_COLORS[run.status] }}
        />
        {run.finishedAt && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {((new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000).toFixed(1)}s
          </Typography>
        )}
      </Box>
      <Divider sx={{ mb: 2 }} />

      <Stack spacing={1}>
        {run.steps.map((step, idx) => (
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
              <StatusIcon status={step.status} size={14} />
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
              <DataBlock label="INPUT" data={step.input} />
            )}
            {step.output != null && (
              <DataBlock label="OUTPUT" data={step.output} />
            )}
          </Paper>
        ))}
      </Stack>
    </>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StatusIcon({ status, size }: { status: string; size: number }) {
  if (status === 'completed') return <CheckCircleIcon sx={{ fontSize: size, color: '#22c55e' }} />;
  if (status === 'failed') return <ErrorIcon sx={{ fontSize: size, color: '#ef4444' }} />;
  if (status === 'running') return <HourglassEmptyIcon sx={{ fontSize: size, color: '#3b82f6' }} />;
  return null;
}

function DataBlock({ label, data }: { label: string; data: unknown }) {
  return (
    <Box sx={{ mt: 0.5 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>{label}</Typography>
      <Box sx={{ bgcolor: 'grey.50', borderRadius: 1, p: 0.5, mt: 0.25, maxHeight: 100, overflow: 'auto' }}>
        <Typography sx={{ fontSize: 10, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
          {typeof data === 'string' ? data : JSON.stringify(data, null, 2)}
        </Typography>
      </Box>
    </Box>
  );
}
