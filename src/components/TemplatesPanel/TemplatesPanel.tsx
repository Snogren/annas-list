import { useState, useEffect, useCallback, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../store/useAppStore';
import type { RecurringTask } from '../../types';
import styles from './TemplatesPanel.module.css';

const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#14b8a6',
];

const GripIcon = () => (
  <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
    <circle cx="3" cy="2.5" r="1.2"/><circle cx="7" cy="2.5" r="1.2"/>
    <circle cx="3" cy="7"   r="1.2"/><circle cx="7" cy="7"   r="1.2"/>
    <circle cx="3" cy="11.5" r="1.2"/><circle cx="7" cy="11.5" r="1.2"/>
  </svg>
);

interface InboxItemProps {
  item: RecurringTask;
}

function InboxItem({ item }: InboxItemProps) {
  const { updateRecurringTask, deleteRecurringTask, setPanelDrag } = useAppStore(
    useShallow((s) => ({
      updateRecurringTask: s.updateRecurringTask,
      deleteRecurringTask: s.deleteRecurringTask,
      setPanelDrag: s.setPanelDrag,
    }))
  );

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(item.title);
  const [showColorPicker, setShowColorPicker] = useState(false);

  useEffect(() => {
    if (!isEditingTitle) setTitleDraft(item.title);
  }, [item.title, isEditingTitle]);

  const commitTitle = useCallback(() => {
    const trimmed = titleDraft.trim();
    updateRecurringTask(item.id, { title: trimmed || 'Untitled' });
    setIsEditingTitle(false);
  }, [titleDraft, item.id, updateRecurringTask]);

  const handleGripPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      setPanelDrag({ recurringTaskId: item.id, x: e.clientX, y: e.clientY });
      const onMove = (ev: PointerEvent) => {
        setPanelDrag({ recurringTaskId: item.id, x: ev.clientX, y: ev.clientY });
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        setTimeout(() => setPanelDrag(null), 0);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [item.id, setPanelDrag]
  );

  return (
    <div
      className={styles.item}
      style={{ '--item-color': item.color } as React.CSSProperties}
    >
      <div className={styles.itemLeft}>
        <div className={styles.grip} onPointerDown={handleGripPointerDown} title="Drag to schedule">
          <GripIcon />
        </div>
        <div className={styles.colorWrap}>
          <button
            className={styles.colorSwatch}
            style={{ background: item.color }}
            onClick={() => setShowColorPicker((v) => !v)}
            title="Change color"
          />
          {showColorPicker && (
            <div className={styles.colorPicker}>
              {COLORS.map((c) => (
                <button
                  key={c}
                  className={`${styles.colorDot} ${c === item.color ? styles.colorDotActive : ''}`}
                  style={{ background: c }}
                  onClick={() => { updateRecurringTask(item.id, { color: c }); setShowColorPicker(false); }}
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
              if (e.key === 'Escape') { setTitleDraft(item.title); setIsEditingTitle(false); }
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className={styles.title} onClick={() => setIsEditingTitle(true)}>
            {item.title}
          </span>
        )}
      </div>

      <button className={styles.deleteBtn} onClick={() => deleteRecurringTask(item.id)} title="Remove">
        ×
      </button>
    </div>
  );
}

export function TemplatesPanel() {
  const { recurringTasks, createRecurringTask } = useAppStore(
    useShallow((s) => ({
      recurringTasks: s.recurringTasks,
      createRecurringTask: s.createRecurringTask,
    }))
  );

  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const items = Object.values(recurringTasks).sort((a, b) => a.createdAt - b.createdAt);

  const handleQuickAdd = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== 'Enter') return;
      const title = draft.trim();
      if (!title) return;
      createRecurringTask({ title });
      setDraft('');
    },
    [draft, createRecurringTask]
  );

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.panelTitle}>Inbox</span>
        <p className={styles.panelSubtitle}>Capture ideas, drag to schedule</p>
      </div>

      {/* Quick capture */}
      <div className={styles.captureRow}>
        <input
          ref={inputRef}
          className={styles.captureInput}
          placeholder="Add an idea… (Enter)"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleQuickAdd}
        />
      </div>

      <div className={styles.body}>
        {items.length === 0 && (
          <p className={styles.empty}>Nothing yet — type above to capture an idea.</p>
        )}
        {items.map((item) => (
          <InboxItem key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
