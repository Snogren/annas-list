import { useRef, useEffect, useState, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { eachHourOfInterval, getHours } from 'date-fns';
import { useTimeline } from '../../context/TimelineContext';
import { useAppStore, snapTime } from '../../store/useAppStore';
import { assignLanes } from '../../utils/layoutUtils';
import { TaskBlock, LANE_HEIGHT } from '../Task/TaskBlock';
import styles from './TimelineGrid.module.css';

const NOW_NEEDLE_INTERVAL = 30 * 1000;
const PANEL_GHOST_ID = '__panel_ghost__';

export function TimelineGrid() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(window.innerWidth);
  const [now, setNow] = useState(Date.now());

  const { timestampToX, xToTimestamp, visibleStartTime, visibleEndTime } = useTimeline();
  const {
    tasks, dragPreview, panelDrag, recurringTasks,
    setScrollOffset, setZoom, createTask, setPanelDrag,
  } = useAppStore(
    useShallow((s) => ({
      tasks: s.tasks,
      dragPreview: s.dragPreview,
      panelDrag: s.panelDrag,
      recurringTasks: s.recurringTasks,
      setScrollOffset: s.setScrollOffset,
      setZoom: s.setZoom,
      createTask: s.createTask,
      setPanelDrag: s.setPanelDrag,
    }))
  );
  const scrollOffsetPx = useAppStore((s) => s.ui.scrollOffsetPx);
  const pxPerMs = useAppStore((s) => s.ui.pxPerMs);
  const snapInterval = useAppStore((s) => s.settings.snapInterval);

  useEffect(() => {
    const obs = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), NOW_NEEDLE_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  // Scroll/zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const zoomFactor = e.deltaY > 0 ? 0.85 : 1.18;
        const rect = el.getBoundingClientRect();
        setZoom(pxPerMs * zoomFactor, e.clientX - rect.left);
      } else {
        const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        setScrollOffset(scrollOffsetPx + delta);
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [scrollOffsetPx, pxPerMs, setScrollOffset, setZoom]);

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
        const template = recurringTasks[panelDrag.recurringTaskId];
        if (template) {
          const relX = e.clientX - rect.left;
          const rawTs = xToTimestamp(relX);
          const startTime = snapTime(rawTs, snapInterval);
          createTask({
            title: template.title,
            color: template.color,
            durationMs: template.defaultDurationMs,
            startTime,
          });
        }
      }
      setPanelDrag(null);
    };

    window.addEventListener('pointerup', onPanelDrop);
    return () => window.removeEventListener('pointerup', onPanelDrop);
  }, [panelDrag, recurringTasks, xToTimestamp, snapInterval, createTask, setPanelDrag]);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const rect = containerRef.current!.getBoundingClientRect();
      const ts = xToTimestamp(e.clientX - rect.left);
      createTask({ startTime: ts });
    },
    [xToTimestamp, createTask]
  );

  const taskList = Object.values(tasks);

  // Build panel ghost task if dragging over the grid
  const rect = containerRef.current?.getBoundingClientRect();
  const panelGhostTask = (() => {
    if (!panelDrag || !rect) return null;
    if (
      panelDrag.x < rect.left || panelDrag.x > rect.right ||
      panelDrag.y < rect.top  || panelDrag.y > rect.bottom
    ) return null;
    const template = recurringTasks[panelDrag.recurringTaskId];
    if (!template) return null;
    const relX = panelDrag.x - rect.left;
    const startTime = snapTime(xToTimestamp(relX), snapInterval);
    return {
      id: PANEL_GHOST_ID,
      title: template.title,
      color: template.color,
      startTime,
      durationMs: template.defaultDurationMs,
      tags: [] as string[],
      createdAt: 0,
      updatedAt: 0,
    };
  })();

  const allTasksForLanes = panelGhostTask ? [...taskList, panelGhostTask] : taskList;
  const lanes = assignLanes(allTasksForLanes);
  const maxLane = Math.max(0, ...Array.from(lanes.values()));
  const gridHeight = Math.max(300, (maxLane + 2) * LANE_HEIGHT);

  const startTs = visibleStartTime();
  const endTs = visibleEndTime(width);
  const hourMs = 60 * 60 * 1000;

  const hours = eachHourOfInterval({
    start: new Date(startTs - hourMs),
    end: new Date(endTs + hourMs),
  });

  const visibleTasks = taskList.filter(
    (t) => t.startTime < endTs && t.startTime + t.durationMs > startTs
  );

  const nowX = timestampToX(now);
  const nowVisible = nowX >= -4 && nowX <= width + 4;

  const previewTask = dragPreview
    ? { ...tasks[dragPreview.taskId], startTime: dragPreview.currentStartTime, durationMs: dragPreview.currentDurationMs }
    : null;

  return (
    <div
      ref={containerRef}
      className={styles.grid}
      style={{ height: gridHeight }}
      onDoubleClick={handleDoubleClick}
    >
      {hours.map((hour) => {
        const x = timestampToX(hour.getTime());
        if (x < -2 || x > width + 2) return null;
        return (
          <div
            key={hour.getTime()}
            className={`${styles.hourLine} ${getHours(hour) === 0 ? styles.dayLine : ''}`}
            style={{ left: x, height: gridHeight }}
          />
        );
      })}

      {visibleTasks.map((task) => (
        <TaskBlock key={task.id} task={task} lane={lanes.get(task.id) ?? 0} />
      ))}

      {previewTask && dragPreview && (
        <TaskBlock
          key={`preview-${dragPreview.taskId}`}
          task={previewTask}
          lane={lanes.get(dragPreview.taskId) ?? 0}
          isPreview
        />
      )}

      {panelGhostTask && (
        <TaskBlock
          key={PANEL_GHOST_ID}
          task={panelGhostTask}
          lane={lanes.get(PANEL_GHOST_ID) ?? 0}
          isPreview
        />
      )}

      {nowVisible && (
        <div className={styles.nowNeedle} style={{ left: nowX }}>
          <div className={styles.nowDot} />
        </div>
      )}
    </div>
  );
}
