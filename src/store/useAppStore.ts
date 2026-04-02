import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { startOfToday } from 'date-fns';
import type {
  Task,
  TaskId,
  Session,
  SessionId,
  TimeLog,
  TimeLogId,
  TimeLogKind,
  Comment,
  CommentId,
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

function pickColor(usedColors: string[]): string {
  // Find a color not currently in use; fall back to least-used
  const unused = TASK_COLORS.find((c) => !usedColors.includes(c));
  if (unused) return unused;
  // All colors in use — pick the one used least
  const counts = TASK_COLORS.map((c) => usedColors.filter((u) => u === c).length);
  return TASK_COLORS[counts.indexOf(Math.min(...counts))];
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
  sessions: Record<SessionId, Session>;
  timeLogs: Record<TimeLogId, TimeLog>;
  comments: Record<CommentId, Comment>;
  settings: Settings;

  // Ephemeral
  ui: UIState;
  dragPreview: DragPreview | null;
  panelDrag: PanelDrag | null;

  // Task actions
  createTask: (patch?: Partial<Pick<Task, 'title' | 'color' | 'description'>>) => TaskId;
  updateTask: (id: TaskId, patch: Partial<Task>) => void;
  deleteTask: (id: TaskId) => void;

  // Session actions
  scheduleTask: (taskId: TaskId, startTime: number, durationMs: number) => SessionId;
  updateSession: (id: SessionId, patch: Partial<Pick<Session, 'startTime' | 'durationMs'>>) => void;
  unscheduleSession: (id: SessionId) => void;

  // Time log actions
  startTimeLog: (taskId: TaskId | null, kind?: TimeLogKind) => TimeLogId;
  stopCurrentLog: () => void;
  deleteTimeLog: (id: TimeLogId) => void;
  updateTimeLog: (id: TimeLogId, patch: Partial<TimeLog>) => void;
  ensureActiveLog: () => void;

  // UI actions
  setScrollOffset: (px: number) => void;
  setZoom: (pxPerMs: number, cursorViewportOffset?: number) => void;
  openModal: (type: 'edit' | 'log', taskId: TaskId) => void;
  closeModal: () => void;

  // Drag actions
  setDragPreview: (preview: DragPreview | null) => void;
  commitDragPreview: () => void;

  // Panel drag (staging → timeline)
  setPanelDrag: (drag: PanelDrag | null) => void;

  // Comment actions
  addComment: (taskId: TaskId, body: string) => CommentId;
  updateComment: (id: CommentId, body: string) => void;
  deleteComment: (id: CommentId) => void;

  // Settings
  updateSettings: (patch: Partial<Settings>) => void;
}

const anchorTime = startOfToday().getTime();
const initialScrollOffsetPx = Math.max(0, (Date.now() - anchorTime) * PX_PER_MS - 400);

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      tasks: {},
      sessions: {},
      timeLogs: {},
      comments: {},
      settings: {
        snapInterval: '15min',
        defaultSessionDurationMs: 60 * 60 * 1000,
      },
      ui: {
        scrollOffsetPx: initialScrollOffsetPx,
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
        const usedColors = Object.values(get().tasks).map((t) => t.color);
        const task: Task = {
          id,
          title: 'New Task',
          color: pickColor(usedColors),
          done: false,
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
          const { [id]: _, ...tasks } = s.tasks;
          const timeLogs = Object.fromEntries(
            Object.entries(s.timeLogs).filter(([, l]) => l.taskId !== id)
          );
          const sessions = Object.fromEntries(
            Object.entries(s.sessions).filter(([, sess]) => sess.taskId !== id)
          );
          const comments = Object.fromEntries(
            Object.entries(s.comments).filter(([, c]) => c.taskId !== id)
          );
          const ui = s.ui.selectedTaskId === id
            ? { ...s.ui, selectedTaskId: null, modalOpen: null as typeof s.ui.modalOpen }
            : s.ui;
          return { tasks, timeLogs, sessions, comments, ui };
        });
        if (wasActive) get().startTimeLog(null);
      },

      scheduleTask: (taskId, startTime, durationMs) => {
        const id = nanoid();
        const session: Session = {
          id,
          taskId,
          startTime,
          durationMs,
          createdAt: Date.now(),
        };
        set((s) => ({ sessions: { ...s.sessions, [id]: session } }));
        return id;
      },

      updateSession: (id, patch) => {
        set((s) => ({
          sessions: { ...s.sessions, [id]: { ...s.sessions[id], ...patch } },
        }));
      },

      unscheduleSession: (id) => {
        set((s) => {
          const { [id]: _, ...sessions } = s.sessions;
          return { sessions };
        });
      },

      startTimeLog: (taskId, kind) => {
        const resolvedKind: TimeLogKind = kind ?? (taskId !== null ? 'task' : 'unlogged');
        const current = Object.values(get().timeLogs).find((l) => l.endTime === null);
        if (current) {
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

      setZoom: (pxPerMs, cursorViewportOffset = 0) => {
        const { ui } = get();
        const cursorTime = ui.anchorTime + (cursorViewportOffset + ui.scrollOffsetPx) / ui.pxPerMs;
        const newScrollOffset = (cursorTime - ui.anchorTime) * pxPerMs - cursorViewportOffset;
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

      setDragPreview: (preview) => set({ dragPreview: preview }),

      commitDragPreview: () => {
        const { dragPreview, settings } = get();
        if (!dragPreview) return;
        const startTime = snapTime(dragPreview.currentStartTime, settings.snapInterval);
        const durationMs = Math.max(
          5 * 60 * 1000,
          snapTime(dragPreview.currentDurationMs, settings.snapInterval)
        );
        get().updateSession(dragPreview.sessionId, { startTime, durationMs });
        set({ dragPreview: null });
      },

      addComment: (taskId, body) => {
        const id = nanoid();
        const now = Date.now();
        const comment: Comment = { id, taskId, body, createdAt: now, updatedAt: now };
        set((s) => ({ comments: { ...s.comments, [id]: comment } }));
        return id;
      },

      updateComment: (id, body) => {
        set((s) => ({
          comments: { ...s.comments, [id]: { ...s.comments[id], body, updatedAt: Date.now() } },
        }));
      },

      deleteComment: (id) => {
        set((s) => {
          const { [id]: _, ...rest } = s.comments;
          return { comments: rest };
        });
      },

      updateSettings: (patch) => {
        set((s) => ({ settings: { ...s.settings, ...patch } }));
      },
    }),
    {
      name: 'annas-list-store',
      version: 2,
      migrate: (persisted: unknown, fromVersion: number) => {
        const state = persisted as Record<string, unknown>;
        if (fromVersion < 2) {
          // Migrate old tasks (had startTime/durationMs) into tasks + sessions
          const oldTasks = (state.tasks ?? {}) as Record<string, Record<string, unknown>>;
          const newTasks: Record<string, unknown> = {};
          const newSessions: Record<string, unknown> = {};
          for (const [id, t] of Object.entries(oldTasks)) {
            const { startTime, durationMs, tags, ...rest } = t;
            newTasks[id] = { ...rest, done: false, tags: tags ?? [] };
            if (typeof startTime === 'number' && typeof durationMs === 'number') {
              const sid = Math.random().toString(36).slice(2, 10);
              newSessions[sid] = { id: sid, taskId: id, startTime, durationMs, createdAt: Date.now() };
            }
          }
          // Migrate settings
          const oldSettings = (state.settings ?? {}) as Record<string, unknown>;
          const newSettings = {
            snapInterval: oldSettings.snapInterval ?? '15min',
            defaultSessionDurationMs: oldSettings.defaultTaskDurationMs ?? 60 * 60 * 1000,
          };
          return { ...state, tasks: newTasks, sessions: newSessions, settings: newSettings };
        }
        return state;
      },
      partialize: (s) => ({
        tasks: s.tasks,
        sessions: s.sessions,
        timeLogs: s.timeLogs,
        comments: s.comments,
        settings: s.settings,
      }),
    }
  )
);
