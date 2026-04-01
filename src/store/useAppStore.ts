import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { startOfToday } from 'date-fns';
import type {
  Task,
  TaskId,
  TimeLog,
  TimeLogId,
  TimeLogKind,
  RecurringTask,
  RecurringTaskId,
  PanelDrag,
  UIState,
  Settings,
  DragPreview,
  SnapInterval,
} from '../types';

const TASK_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#06b6d4',
];

function randomColor() {
  return TASK_COLORS[Math.floor(Math.random() * TASK_COLORS.length)];
}

function nanoid() {
  return Math.random().toString(36).slice(2, 10);
}

const SNAP_INTERVALS: Record<SnapInterval, number> = {
  none: 0,
  '5min': 5 * 60 * 1000,
  '15min': 15 * 60 * 1000,
  '30min': 30 * 60 * 1000,
  '1hr': 60 * 60 * 1000,
};

export function snapTime(ts: number, snapInterval: SnapInterval): number {
  const intervalMs = SNAP_INTERVALS[snapInterval];
  if (!intervalMs) return ts;
  return Math.round(ts / intervalMs) * intervalMs;
}

const PX_PER_HOUR = 120;
export const PX_PER_MS = PX_PER_HOUR / (60 * 60 * 1000);

interface AppStore {
  // Persisted
  tasks: Record<TaskId, Task>;
  timeLogs: Record<TimeLogId, TimeLog>;
  recurringTasks: Record<RecurringTaskId, RecurringTask>;
  settings: Settings;

  // Ephemeral
  ui: UIState;
  dragPreview: DragPreview | null;
  panelDrag: PanelDrag | null;

  // Task actions
  createTask: (patch?: Partial<Task>) => TaskId;
  updateTask: (id: TaskId, patch: Partial<Task>) => void;
  deleteTask: (id: TaskId) => void;

  // Time log actions
  // Stops the currently active log (if any) and starts a new one.
  // taskId=null + kind='unlogged'|'life'|'distracted' for non-task periods.
  startTimeLog: (taskId: TaskId | null, kind?: TimeLogKind) => TimeLogId;
  stopCurrentLog: () => void;
  deleteTimeLog: (id: TimeLogId) => void;
  updateTimeLog: (id: TimeLogId, patch: Partial<TimeLog>) => void;
  ensureActiveLog: () => void;

  // UI actions
  setScrollOffset: (px: number) => void;
  setZoom: (pxPerMs: number, cursorViewportX?: number) => void;
  openModal: (type: 'edit' | 'log', taskId: TaskId) => void;
  closeModal: () => void;

  // Drag actions
  setDragPreview: (preview: DragPreview | null) => void;
  commitDragPreview: () => void;

  // Panel drag (template → timeline)
  setPanelDrag: (drag: PanelDrag | null) => void;

  // Recurring task actions
  createRecurringTask: (patch?: Partial<RecurringTask>) => RecurringTaskId;
  updateRecurringTask: (id: RecurringTaskId, patch: Partial<RecurringTask>) => void;
  deleteRecurringTask: (id: RecurringTaskId) => void;

  // Settings
  updateSettings: (patch: Partial<Settings>) => void;
}

const anchorTime = startOfToday().getTime();

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      tasks: {},
      timeLogs: {},
      recurringTasks: {},
      settings: {
        snapInterval: '15min',
        defaultTaskDurationMs: 60 * 60 * 1000,
      },
      ui: {
        scrollOffsetPx: 0,
        anchorTime,
        pxPerMs: PX_PER_MS,
        selectedTaskId: null,
        modalOpen: null,
      },
      dragPreview: null,
      panelDrag: null,

      createTask: (patch = {}) => {
        const id = nanoid();
        const now = Date.now();
        const task: Task = {
          id,
          title: 'New Task',
          color: randomColor(),
          startTime: snapTime(now, get().settings.snapInterval),
          durationMs: get().settings.defaultTaskDurationMs,
          tags: [],
          createdAt: now,
          updatedAt: now,
          ...patch,
        };
        set((s) => ({ tasks: { ...s.tasks, [id]: task } }));
        return id;
      },

      updateTask: (id, patch) => {
        set((s) => ({
          tasks: {
            ...s.tasks,
            [id]: { ...s.tasks[id], ...patch, updatedAt: Date.now() },
          },
        }));
      },

      deleteTask: (id) => {
        const wasActive = Object.values(get().timeLogs).find(
          (l) => l.taskId === id && l.endTime === null
        );
        set((s) => {
          const { [id]: _, ...rest } = s.tasks;
          // Remove all logs for this task (they become orphaned)
          const timeLogs = Object.fromEntries(
            Object.entries(s.timeLogs).filter(([, l]) => l.taskId !== id)
          );
          return { tasks: rest, timeLogs };
        });
        // If the deleted task was being logged, resume unlogged
        if (wasActive) get().startTimeLog(null);
      },

      startTimeLog: (taskId, kind) => {
        const resolvedKind: TimeLogKind = kind ?? (taskId !== null ? 'task' : 'unlogged');
        // Stop whatever is currently running
        const current = Object.values(get().timeLogs).find((l) => l.endTime === null);
        if (current) {
          // If clicking the same non-task kind that's already active, treat as a toggle → go unlogged
          if (current.kind === resolvedKind && resolvedKind !== 'task' && resolvedKind !== 'unlogged') {
            set((s) => ({
              timeLogs: { ...s.timeLogs, [current.id]: { ...current, endTime: Date.now() } },
            }));
            const id = nanoid();
            const log: TimeLog = { id, taskId: null, kind: 'unlogged', startTime: Date.now(), endTime: null };
            set((s) => ({ timeLogs: { ...s.timeLogs, [id]: log } }));
            return id;
          }
          set((s) => ({
            timeLogs: { ...s.timeLogs, [current.id]: { ...current, endTime: Date.now() } },
          }));
        }
        const id = nanoid();
        const log: TimeLog = { id, taskId, kind: resolvedKind, startTime: Date.now(), endTime: null };
        set((s) => ({ timeLogs: { ...s.timeLogs, [id]: log } }));
        return id;
      },

      stopCurrentLog: () => {
        const current = Object.values(get().timeLogs).find((l) => l.endTime === null);
        if (!current) return;
        set((s) => ({
          timeLogs: { ...s.timeLogs, [current.id]: { ...current, endTime: Date.now() } },
        }));
        // Always resume unlogged after stopping a task
        if (current.kind === 'task') get().startTimeLog(null);
      },

      ensureActiveLog: () => {
        const active = Object.values(get().timeLogs).find((l) => l.endTime === null);
        if (!active) get().startTimeLog(null);
      },

      deleteTimeLog: (id) => {
        set((s) => {
          const { [id]: _, ...rest } = s.timeLogs;
          return { timeLogs: rest };
        });
      },

      updateTimeLog: (id, patch) => {
        set((s) => ({
          timeLogs: { ...s.timeLogs, [id]: { ...s.timeLogs[id], ...patch } },
        }));
      },

      setScrollOffset: (px) => {
        set((s) => ({ ui: { ...s.ui, scrollOffsetPx: px } }));
      },

      setZoom: (pxPerMs, cursorViewportX = 0) => {
        const { ui } = get();
        // Keep cursor time fixed
        const cursorTime = ui.anchorTime + (cursorViewportX + ui.scrollOffsetPx) / ui.pxPerMs;
        const newScrollOffset = (cursorTime - ui.anchorTime) * pxPerMs - cursorViewportX;
        set((s) => ({ ui: { ...s.ui, pxPerMs, scrollOffsetPx: newScrollOffset } }));
      },

      openModal: (type, taskId) => {
        set((s) => ({
          ui: { ...s.ui, modalOpen: type, selectedTaskId: taskId },
        }));
      },

      closeModal: () => {
        set((s) => ({ ui: { ...s.ui, modalOpen: null, selectedTaskId: null } }));
      },

      setPanelDrag: (drag) => set({ panelDrag: drag }),

      createRecurringTask: (patch = {}) => {
        const id = nanoid();
        const task: RecurringTask = {
          id,
          title: 'New Template',
          color: randomColor(),
          defaultDurationMs: get().settings.defaultTaskDurationMs,
          createdAt: Date.now(),
          ...patch,
        };
        set((s) => ({ recurringTasks: { ...s.recurringTasks, [id]: task } }));
        return id;
      },

      updateRecurringTask: (id, patch) => {
        set((s) => ({
          recurringTasks: { ...s.recurringTasks, [id]: { ...s.recurringTasks[id], ...patch } },
        }));
      },

      deleteRecurringTask: (id) => {
        set((s) => {
          const { [id]: _, ...rest } = s.recurringTasks;
          return { recurringTasks: rest };
        });
      },

      setDragPreview: (preview) => set({ dragPreview: preview }),

      commitDragPreview: () => {
        const { dragPreview, settings } = get();
        if (!dragPreview) return;
        const startTime = snapTime(dragPreview.currentStartTime, settings.snapInterval);
        const durationMs = Math.max(
          5 * 60 * 1000,
          snapTime(dragPreview.currentDurationMs, settings.snapInterval)
        );
        get().updateTask(dragPreview.taskId, { startTime, durationMs });
        set({ dragPreview: null });
      },

      updateSettings: (patch) => {
        set((s) => ({ settings: { ...s.settings, ...patch } }));
      },
    }),
    {
      name: 'annas-list-store',
      partialize: (s) => ({
        tasks: s.tasks,
        timeLogs: s.timeLogs,
        recurringTasks: s.recurringTasks,
        settings: s.settings,
      }),
    }
  )
);
