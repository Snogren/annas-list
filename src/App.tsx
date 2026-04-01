import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Toolbar } from './components/Toolbar/Toolbar';
import { Timeline } from './components/Timeline/Timeline';
import { Sidebar } from './components/Sidebar/Sidebar';
import { TemplatesPanel } from './components/TemplatesPanel/TemplatesPanel';
import { TaskModal } from './components/Modal/TaskModal';
import { TimeLogModal } from './components/Modal/TimeLogModal';
import { useAppStore } from './store/useAppStore';
import './App.css';

function PanelDragGhost() {
  const { panelDrag, recurringTasks } = useAppStore(
    useShallow((s) => ({ panelDrag: s.panelDrag, recurringTasks: s.recurringTasks }))
  );
  if (!panelDrag) return null;
  const template = recurringTasks[panelDrag.recurringTaskId];
  if (!template) return null;

  return (
    <div
      className="panelDragGhost"
      style={{
        left: panelDrag.x + 14,
        top: panelDrag.y - 14,
        '--ghost-color': template.color,
      } as React.CSSProperties}
    >
      <span className="panelDragGhostDot" />
      {template.title}
    </div>
  );
}

export default function App() {
  const closeModal = useAppStore((s) => s.closeModal);
  const ensureActiveLog = useAppStore((s) => s.ensureActiveLog);
  const [panelOpen, setPanelOpen] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => { ensureActiveLog(); }, [ensureActiveLog]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeModal]);

  return (
    <div className="app">
      <Toolbar
        panelOpen={panelOpen}
        onTogglePanel={() => setPanelOpen((v) => !v)}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
      />
      <div className="main">
        {panelOpen && <TemplatesPanel />}
        <Timeline />
        {sidebarOpen && <Sidebar />}
      </div>
      <TaskModal />
      <TimeLogModal />
      <PanelDragGhost />
    </div>
  );
}
