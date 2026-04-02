import { useEffect, useState, useRef, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Toolbar } from './components/Toolbar/Toolbar';
import { Timeline } from './components/Timeline/Timeline';
import { Sidebar } from './components/Sidebar/Sidebar';
import { TemplatesPanel } from './components/TemplatesPanel/TemplatesPanel';
import { TaskDetailPanel } from './components/TaskDetail/TaskDetailPanel';
import { useAppStore } from './store/useAppStore';
import './App.css';

const LEFT_COL_MIN = 180;
const LEFT_COL_MAX = 480;
const LEFT_COL_DEFAULT = 280;

function PanelDragGhost() {
  const { panelDrag, tasks } = useAppStore(
    useShallow((s) => ({ panelDrag: s.panelDrag, tasks: s.tasks }))
  );
  if (!panelDrag) return null;
  const task = tasks[panelDrag.taskId];
  if (!task) return null;

  return (
    <div
      className="panelDragGhost"
      style={{
        left: panelDrag.x + 14,
        top: panelDrag.y - 14,
        '--ghost-color': task.color,
      } as React.CSSProperties}
    >
      <span className="panelDragGhostDot" />
      {task.title}
    </div>
  );
}

export default function App() {
  const { closeModal, ensureActiveLog, selectedTaskId } = useAppStore(
    useShallow((s) => ({
      closeModal: s.closeModal,
      ensureActiveLog: s.ensureActiveLog,
      selectedTaskId: s.ui.selectedTaskId,
    }))
  );
  const [panelOpen, setPanelOpen] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [leftColWidth, setLeftColWidth] = useState(LEFT_COL_DEFAULT);
  const [resizing, setResizing] = useState(false);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);

  // Vertical split between Staging and Time Log (as % of left col height)
  const [splitPct, setSplitPct] = useState(50);
  const [vResizing, setVResizing] = useState(false);
  const leftColRef = useRef<HTMLDivElement>(null);

  useEffect(() => { ensureActiveLog(); }, [ensureActiveLog]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeModal]);

  const onResizeStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = leftColWidth;
    setResizing(true);

    const onMove = (ev: PointerEvent) => {
      const delta = ev.clientX - resizeStartX.current;
      setLeftColWidth(
        Math.min(LEFT_COL_MAX, Math.max(LEFT_COL_MIN, resizeStartWidth.current + delta))
      );
    };
    const onUp = () => {
      setResizing(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [leftColWidth]);

  const onVResizeStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setVResizing(true);
    const startY = e.clientY;
    const startPct = splitPct;

    const onMove = (ev: PointerEvent) => {
      const colH = leftColRef.current?.getBoundingClientRect().height ?? window.innerHeight;
      const delta = ev.clientY - startY;
      setSplitPct(Math.min(85, Math.max(15, startPct + (delta / colH) * 100)));
    };
    const onUp = () => {
      setVResizing(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [splitPct]);

  const showLeftCol = panelOpen || sidebarOpen;

  return (
    <div className="app">
      <Toolbar
        panelOpen={panelOpen}
        onTogglePanel={() => setPanelOpen((v) => !v)}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
      />
      <div className="main">
        {showLeftCol && (
          <div className="leftCol" style={{ width: leftColWidth }} ref={leftColRef}>
            <div className="leftColPanels">
              {panelOpen && sidebarOpen ? (
                <>
                  <div style={{ height: `${splitPct}%`, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <TemplatesPanel />
                  </div>
                  <div
                    className={`resizeHandleH ${vResizing ? 'resizing' : ''}`}
                    onPointerDown={onVResizeStart}
                  />
                  <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <Sidebar />
                  </div>
                </>
              ) : (
                <>
                  {panelOpen && <TemplatesPanel />}
                  {sidebarOpen && <Sidebar />}
                </>
              )}
            </div>
            <div
              className={`resizeHandle ${resizing ? 'resizing' : ''}`}
              onPointerDown={onResizeStart}
            />
          </div>
        )}
        {selectedTaskId && <TaskDetailPanel />}
        <Timeline />
      </div>
      <PanelDragGhost />
    </div>
  );
}
