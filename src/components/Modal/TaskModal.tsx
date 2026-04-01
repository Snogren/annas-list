import { useState, useEffect, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../store/useAppStore';
import styles from './Modal.module.css';

const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#14b8a6',
];

function toLocalDatetimeInput(ts: number) {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function msToHours(ms: number) {
  return Math.round((ms / (1000 * 60 * 60)) * 100) / 100;
}

function hoursToMs(h: number) {
  return h * 60 * 60 * 1000;
}

export function TaskModal() {
  const { ui, tasks, updateTask, deleteTask, closeModal, openModal } = useAppStore(
    useShallow((s) => ({
      ui: s.ui,
      tasks: s.tasks,
      updateTask: s.updateTask,
      deleteTask: s.deleteTask,
      closeModal: s.closeModal,
      openModal: s.openModal,
    }))
  );

  const task = ui.selectedTaskId ? tasks[ui.selectedTaskId] : null;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [startInput, setStartInput] = useState('');
  const [durationHours, setDurationHours] = useState(1);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? '');
      setColor(task.color);
      setStartInput(toLocalDatetimeInput(task.startTime));
      setDurationHours(msToHours(task.durationMs));
    }
  }, [task?.id]);

  const handleSave = useCallback(() => {
    if (!task) return;
    const startTime = new Date(startInput).getTime();
    updateTask(task.id, {
      title: title.trim() || 'Untitled',
      description,
      color,
      startTime: isNaN(startTime) ? task.startTime : startTime,
      durationMs: Math.max(5 * 60 * 1000, hoursToMs(durationHours)),
    });
    closeModal();
  }, [task, title, description, color, startInput, durationHours, updateTask, closeModal]);

  const handleDelete = useCallback(() => {
    if (!task) return;
    if (confirm(`Delete "${task.title}"?`)) {
      deleteTask(task.id);
      closeModal();
    }
  }, [task, deleteTask, closeModal]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave();
      if (e.key === 'Escape') closeModal();
    },
    [handleSave, closeModal]
  );

  if (!task || ui.modalOpen !== 'edit') return null;

  return (
    <div className={styles.overlay} onClick={closeModal} onKeyDown={handleKeyDown}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.modalTitle}>Edit Task</h2>
          <button className={styles.closeBtn} onClick={closeModal} aria-label="Close">
            ×
          </button>
        </div>

        <div className={styles.body}>
          <label className={styles.label}>
            Title
            <input
              className={styles.input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              placeholder="Task name"
            />
          </label>

          <label className={styles.label}>
            Description
            <textarea
              className={styles.textarea}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes..."
              rows={3}
            />
          </label>

          <div className={styles.row}>
            <label className={styles.label} style={{ flex: 1 }}>
              Start time
              <input
                className={styles.input}
                type="datetime-local"
                value={startInput}
                onChange={(e) => setStartInput(e.target.value)}
              />
            </label>
            <label className={styles.label} style={{ width: 120 }}>
              Duration (hrs)
              <input
                className={styles.input}
                type="number"
                value={durationHours}
                min={0.08}
                step={0.25}
                onChange={(e) => setDurationHours(parseFloat(e.target.value) || 0.25)}
              />
            </label>
          </div>

          <div className={styles.label}>
            Color
            <div className={styles.colorRow}>
              {COLORS.map((c) => (
                <button
                  key={c}
                  className={`${styles.colorSwatch} ${c === color ? styles.colorSelected : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button
            className={styles.btnSecondary}
            onClick={() => {
              closeModal();
              openModal('log', task.id);
            }}
          >
            Log Time
          </button>
          <div style={{ flex: 1 }} />
          <button className={styles.btnDanger} onClick={handleDelete}>
            Delete
          </button>
          <button className={styles.btnPrimary} onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
