import { useRef, useEffect, useState, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { eachHourOfInterval } from 'date-fns';
import { useTimeline } from '../../context/TimelineContext';
import { useAppStore, snapTime } from '../../store/useAppStore';
import { assignLanes } from '../../utils/layoutUtils';
import { TaskBlock } from '../Task/TaskBlock';

const MIN_LANE_WIDTH = 120;
import styles from './TimelineGrid.module.css';

const NOW_NEEDLE_INTERVAL = 30 * 1000;
const PANEL_GHOST_ID = '__panel_ghost__';

export function TimelineGrid() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(window.innerHeight);
  const [width, setWidth] = useState(0);
  const [now, setNow] = useState(Date.now());

  const { timestampToY, yToTimestamp, visibleStartTime, visibleEndTime } = useTimeline();
  const {
    tasks, sessions, dragPreview, panelDrag,
    createTask, scheduleTask, openModal, setPanelDrag, closeModal,
  } = useAppStore(
    useShallow((s) => ({
      tasks: s.tasks,
      sessions: s.sessions,
      dragPreview: s.dragPreview,
      panelDrag: s.panelDrag,
      createTask: s.createTask,
      scheduleTask: s.scheduleTask,
      openModal: s.openModal,
      setPanelDrag: s.setPanelDrag,
      closeModal: s.closeModal,
    }))
  );
  const snapInterval = useAppStore((s) => s.settings.snapInterval);
  const defaultDurationMs = useAppStore((s) => s.settings.defaultSessionDurationMs);

  useEffect(() => {
    const obs = new ResizeObserver((entries) => {
      setHeight(entries[0].contentRect.height);
      setWidth(entries[0].contentRect.width);
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), NOW_NEEDLE_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  // Panel drag drop handler
  useEffect(() => {
    if (!panelDrag) return;

    const onPanelDrop = (e: PointerEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      if (
        e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top  && e.clientY <= rect.bottom
      ) {
        const task = tasks[panelDrag.taskId];
        if (task) {
          const relY = e.clientY - rect.top;
          const rawTs = yToTimestamp(relY);
          const startTime = snapTime(rawTs, snapInterval);
          scheduleTask(panelDrag.taskId, startTime, defaultDurationMs);
        }
      }
      setPanelDrag(null);
    };

    window.addEventListener('pointerup', onPanelDrop);
    return () => window.removeEventListener('pointerup', onPanelDrop);
  }, [panelDrag, tasks, yToTimestamp, snapInterval, defaultDurationMs, scheduleTask, setPanelDrag]);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const rect = containerRef.current!.getBoundingClientRect();
      const rawTs = yToTimestamp(e.clientY - rect.top);
      const startTime = snapTime(rawTs, snapInterval);

      const ONE_HOUR = 60 * 60 * 1000;
      const MIN_GAP = 15 * 60 * 1000;

      // Find the nearest session that starts after this one
      const nextStart = Object.values(sessions)
        .map((s) => s.startTime)
        .filter((t) => t > startTime)
        .sort((a, b) => a - b)[0];

      const gapMs = nextStart !== undefined ? nextStart - startTime : Infinity;
      const durationMs = gapMs < MIN_GAP ? ONE_HOUR : Math.min(ONE_HOUR, gapMs);

      const taskId = createTask();
      scheduleTask(taskId, startTime, durationMs);
      openModal('edit', taskId);
    },
    [yToTimestamp, snapInterval, sessions, createTask, scheduleTask, openModal]
  );

  // Single click on empty grid area deselects
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement) === containerRef.current) closeModal();
    },
    [closeModal]
  );

  const sessionList = Object.values(sessions);

  // Build panel ghost session if dragging over the grid
  const rect = containerRef.current?.getBoundingClientRect();
  const panelGhostSession = (() => {
    if (!panelDrag || !rect) return null;
    if (
      panelDrag.x < rect.left || panelDrag.x > rect.right ||
      panelDrag.y < rect.top  || panelDrag.y > rect.bottom
    ) return null;
    const task = tasks[panelDrag.taskId];
    if (!task) return null;
    const relY = panelDrag.y - rect.top;
    const startTime = snapTime(yToTimestamp(relY), snapInterval);
    return {
      id: PANEL_GHOST_ID,
      taskId: panelDrag.taskId,
      startTime,
      durationMs: defaultDurationMs,
      createdAt: 0,
    };
  })();

  const allSessionsForLanes = panelGhostSession ? [...sessionList, panelGhostSession] : sessionList;
  const lanes = assignLanes(allSessionsForLanes);
  const maxLane = Math.max(0, ...Array.from(lanes.values()));
  const laneCount = maxLane + 1;
  const laneWidth = Math.max(MIN_LANE_WIDTH, width / laneCount);

  const startTs = visibleStartTime();
  const endTs = visibleEndTime(height);
  const hourMs = 60 * 60 * 1000;

  const hours = eachHourOfInterval({
    start: new Date(startTs - hourMs),
    end: new Date(endTs + hourMs),
  });

  const visibleSessions = sessionList.filter(
    (s) => s.startTime < endTs && s.startTime + s.durationMs > startTs
  );

  const nowY = timestampToY(now);
  const nowVisible = nowY >= -4 && nowY <= height + 4;

  const previewSession = dragPreview
    ? { ...sessions[dragPreview.sessionId], startTime: dragPreview.currentStartTime, durationMs: dragPreview.currentDurationMs }
    : null;

  return (
    <div
      ref={containerRef}
      className={styles.grid}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {hours.map((hour) => {
        const y = timestampToY(hour.getTime());
        if (y < -2 || y > height + 2) return null;
        return (
          <div
            key={hour.getTime()}
            className={`${styles.hourLine} ${hour.getHours() === 0 ? styles.dayLine : ''}`}
            style={{ top: y }}
          />
        );
      })}

      {visibleSessions.map((session) => {
        const task = tasks[session.taskId];
        if (!task) return null;
        return (
          <TaskBlock key={session.id} session={session} task={task} lane={lanes.get(session.id) ?? 0} laneWidth={laneWidth} />
        );
      })}

      {previewSession && dragPreview && sessions[dragPreview.sessionId] && (
        <TaskBlock
          key={`preview-${dragPreview.sessionId}`}
          session={previewSession}
          task={tasks[sessions[dragPreview.sessionId].taskId]}
          lane={lanes.get(dragPreview.sessionId) ?? 0}
          laneWidth={laneWidth}
          isPreview
        />
      )}

      {panelGhostSession && tasks[panelGhostSession.taskId] && (
        <TaskBlock
          key={PANEL_GHOST_ID}
          session={panelGhostSession}
          task={tasks[panelGhostSession.taskId]}
          lane={lanes.get(PANEL_GHOST_ID) ?? 0}
          laneWidth={laneWidth}
          isPreview
        />
      )}

      {nowVisible && (
        <div className={styles.nowNeedle} style={{ top: nowY }}>
          <div className={styles.nowDot} />
        </div>
      )}
    </div>
  );
}
