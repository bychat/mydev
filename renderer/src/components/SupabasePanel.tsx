/**
 * SupabasePanel - Shows Supabase project info and admin features
 */
import { useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { SupabaseIcon, ChevronDownIcon, ChevronRightIcon } from './icons';

interface AccordionSectionProps {
  title: string;
  icon: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function AccordionSection({ title, icon, isOpen, onToggle, children }: AccordionSectionProps) {
  return (
    <div className="sb-accordion">
      <button className="sb-accordion-header" onClick={onToggle}>
        <span className="sb-accordion-icon">{icon}</span>
        <span className="sb-accordion-title">{title}</span>
        <span className="sb-accordion-chevron">
          {isOpen ? <ChevronDownIcon size={12} /> : <ChevronRightIcon size={12} />}
        </span>
      </button>
      {isOpen && <div className="sb-accordion-content">{children}</div>}
    </div>
  );
}

export default function SupabasePanel() {
  const { supabaseConfig, folderPath, openSupabaseTab } = useWorkspace();
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['project']));

  const toggleSection = (section: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  if (!supabaseConfig || !supabaseConfig.detected) {
    return (
      <div className="supabase-panel">
        <div className="supabase-panel-header">
          <SupabaseIcon size={20} />
          <h2>Supabase</h2>
        </div>
        <div className="supabase-panel-empty">
          <p>No Supabase configuration detected.</p>
          <p className="supabase-hint">
            Add "supabase" to any .env file in your project to connect.
          </p>
          <div className="supabase-actions" style={{ marginTop: '16px' }}>
            <button 
              className="supabase-action-btn"
              onClick={() => window.electronAPI.shellOpenExternal('https://supabase.com/docs')}
              title="Open Supabase Docs"
            >
              <span>📚</span> Documentation
            </button>
            <button 
              className="supabase-action-btn"
              onClick={() => window.electronAPI.shellOpenExternal('https://supabase.com/dashboard')}
              title="Open Supabase Dashboard"
            >
              <span>🔗</span> Supabase Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { projectUrl, projectRef, sourceFile } = supabaseConfig;
  const projectName = projectRef || 'Unknown Project';
  const dashboardUrl = projectRef 
    ? `https://supabase.com/dashboard/project/${projectRef}`
    : 'https://supabase.com/dashboard';

  const openDashboardSection = (section: string) => {
    if (projectRef) {
      window.electronAPI.shellOpenExternal(`https://supabase.com/dashboard/project/${projectRef}/${section}`);
    }
  };

  return (
    <div className="supabase-panel">
      <div className="supabase-panel-header">
        <SupabaseIcon size={20} />
        <h2>Supabase</h2>
      </div>
      
      <div className="supabase-panel-content">
        {/* Project Info Accordion */}
        <AccordionSection
          title="Project"
          icon="📦"
          isOpen={openSections.has('project')}
          onToggle={() => toggleSection('project')}
        >
          <div className="supabase-project-card">
            <div className="supabase-project-icon">
              <SupabaseIcon size={24} />
            </div>
            <div className="supabase-project-info">
              <span className="supabase-project-name">{projectName}</span>
              {projectUrl && (
                <span className="supabase-project-url">{projectUrl}</span>
              )}
            </div>
          </div>
          {sourceFile && (
            <div className="sb-detail-row">
              <span className="sb-detail-label">Config:</span>
              <code className="sb-detail-value">{sourceFile.replace(folderPath || '', '').replace(/^\//, '')}</code>
            </div>
          )}
          <button 
            className="supabase-action-btn"
            onClick={() => window.electronAPI.shellOpenExternal(dashboardUrl)}
          >
            <span>🔗</span> Open Dashboard
          </button>
        </AccordionSection>

        {/* Database Accordion */}
        <AccordionSection
          title="Database"
          icon="🗄️"
          isOpen={openSections.has('database')}
          onToggle={() => toggleSection('database')}
        >
          <div className="sb-action-list">
            <button className="sb-action-item" onClick={() => openDashboardSection('editor')}>
              <span className="sb-action-item-icon">📝</span>
              <div className="sb-action-item-content">
                <span className="sb-action-item-title">Table Editor</span>
                <span className="sb-action-item-desc">View and edit tables</span>
              </div>
            </button>
            <button className="sb-action-item" onClick={() => openDashboardSection('sql')}>
              <span className="sb-action-item-icon">💻</span>
              <div className="sb-action-item-content">
                <span className="sb-action-item-title">SQL Editor</span>
                <span className="sb-action-item-desc">Run SQL queries</span>
              </div>
            </button>
            <button className="sb-action-item" onClick={() => openDashboardSection('database/tables')}>
              <span className="sb-action-item-icon">📊</span>
              <div className="sb-action-item-content">
                <span className="sb-action-item-title">Database Settings</span>
                <span className="sb-action-item-desc">Schema, roles & extensions</span>
              </div>
            </button>
            <button className="sb-action-item" onClick={() => openDashboardSection('database/backups')}>
              <span className="sb-action-item-icon">💾</span>
              <div className="sb-action-item-content">
                <span className="sb-action-item-title">Backups</span>
                <span className="sb-action-item-desc">Database backups</span>
              </div>
            </button>
          </div>
        </AccordionSection>

        {/* Authentication Accordion */}
        <AccordionSection
          title="Authentication"
          icon="🔐"
          isOpen={openSections.has('auth')}
          onToggle={() => toggleSection('auth')}
        >
          <div className="sb-action-list">
            <button className="sb-action-item" onClick={() => openSupabaseTab('users')}>
              <span className="sb-action-item-icon">👥</span>
              <div className="sb-action-item-content">
                <span className="sb-action-item-title">Users</span>
                <span className="sb-action-item-desc">Manage users</span>
              </div>
            </button>
            <button className="sb-action-item" onClick={() => openDashboardSection('auth/policies')}>
              <span className="sb-action-item-icon">🛡️</span>
              <div className="sb-action-item-content">
                <span className="sb-action-item-title">Policies</span>
                <span className="sb-action-item-desc">Row Level Security</span>
              </div>
            </button>
            <button className="sb-action-item" onClick={() => openDashboardSection('auth/providers')}>
              <span className="sb-action-item-icon">🔑</span>
              <div className="sb-action-item-content">
                <span className="sb-action-item-title">Providers</span>
                <span className="sb-action-item-desc">OAuth & SSO settings</span>
              </div>
            </button>
            <button className="sb-action-item" onClick={() => openDashboardSection('auth/templates')}>
              <span className="sb-action-item-icon">📧</span>
              <div className="sb-action-item-content">
                <span className="sb-action-item-title">Email Templates</span>
                <span className="sb-action-item-desc">Auth emails</span>
              </div>
            </button>
          </div>
        </AccordionSection>

        {/* Storage Accordion */}
        <AccordionSection
          title="Storage"
          icon="📁"
          isOpen={openSections.has('storage')}
          onToggle={() => toggleSection('storage')}
        >
          <div className="sb-action-list">
            <button className="sb-action-item" onClick={() => openSupabaseTab('storage')}>
              <span className="sb-action-item-icon">🪣</span>
              <div className="sb-action-item-content">
                <span className="sb-action-item-title">Buckets</span>
                <span className="sb-action-item-desc">View storage buckets</span>
              </div>
            </button>
            <button className="sb-action-item" onClick={() => openDashboardSection('storage/policies')}>
              <span className="sb-action-item-icon">🔒</span>
              <div className="sb-action-item-content">
                <span className="sb-action-item-title">Policies</span>
                <span className="sb-action-item-desc">Storage access rules</span>
              </div>
            </button>
          </div>
        </AccordionSection>

        {/* Edge Functions Accordion */}
        <AccordionSection
          title="Edge Functions"
          icon="⚡"
          isOpen={openSections.has('functions')}
          onToggle={() => toggleSection('functions')}
        >
          <div className="sb-action-list">
            <button className="sb-action-item" onClick={() => openDashboardSection('functions')}>
              <span className="sb-action-item-icon">🚀</span>
              <div className="sb-action-item-content">
                <span className="sb-action-item-title">Functions</span>
                <span className="sb-action-item-desc">Deploy & manage functions</span>
              </div>
            </button>
            <button className="sb-action-item" onClick={() => openDashboardSection('logs/edge-logs')}>
              <span className="sb-action-item-icon">📋</span>
              <div className="sb-action-item-content">
                <span className="sb-action-item-title">Logs</span>
                <span className="sb-action-item-desc">Function execution logs</span>
              </div>
            </button>
          </div>
        </AccordionSection>

        {/* API & Settings Accordion */}
        <AccordionSection
          title="API & Settings"
          icon="⚙️"
          isOpen={openSections.has('settings')}
          onToggle={() => toggleSection('settings')}
        >
          <div className="sb-action-list">
            <button className="sb-action-item" onClick={() => openDashboardSection('settings/api')}>
              <span className="sb-action-item-icon">🔑</span>
              <div className="sb-action-item-content">
                <span className="sb-action-item-title">API Keys</span>
                <span className="sb-action-item-desc">Project API credentials</span>
              </div>
            </button>
            <button className="sb-action-item" onClick={() => openDashboardSection('api')}>
              <span className="sb-action-item-icon">📖</span>
              <div className="sb-action-item-content">
                <span className="sb-action-item-title">API Docs</span>
                <span className="sb-action-item-desc">Auto-generated API docs</span>
              </div>
            </button>
            <button className="sb-action-item" onClick={() => openDashboardSection('settings/general')}>
              <span className="sb-action-item-icon">⚙️</span>
              <div className="sb-action-item-content">
                <span className="sb-action-item-title">Project Settings</span>
                <span className="sb-action-item-desc">General configuration</span>
              </div>
            </button>
          </div>
        </AccordionSection>

        {/* Documentation Link */}
        <div className="sb-docs-link">
          <button 
            className="supabase-action-btn"
            onClick={() => window.electronAPI.shellOpenExternal('https://supabase.com/docs')}
          >
            <span>📚</span> Documentation
          </button>
        </div>
      </div>
    </div>
  );
}
