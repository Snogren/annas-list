export type TaskId = string;
export type TimeLogId = string;

export interface Task {
  id: TaskId;
  title: string;
  description?: string;
  color: string;
  startTime: number; // Unix timestamp ms
  durationMs: number;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export type TimeLogKind = 'task' | 'unlogged' | 'life' | 'distracted';

export interface TimeLog {
  id: TimeLogId;
  taskId: TaskId | null; // null for non-task kinds
  kind: TimeLogKind;
  startTime: number;
  endTime: number | null; // null = running
  note?: string;
}

export type SnapInterval = 'none' | '5min' | '15min' | '30min' | '1hr';

export interface Settings {
  snapInterval: SnapInterval;
  defaultTaskDurationMs: number;
}

export interface UIState {
  scrollOffsetPx: number;
  anchorTime: number;
  pxPerMs: number;
  selectedTaskId: TaskId | null;
  modalOpen: 'edit' | 'log' | null;
}

export type RecurringTaskId = string;

export interface RecurringTask {
  id: RecurringTaskId;
  title: string;
  color: string;
  defaultDurationMs: number;
  createdAt: number;
}

export interface PanelDrag {
  recurringTaskId: RecurringTaskId;
  x: number;
  y: number;
}

export interface DragPreview {
  taskId: TaskId;
  type: 'move' | 'resize-left' | 'resize-right';
  originalStartTime: number;
  originalDurationMs: number;
  currentStartTime: number;
  currentDurationMs: number;
}
