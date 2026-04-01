import { useCallback, useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import type { SnapInterval, TimeLogKind } from '../../types';
import styles from './Toolbar.module.css';

const SNAP_OPTIONS: { value: SnapInterval; label: string }[] = [
  { value: 'none', label: 'Free' },
  { value: '5min', label: '5m' },
  { value: '15min', label: '15m' },
  { value: '30min', label: '30m' },
  { value: '1hr', label: '1h' },
];

const KIND_META: Record<TimeLogKind, { label: string; color: string }> = {
  task:       { label: '',          color: '' },
  unlogged:   { label: 'Unlogged',  color: 'var(--text-muted)' },
  life:       { label: 'Life',      color: '#22c55e' },
  distracted: { label: 'Distracted', color: '#f97316' },
};

function formatElapsed(startTime: number) {
  const ms = Date.now() - startTime;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`;
  return `${s}s`;
}

function ActiveLogIndicator() {
  const { timeLogs, tasks, stopCurrentLog } = useAppStore(
    useShallow((s) => ({
      timeLogs: s.timeLogs,
      tasks: s.tasks,
      stopCurrentLog: s.stopCurrentLog,
    }))
  );

  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const activeLog = Object.values(timeLogs).find((l) => l.endTime === null) ?? null;
  if (!activeLog) return null;

  const activeTask = activeLog.taskId ? tasks[activeLog.taskId] : null;
  const kind = activeLog.kind ?? (activeTask ? 'task' : 'unlogged');
  const dotColor = activeTask ? activeTask.color : KIND_META[kind].color;
  const label = activeTask ? activeTask.title : KIND_META[kind].label;
  const isTask = kind === 'task';

  return (
    <div className={styles.activeLog}>
      <span className={styles.activeDot} style={{ background: dotColor }} />
      <span className={styles.activeLabel} style={!activeTask ? { color: dotColor } : undefined}>
        {label}
      </span>
      <span className={styles.activeElapsed}>
        {formatElapsed(activeLog.startTime)}
      </span>
      {isTask && (
        <button className={styles.stopBtn} onClick={() => stopCurrentLog()} title="Stop logging">
          ■
        </button>
      )}
    </div>
  );
}

interface QuickLogButtonProps {
  kind: 'life' | 'distracted';
  activeKind: TimeLogKind | null;
  onClick: () => void;
}

function QuickLogButton({ kind, activeKind, onClick }: QuickLogButtonProps) {
  const isActive = activeKind === kind;
  const meta = KIND_META[kind];
  return (
    <button
      className={`${styles.quickBtn} ${isActive ? styles.quickBtnActive : ''}`}
      style={{ '--quick-color': meta.color } as React.CSSProperties}
      onClick={onClick}
      title={isActive ? `Stop logging ${meta.label}` : `Log as ${meta.label}`}
    >
      {kind === 'life' ? '♥' : '⚡'} {meta.label}
    </button>
  );
}

interface ToolbarProps {
  panelOpen: boolean;
  onTogglePanel: () => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export function Toolbar({ panelOpen, onTogglePanel, sidebarOpen, onToggleSidebar }: ToolbarProps) {
  const { createTask, setScrollOffset, settings, updateSettings, ui, timeLogs, startTimeLog } =
    useAppStore(
      useShallow((s) => ({
        createTask: s.createTask,
        setScrollOffset: s.setScrollOffset,
        settings: s.settings,
        updateSettings: s.updateSettings,
        ui: s.ui,
        timeLogs: s.timeLogs,
        startTimeLog: s.startTimeLog,
      }))
    );

  const activeLog = Object.values(timeLogs).find((l) => l.endTime === null) ?? null;
  const activeKind: TimeLogKind | null = activeLog?.kind ?? null;

  const goToNow = useCallback(() => {
    const vw = window.innerWidth;
    const offset = (Date.now() - ui.anchorTime) * ui.pxPerMs - vw / 2;
    setScrollOffset(offset);
  }, [ui.anchorTime, ui.pxPerMs, setScrollOffset]);

  const addTask = useCallback(() => {
    createTask({ startTime: Date.now() });
  }, [createTask]);

  return (
    <div className={styles.toolbar}>
      <div className={styles.left}>
        <button
          className={`${styles.sidebarToggle} ${panelOpen ? styles.sidebarToggleActive : ''}`}
          onClick={onTogglePanel}
          title="Toggle inbox"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
            <rect x="1" y="1" width="14" height="14" rx="2"/>
            <line x1="5" y1="1" x2="5" y2="15"/>
          </svg>
        </button>
        <span className={styles.logo}>Chronos</span>
      </div>

      <div className={styles.center}>
        <button className={styles.todayBtn} onClick={goToNow}>
          Today
        </button>
        <div className={styles.snapGroup}>
          <span className={styles.snapLabel}>Snap</span>
          {SNAP_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`${styles.snapBtn} ${settings.snapInterval === opt.value ? styles.snapActive : ''}`}
              onClick={() => updateSettings({ snapInterval: opt.value })}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.right}>
        <QuickLogButton
          kind="life"
          activeKind={activeKind}
          onClick={() => startTimeLog(null, 'life')}
        />
        <QuickLogButton
          kind="distracted"
          activeKind={activeKind}
          onClick={() => startTimeLog(null, 'distracted')}
        />
        <ActiveLogIndicator />
        <button className={styles.addBtn} onClick={addTask}>
          + New Task
        </button>
        <button
          className={`${styles.sidebarToggle} ${sidebarOpen ? styles.sidebarToggleActive : ''}`}
          onClick={onToggleSidebar}
          title="Toggle time log sidebar"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
            <rect x="1" y="1" width="14" height="14" rx="2"/>
            <line x1="11" y1="1" x2="11" y2="15"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
