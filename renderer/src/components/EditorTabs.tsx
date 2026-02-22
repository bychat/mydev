import { useWorkspace } from '../context/WorkspaceContext';

export default function EditorTabs() {
  const { openTabs, activeTabPath, setActiveTabPath, closeTab } = useWorkspace();

  return (
    <div className="editor-tabs">
      {openTabs.map(tab => (
        <div
          key={tab.path}
          className={`tab${tab.path === activeTabPath ? ' active' : ''}`}
          onClick={() => setActiveTabPath(tab.path)}
        >
          <span>{tab.modified && '● '}{tab.name}</span>
          <span className="tab-close" onClick={e => { e.stopPropagation(); closeTab(tab.path); }}>×</span>
        </div>
      ))}
    </div>
  );
}
