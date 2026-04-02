import React, { useRef, useCallback, useState, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useTimeline } from '../../context/TimelineContext';
import type { Task, Session } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import styles from './TaskBlock.module.css';

const TASK_INSET = 6; // px padding inside each lane on each side
const MIN_DURATION_MS = 5 * 60 * 1000;
const ACTIONS_MIN_HEIGHT = 56;
const TOOLTIP_MIN_HEIGHT = 20; // show tooltip actions below this height

interface Props {
  session: Session;
  task: Task;
  lane: number;
  laneWidth: number;
  isPreview?: boolean;
}

type DragType = 'move' | 'resize-top' | 'resize-bottom';

const IconLog = ({ active }: { active?: boolean }) =>
  active ? (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
      <rect x="3" y="3" width="10" height="10" rx="2"/>
    </svg>
  ) : (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6"/>
      <path d="M8 5v3l2 2"/>
    </svg>
  );

const IconDelete = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 4h10M6 4V3h4v1M5 4l.5 9h5l.5-9"/>
  </svg>
);

const IconUnschedule = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 8H3m0 0l3-3M3 8l3 3"/>
    <path d="M13 4v8"/>
  </svg>
);

export function TaskBlock({ session, task, lane, laneWidth, isPreview = false }: Props) {
  const { timestampToY, msToPx, pxToMs } = useTimeline();
  const {
    setDragPreview, commitDragPreview, openModal, deleteTask, updateTask,
    unscheduleSession, dragPreview, startTimeLog, stopCurrentLog, timeLogs,
  } = useAppStore(
    useShallow((s) => ({
      setDragPreview: s.setDragPreview,
      commitDragPreview: s.commitDragPreview,
      openModal: s.openModal,
      deleteTask: s.deleteTask,
      updateTask: s.updateTask,
      unscheduleSession: s.unscheduleSession,
      dragPreview: s.dragPreview,
      startTimeLog: s.startTimeLog,
      stopCurrentLog: s.stopCurrentLog,
      timeLogs: s.timeLogs,
    }))
  );

  const isLogging = Object.values(timeLogs).some(
    (l) => l.taskId === task.id && l.endTime === null
  );
  const isSelected = useAppStore((s) => s.ui.selectedTaskId === task.id);

  const dragRef = useRef<{
    type: DragType;
    startY: number;
    origStart: number;
    origDuration: number;
    moved: boolean;
  } | null>(null);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);

  useEffect(() => {
    if (!isEditingTitle) setTitleDraft(task.title);
  }, [task.title, isEditingTitle]);

  const taskWidth = laneWidth - TASK_INSET * 2;
  const left = lane * laneWidth + TASK_INSET;
  const isActive = dragPreview?.sessionId === session.id && !isPreview;

  const displayStart =
    isPreview && dragPreview?.sessionId === session.id
      ? dragPreview.currentStartTime
      : session.startTime;
  const displayDuration =
    isPreview && dragPreview?.sessionId === session.id
      ? dragPreview.currentDurationMs
      : session.durationMs;

  const displayY = timestampToY(displayStart);
  const displayHeight = Math.max(msToPx(displayDuration), 4);
  const showActions = displayHeight >= ACTIONS_MIN_HEIGHT && !isPreview;
  const showTooltipActions = !showActions && displayHeight >= TOOLTIP_MIN_HEIGHT && !isPreview;

  // --- Drag handlers ---
  const handlePointerDown = useCallback(
    (e: React.PointerEvent, type: DragType) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = {
        type,
        startY: e.clientY,
        origStart: session.startTime,
        origDuration: session.durationMs,
        moved: false,
      };
      setDragPreview({
        sessionId: session.id,
        type,
        originalStartTime: session.startTime,
        originalDurationMs: session.durationMs,
        currentStartTime: session.startTime,
        currentDurationMs: session.durationMs,
      });
    },
    [session.id, session.startTime, session.durationMs, setDragPreview]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      const dr = dragRef.current;
      const deltaY = e.clientY - dr.startY;
      if (Math.abs(deltaY) > 2) dr.moved = true;
      if (!dr.moved) return;

      const deltaMs = pxToMs(deltaY);
      let newStart = dr.origStart;
      let newDuration = dr.origDuration;

      if (dr.type === 'move') {
        newStart = dr.origStart + deltaMs;
      } else if (dr.type === 'resize-bottom') {
        newDuration = Math.max(MIN_DURATION_MS, dr.origDuration + deltaMs);
      } else if (dr.type === 'resize-top') {
        const maxDelta = dr.origDuration - MIN_DURATION_MS;
        const clampedDelta = Math.min(deltaMs, maxDelta);
        newStart = dr.origStart + clampedDelta;
        newDuration = dr.origDuration - clampedDelta;
      }

      setDragPreview({
        sessionId: session.id,
        type: dr.type,
        originalStartTime: dr.origStart,
        originalDurationMs: dr.origDuration,
        currentStartTime: newStart,
        currentDurationMs: newDuration,
      });
    },
    [session.id, pxToMs, setDragPreview]
  );

  const handlePointerUp = useCallback(
    (_e: React.PointerEvent) => {
      if (!dragRef.current) return;
      const { moved } = dragRef.current;
      dragRef.current = null;
      if (moved) {
        commitDragPreview();
      } else {
        setDragPreview(null);
        if (!isPreview) openModal('edit', task.id);
      }
    },
    [commitDragPreview, setDragPreview, openModal, task.id, isPreview]
  );

  // --- Title inline edit ---
  const handleTitleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (isPreview) return;
      e.stopPropagation();
      setIsEditingTitle(true);
    },
    [isPreview]
  );

  const commitTitle = useCallback(() => {
    const trimmed = titleDraft.trim();
    updateTask(task.id, { title: trimmed || 'Untitled' });
    setIsEditingTitle(false);
  }, [titleDraft, task.id, updateTask]);

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); commitTitle(); }
      if (e.key === 'Escape') { setTitleDraft(task.title); setIsEditingTitle(false); }
    },
    [commitTitle, task.title]
  );

  const handleLog = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isLogging) stopCurrentLog();
      else startTimeLog(task.id);
    },
    [isLogging, stopCurrentLog, startTimeLog, task.id]
  );

  const handleUnschedule = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      unscheduleSession(session.id);
    },
    [unscheduleSession, session.id]
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (confirm(`Delete "${task.title}"?`)) deleteTask(task.id);
    },
    [deleteTask, task.id, task.title]
  );

  return (
    <div
      className={`${styles.block} ${task.done ? styles.done : ''} ${isActive && !isPreview ? styles.dragging : ''} ${isPreview ? styles.preview : ''} ${isSelected ? styles.selected : ''}`}
      style={{
        top: displayY,
        height: displayHeight,
        left,
        width: taskWidth,
        '--task-color': task.color,
      } as React.CSSProperties}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Top resize */}
      <div
        className={styles.resizeTop}
        onPointerDown={(e) => handlePointerDown(e, 'resize-top')}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />

      {/* Main drag + title area */}
      <div
        className={styles.body}
        onPointerDown={(e) => handlePointerDown(e, 'move')}
      >
        {isEditingTitle ? (
          <input
            className={styles.titleInput}
            value={titleDraft}
            autoFocus
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={handleTitleKeyDown}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className={styles.title}
            onPointerDown={(e) => e.stopPropagation()}
            onDoubleClick={handleTitleDoubleClick}
          >
            {task.title}
          </span>
        )}
      </div>

      {/* Action row */}
      {showActions && (
        <div className={styles.actions}>
          <button
            className={`${styles.actionBtn} ${isLogging ? styles.actionBtnActive : ''}`}
            title={isLogging ? 'Stop logging' : 'Log time'}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={handleLog}
            style={{ '--task-color': isLogging ? '#ef4444' : task.color } as React.CSSProperties}
          >
            <IconLog active={isLogging} />
            <span>{isLogging ? 'Stop' : 'Log'}</span>
          </button>
          <button
            className={`${styles.actionBtn} ${styles.unscheduleBtn}`}
            title="Return to staging"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={handleUnschedule}
          >
            <IconUnschedule />
          </button>
          <button
            className={`${styles.actionBtn} ${styles.deleteBtn}`}
            title="Delete task"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={handleDelete}
          >
            <IconDelete />
          </button>
        </div>
      )}

      {/* Tooltip actions shown when block is too short for the action row */}
      {showTooltipActions && (
        <div className={styles.tooltipActions} onPointerDown={(e) => e.stopPropagation()}>
          <button
            className={`${styles.tooltipBtn} ${isLogging ? styles.tooltipBtnLogging : ''}`}
            title={isLogging ? 'Stop logging' : 'Log time'}
            onClick={handleLog}
            style={{ '--task-color': isLogging ? '#ef4444' : task.color } as React.CSSProperties}
          >
            <IconLog active={isLogging} />
          </button>
          <button className={`${styles.tooltipBtn} ${styles.tooltipBtnUnschedule}`} title="Return to staging" onClick={handleUnschedule}>
            <IconUnschedule />
          </button>
          <button className={`${styles.tooltipBtn} ${styles.tooltipBtnDelete}`} title="Delete task" onClick={handleDelete}>
            <IconDelete />
          </button>
        </div>
      )}

      {/* Bottom resize */}
      <div
        className={styles.resizeBottom}
        onPointerDown={(e) => handlePointerDown(e, 'resize-bottom')}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
    </div>
  );
}
