import { useState, useEffect, useCallback, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../store/useAppStore';
import type { Task } from '../../types';
import styles from './TemplatesPanel.module.css';

const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#14b8a6',
];

function fmtDuration(ms: number): string {
  if (ms <= 0) return '';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

const GripIcon = () => (
  <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
    <circle cx="3" cy="2.5" r="1.2"/><circle cx="7" cy="2.5" r="1.2"/>
    <circle cx="3" cy="7"   r="1.2"/><circle cx="7" cy="7"   r="1.2"/>
    <circle cx="3" cy="11.5" r="1.2"/><circle cx="7" cy="11.5" r="1.2"/>
  </svg>
);

interface StagingItemProps {
  task: Task;
  loggedMs: number;
}

function StagingItem({ task, loggedMs }: StagingItemProps) {
  const { updateTask, deleteTask, setPanelDrag, openModal } = useAppStore(
    useShallow((s) => ({
      updateTask: s.updateTask,
      deleteTask: s.deleteTask,
      setPanelDrag: s.setPanelDrag,
      openModal: s.openModal,
    }))
  );

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [showColorPicker, setShowColorPicker] = useState(false);

  useEffect(() => {
    if (!isEditingTitle) setTitleDraft(task.title);
  }, [task.title, isEditingTitle]);

  const commitTitle = useCallback(() => {
    const trimmed = titleDraft.trim();
    updateTask(task.id, { title: trimmed || 'Untitled' });
    setIsEditingTitle(false);
  }, [titleDraft, task.id, updateTask]);

  const handleGripPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      setPanelDrag({ taskId: task.id, x: e.clientX, y: e.clientY });
      const onMove = (ev: PointerEvent) => {
        setPanelDrag({ taskId: task.id, x: ev.clientX, y: ev.clientY });
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        setTimeout(() => setPanelDrag(null), 0);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [task.id, setPanelDrag]
  );

  const handleDoneToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      updateTask(task.id, { done: !task.done });
    },
    [task.id, task.done, updateTask]
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      deleteTask(task.id);
    },
    [task.id, deleteTask]
  );

  const handleClick = useCallback(() => {
    if (!isEditingTitle) openModal('edit', task.id);
  }, [isEditingTitle, openModal, task.id]);

  return (
    <div
      className={`${styles.item} ${task.done ? styles.itemDone : ''}`}
      style={{ '--item-color': task.color } as React.CSSProperties}
      onClick={handleClick}
    >
      <div className={styles.itemLeft}>
        <div
          className={styles.grip}
          onPointerDown={handleGripPointerDown}
          onClick={(e) => e.stopPropagation()}
          title="Drag to schedule"
        >
          <GripIcon />
        </div>
        <div className={styles.colorWrap}>
          <button
            className={styles.colorSwatch}
            style={{ background: task.color }}
            onClick={(e) => { e.stopPropagation(); setShowColorPicker((v) => !v); }}
            title="Change color"
          />
          {showColorPicker && (
            <div className={styles.colorPicker}>
              {COLORS.map((c) => (
                <button
                  key={c}
                  className={`${styles.colorDot} ${c === task.color ? styles.colorDotActive : ''}`}
                  style={{ background: c }}
                  onClick={(e) => {
                    e.stopPropagation();
                    updateTask(task.id, { color: c });
                    setShowColorPicker(false);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={styles.itemBody}>
        {isEditingTitle ? (
          <input
            className={styles.titleInput}
            value={titleDraft}
            autoFocus
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitTitle();
              if (e.key === 'Escape') { setTitleDraft(task.title); setIsEditingTitle(false); }
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className={styles.title}
            onDoubleClick={(e) => { e.stopPropagation(); setIsEditingTitle(true); }}
          >
            {task.title}
          </span>
        )}
        {loggedMs > 0 && (
          <span className={styles.loggedBadge}>{fmtDuration(loggedMs)} logged</span>
        )}
      </div>

      <button
        className={styles.doneBtn}
        onClick={handleDoneToggle}
        title={task.done ? 'Mark undone' : 'Mark done'}
      >
        {task.done ? (
          <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 8a6 6 0 1 1 12 0A6 6 0 0 1 2 8zm8.03-1.97a.75.75 0 0 0-1.06-1.06L7 6.94l-.97-.97a.75.75 0 0 0-1.06 1.06l1.5 1.5a.75.75 0 0 0 1.06 0l2.5-2.5z"/>
          </svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="8" cy="8" r="6"/>
          </svg>
        )}
      </button>

      <button
        className={styles.deleteBtn}
        onClick={handleDelete}
        title="Delete task"
      >
        ×
      </button>
    </div>
  );
}

export function TemplatesPanel() {
  const { tasks, sessions, timeLogs, createTask } = useAppStore(
    useShallow((s) => ({
      tasks: s.tasks,
      sessions: s.sessions,
      timeLogs: s.timeLogs,
      createTask: s.createTask,
    }))
  );

  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Unscheduled tasks = tasks with no session
  const scheduledTaskIds = new Set(Object.values(sessions).map((s) => s.taskId));
  const unscheduledTasks = Object.values(tasks)
    .filter((t) => !scheduledTaskIds.has(t.id))
    .sort((a, b) => a.createdAt - b.createdAt);

  // Compute logged ms per task
  const now = Date.now();
  const taskLoggedMs: Record<string, number> = {};
  for (const log of Object.values(timeLogs)) {
    if (log.kind !== 'task' || !log.taskId) continue;
    const ms = (log.endTime ?? now) - log.startTime;
    taskLoggedMs[log.taskId] = (taskLoggedMs[log.taskId] ?? 0) + ms;
  }

  const handleQuickAdd = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== 'Enter') return;
      const title = draft.trim();
      if (!title) return;
      createTask({ title });
      setDraft('');
    },
    [draft, createTask]
  );

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.panelTitle}>Staging</span>
        <p className={styles.panelSubtitle}>Drag to schedule on timeline</p>
      </div>

      <div className={styles.captureRow}>
        <input
          ref={inputRef}
          className={styles.captureInput}
          placeholder="Add a task… (Enter)"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleQuickAdd}
        />
      </div>

      <div className={styles.body}>
        {unscheduledTasks.length === 0 && (
          <p className={styles.empty}>All tasks are scheduled — nice.</p>
        )}
        {unscheduledTasks.map((task) => (
          <StagingItem
            key={task.id}
            task={task}
            loggedMs={taskLoggedMs[task.id] ?? 0}
          />
        ))}
      </div>
    </div>
  );
}
