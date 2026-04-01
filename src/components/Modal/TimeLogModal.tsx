import { useState, useEffect, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { format } from 'date-fns';
import { useAppStore } from '../../store/useAppStore';
import styles from './Modal.module.css';

function formatElapsed(start: number, end: number | null) {
  const ms = (end ?? Date.now()) - start;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function TimeLogModal() {
  const { ui, tasks, timeLogs, startTimeLog, stopCurrentLog, deleteTimeLog, closeModal } =
    useAppStore(
      useShallow((s) => ({
        ui: s.ui,
        tasks: s.tasks,
        timeLogs: s.timeLogs,
        startTimeLog: s.startTimeLog,
        stopCurrentLog: s.stopCurrentLog,
        deleteTimeLog: s.deleteTimeLog,
        closeModal: s.closeModal,
      }))
    );

  const task = ui.selectedTaskId ? tasks[ui.selectedTaskId] : null;
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const allLogs = Object.values(timeLogs);
  const activeLog = allLogs.find((l) => l.endTime === null) ?? null;
  const thisTaskIsActive = activeLog?.taskId === task?.id;
  const otherActiveTask =
    activeLog && activeLog.taskId !== null && activeLog.taskId !== task?.id
      ? tasks[activeLog.taskId]
      : null;

  const taskLogs = allLogs
    .filter((l) => l.taskId === task?.id)
    .sort((a, b) => b.startTime - a.startTime);

  const handleStartStop = useCallback(() => {
    if (!task) return;
    if (thisTaskIsActive) {
      stopCurrentLog(); // stops this task → starts unlogged automatically
    } else {
      startTimeLog(task.id); // stops whatever is running → starts this task
    }
  }, [task, thisTaskIsActive, startTimeLog, stopCurrentLog]);

  if (!task || ui.modalOpen !== 'log') return null;

  return (
    <div className={styles.overlay} onClick={closeModal}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <h2 className={styles.modalTitle}>Time Log</h2>
            <p className={styles.modalSubtitle} style={{ color: task.color }}>
              {task.title}
            </p>
          </div>
          <button className={styles.closeBtn} onClick={closeModal} aria-label="Close">×</button>
        </div>

        <div className={styles.body}>
          {/* Timer */}
          <div className={styles.timerCard} style={{ borderColor: task.color }}>
            {thisTaskIsActive && activeLog ? (
              <div className={styles.timerRunning}>
                <span className={styles.timerDot} style={{ background: task.color }} />
                <span className={styles.timerTime}>
                  {formatElapsed(activeLog.startTime, null)}
                </span>
              </div>
            ) : (
              <div>
                <span className={styles.timerIdle}>
                  {otherActiveTask
                    ? `Logging: ${otherActiveTask.title}`
                    : 'Unlogged'}
                </span>
                {otherActiveTask && (
                  <p className={styles.timerNote}>Starting this will switch from that task</p>
                )}
              </div>
            )}
            <button
              className={styles.btnPrimary}
              style={
                thisTaskIsActive
                  ? { background: '#ef4444', borderColor: '#ef4444' }
                  : { background: task.color, borderColor: task.color }
              }
              onClick={handleStartStop}
            >
              {thisTaskIsActive ? 'Stop' : 'Start'}
            </button>
          </div>

          {/* Log list */}
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
                    {log.endTime ? format(log.endTime, 'h:mm a') : (
                      <span style={{ color: '#22c55e' }}>running</span>
                    )}
                  </span>
                </div>
                <div className={styles.logDuration}>
                  {formatElapsed(log.startTime, log.endTime)}
                </div>
                <button
                  className={styles.logDeleteBtn}
                  onClick={() => deleteTimeLog(log.id)}
                  aria-label="Delete log"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.footer}>
          <div style={{ flex: 1 }} />
          <button className={styles.btnSecondary} onClick={closeModal}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
