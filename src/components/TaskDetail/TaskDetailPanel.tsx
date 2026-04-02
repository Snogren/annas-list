import { useState, useEffect, useCallback, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { format } from 'date-fns';
import { useAppStore } from '../../store/useAppStore';
import type { Comment } from '../../types';
import styles from './TaskDetailPanel.module.css';

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

function formatElapsed(start: number, end: number | null) {
  const ms = (end ?? Date.now()) - start;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function CommentEntry({ comment, onSave, onDelete }: {
  comment: Comment;
  onSave: (id: string, body: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) textareaRef.current?.select();
  }, [editing]);

  const commit = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== comment.body) onSave(comment.id, trimmed);
    else setDraft(comment.body);
    setEditing(false);
  }, [draft, comment.id, comment.body, onSave]);

  return (
    <div className={styles.commentEntry}>
      <div className={styles.commentMeta}>
        <span className={styles.commentTime}>
          {format(comment.createdAt, 'MMM d, h:mm a')}
          {comment.updatedAt !== comment.createdAt && ' (edited)'}
        </span>
        <div className={styles.commentActions}>
          <button className={styles.commentBtn} onClick={() => setEditing(true)} title="Edit">
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 2l3 3-8 8H3v-3l8-8z"/>
            </svg>
          </button>
          <button className={`${styles.commentBtn} ${styles.commentBtnDelete}`} onClick={() => onDelete(comment.id)} title="Delete">×</button>
        </div>
      </div>
      {editing ? (
        <textarea
          ref={textareaRef}
          className={styles.commentEditArea}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); }
            if (e.key === 'Escape') { setDraft(comment.body); setEditing(false); }
          }}
          rows={3}
          autoFocus
        />
      ) : (
        <p className={styles.commentBody} onDoubleClick={() => setEditing(true)}>{comment.body}</p>
      )}
    </div>
  );
}

export function TaskDetailPanel() {
  const {
    ui, tasks, sessions, timeLogs, comments,
    updateTask, updateSession, deleteTask, closeModal,
    startTimeLog, stopCurrentLog, deleteTimeLog,
    addComment, updateComment, deleteComment,
  } = useAppStore(
    useShallow((s) => ({
      ui: s.ui,
      tasks: s.tasks,
      sessions: s.sessions,
      timeLogs: s.timeLogs,
      comments: s.comments,
      updateTask: s.updateTask,
      updateSession: s.updateSession,
      deleteTask: s.deleteTask,
      closeModal: s.closeModal,
      startTimeLog: s.startTimeLog,
      stopCurrentLog: s.stopCurrentLog,
      deleteTimeLog: s.deleteTimeLog,
      addComment: s.addComment,
      updateComment: s.updateComment,
      deleteComment: s.deleteComment,
    }))
  );

  const task = ui.selectedTaskId ? tasks[ui.selectedTaskId] : null;
  // Find the session for this task (if any)
  const session = task
    ? Object.values(sessions).find((s) => s.taskId === task.id) ?? null
    : null;

  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [startInput, setStartInput] = useState('');
  const [durationHours, setDurationHours] = useState(1);
  const [commentDraft, setCommentDraft] = useState('');

  // Collapsible section state: true = expanded
  const [openNotes, setOpenNotes] = useState(true);
  const [openColor, setOpenColor] = useState(true);
  const [openScheduled, setOpenScheduled] = useState(false);
  const [openTimeLog, setOpenTimeLog] = useState(true);
  const [openComments, setOpenComments] = useState(true);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? '');
      setColor(task.color);
    }
  }, [task?.id]);

  useEffect(() => {
    if (session) {
      setStartInput(toLocalDatetimeInput(session.startTime));
      setDurationHours(msToHours(session.durationMs));
    }
  }, [session?.id]);

  const handleSaveTask = useCallback(() => {
    if (!task) return;
    updateTask(task.id, {
      title: title.trim() || 'Untitled',
      description,
      color,
    });
  }, [task, title, description, color, updateTask]);

  const handleSaveSession = useCallback(() => {
    if (!session) return;
    const startTime = new Date(startInput).getTime();
    updateSession(session.id, {
      startTime: isNaN(startTime) ? session.startTime : startTime,
      durationMs: Math.max(5 * 60 * 1000, hoursToMs(durationHours)),
    });
  }, [session, startInput, durationHours, updateSession]);

  const handleDelete = useCallback(() => {
    if (!task) return;
    if (confirm(`Delete "${task.title}"?`)) {
      deleteTask(task.id);
      closeModal();
    }
  }, [task, deleteTask, closeModal]);

  if (!task) return null;

  const allLogs = Object.values(timeLogs);
  const activeLog = allLogs.find((l) => l.endTime === null) ?? null;
  const thisTaskIsActive = activeLog?.taskId === task.id;
  const otherActiveTask =
    activeLog && activeLog.taskId !== null && activeLog.taskId !== task.id
      ? tasks[activeLog.taskId]
      : null;

  const taskLogs = allLogs
    .filter((l) => l.taskId === task.id)
    .sort((a, b) => b.startTime - a.startTime);

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header} style={{ borderLeftColor: task.color }}>
        <div className={styles.headerTop}>
          <span className={styles.taskTitle} style={{ color: task.color }}>
            {task.title}
          </span>
          <button className={styles.closeBtn} onClick={closeModal} title="Close">×</button>
        </div>
      </div>

      <div className={styles.body}>
        {/* Title — always visible */}
        <section className={styles.section}>
          <label className={styles.label}>
            Title
            <input
              key={task.id}
              className={styles.input}
              value={title}
              autoFocus
              onFocus={(e) => e.target.select()}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleSaveTask}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
              placeholder="Task name"
            />
          </label>

          <button
            className={`${styles.doneToggle} ${task.done ? styles.doneToggleActive : ''}`}
            style={{ '--task-color': task.color } as React.CSSProperties}
            onClick={() => updateTask(task.id, { done: !task.done })}
          >
            {task.done ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M2 8a6 6 0 1 1 12 0A6 6 0 0 1 2 8zm8.03-1.97a.75.75 0 0 0-1.06-1.06L7 6.94l-.97-.97a.75.75 0 0 0-1.06 1.06l1.5 1.5a.75.75 0 0 0 1.06 0l2.5-2.5z"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="8" cy="8" r="6"/>
              </svg>
            )}
            {task.done ? 'Done' : 'Mark done'}
          </button>
        </section>

        {/* Notes — collapsible, expanded by default */}
        <section className={styles.section}>
          <button className={styles.collapseHeader} onClick={() => setOpenNotes((v) => !v)}>
            <span className={styles.sectionLabel}>Notes</span>
            <span className={`${styles.collapseChevron} ${openNotes ? styles.collapseChevronOpen : ''}`}>›</span>
          </button>
          {openNotes && (
            <textarea
              className={styles.textarea}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleSaveTask}
              placeholder="Optional notes..."
              rows={3}
            />
          )}
        </section>

        {/* Color — collapsible, expanded by default */}
        <section className={styles.section}>
          <button className={styles.collapseHeader} onClick={() => setOpenColor((v) => !v)}>
            <span className={styles.sectionLabel}>Color</span>
            <span className={`${styles.collapseChevron} ${openColor ? styles.collapseChevronOpen : ''}`}>›</span>
          </button>
          {openColor && (
            <div className={styles.colorRow}>
              {COLORS.map((c) => (
                <button
                  key={c}
                  className={`${styles.colorSwatch} ${c === color ? styles.colorSelected : ''}`}
                  style={{ background: c }}
                  onClick={() => { setColor(c); updateTask(task.id, { color: c }); }}
                />
              ))}
            </div>
          )}
        </section>

        {/* Session fields — only if task is scheduled, collapsed by default */}
        {session && (
          <section className={styles.section}>
            <button className={styles.collapseHeader} onClick={() => setOpenScheduled((v) => !v)}>
              <span className={styles.sectionLabel}>Scheduled</span>
              <span className={`${styles.collapseChevron} ${openScheduled ? styles.collapseChevronOpen : ''}`}>›</span>
            </button>
            {openScheduled && (
              <div className={styles.row}>
                <label className={styles.label} style={{ flex: 1 }}>
                  Start
                  <input
                    className={styles.input}
                    type="datetime-local"
                    value={startInput}
                    onChange={(e) => setStartInput(e.target.value)}
                    onBlur={handleSaveSession}
                  />
                </label>
                <label className={styles.label} style={{ width: 90 }}>
                  Hrs
                  <input
                    className={styles.input}
                    type="number"
                    value={durationHours}
                    min={0.08}
                    step={0.25}
                    onChange={(e) => setDurationHours(parseFloat(e.target.value) || 0.25)}
                    onBlur={handleSaveSession}
                  />
                </label>
              </div>
            )}
          </section>
        )}

        {/* Time log — collapsible, expanded by default */}
        <section className={styles.section}>
          <button className={styles.collapseHeader} onClick={() => setOpenTimeLog((v) => !v)}>
            <span className={styles.sectionLabel}>Time Log</span>
            <span className={`${styles.collapseChevron} ${openTimeLog ? styles.collapseChevronOpen : ''}`}>›</span>
          </button>
          {openTimeLog && (
            <>
              <div className={styles.timerCard} style={{ borderColor: task.color }}>
                {thisTaskIsActive && activeLog ? (
                  <div className={styles.timerRunning}>
                    <span className={styles.timerDot} style={{ background: task.color }} />
                    <span className={styles.timerTime}>
                      {formatElapsed(activeLog.startTime, null)}
                    </span>
                  </div>
                ) : (
                  <div className={styles.timerIdle}>
                    {otherActiveTask ? `Logging: ${otherActiveTask.title}` : 'Not logging'}
                  </div>
                )}
                <button
                  className={styles.timerBtn}
                  style={
                    thisTaskIsActive
                      ? { background: '#ef4444', borderColor: '#ef4444' }
                      : { background: task.color, borderColor: task.color }
                  }
                  onClick={() => thisTaskIsActive ? stopCurrentLog() : startTimeLog(task.id)}
                >
                  {thisTaskIsActive ? 'Stop' : 'Start'}
                </button>
              </div>

              <div className={styles.logList}>
                {taskLogs.length === 0 && (
                  <p className={styles.emptyMsg}>No time logged yet</p>
                )}
                {taskLogs.map((log) => (
                  <div key={log.id} className={styles.logEntry}>
                    <div className={styles.logTimes}>
                      <span>{format(log.startTime, 'MMM d, h:mm a')}</span>
                      <span className={styles.logArrow}>→</span>
                      <span>
                        {log.endTime
                          ? format(log.endTime, 'h:mm a')
                          : <span style={{ color: '#22c55e' }}>running</span>}
                      </span>
                    </div>
                    <div className={styles.logDuration}>
                      {formatElapsed(log.startTime, log.endTime)}
                    </div>
                    <button
                      className={styles.logDeleteBtn}
                      onClick={() => deleteTimeLog(log.id)}
                    >×</button>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {/* Comments — collapsible, expanded by default */}
        <section className={styles.section}>
          <button className={styles.collapseHeader} onClick={() => setOpenComments((v) => !v)}>
            <span className={styles.sectionLabel}>Comments</span>
            <span className={`${styles.collapseChevron} ${openComments ? styles.collapseChevronOpen : ''}`}>›</span>
          </button>
          {openComments && (
            <>
              {Object.values(comments)
                .filter((c) => c.taskId === task.id)
                .sort((a, b) => a.createdAt - b.createdAt)
                .map((c) => (
                  <CommentEntry
                    key={c.id}
                    comment={c}
                    onSave={updateComment}
                    onDelete={deleteComment}
                  />
                ))}
              <textarea
                className={styles.commentInput}
                placeholder="Add a comment… (Enter to save)"
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    const trimmed = commentDraft.trim();
                    if (trimmed) { addComment(task.id, trimmed); setCommentDraft(''); }
                  }
                }}
                rows={2}
              />
            </>
          )}
        </section>
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <button className={styles.btnDanger} onClick={handleDelete}>
          Delete task
        </button>
      </div>
    </div>
  );
}
