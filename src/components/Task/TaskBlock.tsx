import React, { useRef, useCallback, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useShallow } from 'zustand/react/shallow';
import { useTimeline } from '../../context/TimelineContext';
import type { Task } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import styles from './TaskBlock.module.css';

const LANE_HEIGHT = 52;
const TASK_HEIGHT = 40;
const LANE_PADDING = (LANE_HEIGHT - TASK_HEIGHT) / 2;
const MIN_DURATION_MS = 5 * 60 * 1000;
// Below this px width, move action buttons to a hover tooltip
const INLINE_ACTIONS_MIN_WIDTH = 116;

interface Props {
  task: Task;
  lane: number;
  isPreview?: boolean;
}

type DragType = 'move' | 'resize-left' | 'resize-right';

export { LANE_HEIGHT };

// Six-dot grip
const IconGrip = () => (
  <svg width="8" height="12" viewBox="0 0 8 12" fill="currentColor" style={{ opacity: 0.45 }}>
    <circle cx="2" cy="2"  r="1.1"/><circle cx="6" cy="2"  r="1.1"/>
    <circle cx="2" cy="6"  r="1.1"/><circle cx="6" cy="6"  r="1.1"/>
    <circle cx="2" cy="10" r="1.1"/><circle cx="6" cy="10" r="1.1"/>
  </svg>
);

// Simple SVG icons
const IconEdit = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11.5 2.5a2.121 2.121 0 0 1 3 3L5 15H2v-3L11.5 2.5z"/>
  </svg>
);
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

interface ActionButtonsProps {
  task: Task;
  isLogging: boolean;
  onEdit: (e: React.MouseEvent) => void;
  onLog: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  inTooltip?: boolean;
}

function ActionButtons({ task, isLogging, onEdit, onLog, onDelete, inTooltip }: ActionButtonsProps) {
  const stopDrag = (e: React.PointerEvent) => e.stopPropagation();
  return (
    <div className={inTooltip ? styles.tooltipActions : styles.inlineActions}>
      <button
        className={styles.actionBtn}
        title="Edit"
        onPointerDown={stopDrag}
        onClick={onEdit}
        style={{ '--task-color': task.color } as React.CSSProperties}
      >
        <IconEdit />
      </button>
      <button
        className={`${styles.actionBtn} ${isLogging ? styles.actionBtnActive : ''}`}
        title={isLogging ? 'Stop logging' : 'Log time'}
        onPointerDown={stopDrag}
        onClick={onLog}
        style={{ '--task-color': isLogging ? '#ef4444' : task.color } as React.CSSProperties}
      >
        <IconLog active={isLogging} />
      </button>
      <button
        className={`${styles.actionBtn} ${styles.deleteBtn}`}
        title="Delete"
        onPointerDown={stopDrag}
        onClick={onDelete}
      >
        <IconDelete />
      </button>
    </div>
  );
}

export function TaskBlock({ task, lane, isPreview = false }: Props) {
  const { timestampToX, msToWidth, widthToMs } = useTimeline();
  const {
    setDragPreview, commitDragPreview, openModal, deleteTask, updateTask,
    dragPreview, startTimeLog, stopCurrentLog, timeLogs,
  } = useAppStore(
    useShallow((s) => ({
      setDragPreview: s.setDragPreview,
      commitDragPreview: s.commitDragPreview,
      openModal: s.openModal,
      deleteTask: s.deleteTask,
      updateTask: s.updateTask,
      dragPreview: s.dragPreview,
      startTimeLog: s.startTimeLog,
      stopCurrentLog: s.stopCurrentLog,
      timeLogs: s.timeLogs,
    }))
  );

  const isLogging = Object.values(timeLogs).some(
    (l) => l.taskId === task.id && l.endTime === null
  );

  const blockRef = useRef<HTMLDivElement>(null);
  const hideTooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragRef = useRef<{
    type: DragType;
    startX: number;
    origStart: number;
    origDuration: number;
    moved: boolean;
  } | null>(null);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Keep draft in sync if task title changes externally
  useEffect(() => {
    if (!isEditingTitle) setTitleDraft(task.title);
  }, [task.title, isEditingTitle]);

  const top = lane * LANE_HEIGHT + LANE_PADDING;
  const isActive = dragPreview?.taskId === task.id && !isPreview;

  const displayStart =
    isPreview && dragPreview?.taskId === task.id
      ? dragPreview.currentStartTime
      : task.startTime;
  const displayDuration =
    isPreview && dragPreview?.taskId === task.id
      ? dragPreview.currentDurationMs
      : task.durationMs;

  const displayX = timestampToX(displayStart);
  const displayWidth = Math.max(msToWidth(displayDuration), 4);
  const useTooltip = displayWidth < INLINE_ACTIONS_MIN_WIDTH;

  // --- Drag handlers ---
  const handlePointerDown = useCallback(
    (e: React.PointerEvent, type: DragType) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = {
        type,
        startX: e.clientX,
        origStart: task.startTime,
        origDuration: task.durationMs,
        moved: false,
      };
      setDragPreview({
        taskId: task.id,
        type,
        originalStartTime: task.startTime,
        originalDurationMs: task.durationMs,
        currentStartTime: task.startTime,
        currentDurationMs: task.durationMs,
      });
    },
    [task.id, task.startTime, task.durationMs, setDragPreview]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      const dr = dragRef.current;
      const deltaX = e.clientX - dr.startX;
      if (Math.abs(deltaX) > 2) dr.moved = true;
      if (!dr.moved) return;

      const deltaMs = widthToMs(deltaX);
      let newStart = dr.origStart;
      let newDuration = dr.origDuration;

      if (dr.type === 'move') {
        newStart = dr.origStart + deltaMs;
      } else if (dr.type === 'resize-right') {
        newDuration = Math.max(MIN_DURATION_MS, dr.origDuration + deltaMs);
      } else if (dr.type === 'resize-left') {
        const maxDelta = dr.origDuration - MIN_DURATION_MS;
        const clampedDelta = Math.min(deltaMs, maxDelta);
        newStart = dr.origStart + clampedDelta;
        newDuration = dr.origDuration - clampedDelta;
      }

      setDragPreview({
        taskId: task.id,
        type: dr.type,
        originalStartTime: dr.origStart,
        originalDurationMs: dr.origDuration,
        currentStartTime: newStart,
        currentDurationMs: newDuration,
      });
    },
    [task.id, widthToMs, setDragPreview]
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
      }
    },
    [commitDragPreview, setDragPreview]
  );

  // --- Title inline edit ---
  const handleTitleClick = useCallback(
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

  // --- Action handlers ---
  const handleEdit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      openModal('edit', task.id);
    },
    [openModal, task.id]
  );

  const handleLog = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isLogging) {
        stopCurrentLog();
      } else {
        startTimeLog(task.id);
      }
    },
    [isLogging, stopCurrentLog, startTimeLog, task.id]
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (confirm(`Delete "${task.title}"?`)) deleteTask(task.id);
    },
    [deleteTask, task.id, task.title]
  );

  // --- Tooltip positioning ---
  const showTooltipNow = useCallback(() => {
    if (hideTooltipTimer.current) {
      clearTimeout(hideTooltipTimer.current);
      hideTooltipTimer.current = null;
    }
    const rect = blockRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });
    setShowTooltip(true);
  }, []);

  const hideTooltipSoon = useCallback(() => {
    hideTooltipTimer.current = setTimeout(() => setShowTooltip(false), 120);
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (!useTooltip || isPreview) return;
    showTooltipNow();
  }, [useTooltip, isPreview, showTooltipNow]);

  const handleMouseLeave = useCallback(() => {
    hideTooltipSoon();
  }, [hideTooltipSoon]);

  return (
    <>
      <div
        ref={blockRef}
        className={`${styles.block} ${isActive && !isPreview ? styles.dragging : ''} ${isPreview ? styles.preview : ''}`}
        style={{
          left: displayX,
          width: displayWidth,
          top,
          height: TASK_HEIGHT,
          '--task-color': task.color,
        } as React.CSSProperties}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Left resize */}
        <div
          className={styles.resizeLeft}
          onPointerDown={(e) => handlePointerDown(e, 'resize-left')}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />

        {/* Drag grip */}
        {!isPreview && (
          <div
            className={styles.grip}
            onPointerDown={(e) => handlePointerDown(e, 'move')}
            title="Drag to move"
          >
            <IconGrip />
          </div>
        )}

        {/* Title — inline or input */}
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
            onClick={handleTitleClick}
            title={task.title}
          >
            {task.title}
          </span>
        )}

        {/* Inline action buttons (wide tasks only) */}
        {!useTooltip && !isPreview && (
          <ActionButtons
            task={task}
            isLogging={isLogging}
            onEdit={handleEdit}
            onLog={handleLog}
            onDelete={handleDelete}
          />
        )}

        {/* Right resize */}
        <div
          className={styles.resizeRight}
          onPointerDown={(e) => handlePointerDown(e, 'resize-right')}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />
      </div>

      {/* Tooltip for narrow tasks — portal to escape overflow:hidden */}
      {showTooltip && useTooltip && !isPreview &&
        createPortal(
          <div
            className={styles.tooltip}
            style={{ left: tooltipPos.x, top: tooltipPos.y }}
            onMouseEnter={showTooltipNow}
            onMouseLeave={hideTooltipSoon}
          >
            <ActionButtons
              task={task}
              isLogging={isLogging}
              onEdit={handleEdit}
              onLog={handleLog}
              onDelete={handleDelete}
              inTooltip
            />
            <div className={styles.tooltipArrow} />
          </div>,
          document.body
        )
      }
    </>
  );
}
