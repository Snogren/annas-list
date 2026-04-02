export type TaskId = string;
export type SessionId = string;
export type TimeLogId = string;
export type CommentId = string;

export interface Comment {
  id: CommentId;
  taskId: TaskId;
  body: string;
  createdAt: number;
  updatedAt: number;
}

export interface Task {
  id: TaskId;
  title: string;
  description?: string;
  color: string;
  done: boolean;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface Session {
  id: SessionId;
  taskId: TaskId;
  startTime: number; // Unix timestamp ms
  durationMs: number;
  createdAt: number;
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
  defaultSessionDurationMs: number;
}

export interface UIState {
  scrollOffsetPx: number;
  anchorTime: number;
  pxPerMs: number;
  selectedTaskId: TaskId | null;
  modalOpen: 'edit' | 'log' | null;
}

export interface PanelDrag {
  taskId: TaskId;
  x: number;
  y: number;
}

export interface DragPreview {
  sessionId: SessionId;
  type: 'move' | 'resize-top' | 'resize-bottom';
  originalStartTime: number;
  originalDurationMs: number;
  currentStartTime: number;
  currentDurationMs: number;
}
