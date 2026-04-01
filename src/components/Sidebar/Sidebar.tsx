import { useState, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { startOfDay, subDays } from 'date-fns';
import { useAppStore } from '../../store/useAppStore';
import type { TimeLogKind } from '../../types';
import styles from './Sidebar.module.css';

type Range = 'today' | '7d' | 'all';

const RANGE_LABELS: Record<Range, string> = {
  today: 'Today',
  '7d': '7 Days',
  all: 'All',
};

function rangeStart(range: Range): number {
  const now = Date.now();
  if (range === 'today') return startOfDay(now).getTime();
  if (range === '7d') return subDays(startOfDay(now), 6).getTime();
  return 0;
}

function fmtDuration(ms: number): string {
  if (ms <= 0) return '0m';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

const BUILTIN_KINDS: { kind: Exclude<TimeLogKind, 'task'>; label: string; color: string }[] = [
  { kind: 'life',       label: 'Life',       color: '#22c55e' },
  { kind: 'distracted', label: 'Distracted', color: '#f97316' },
  { kind: 'unlogged',   label: 'Unlogged',   color: 'var(--text-muted)' },
];

export function Sidebar() {
  const { tasks, timeLogs } = useAppStore(
    useShallow((s) => ({ tasks: s.tasks, timeLogs: s.timeLogs }))
  );

  const [range, setRange] = useState<Range>('today');
  const [, setTick] = useState(0);

  // Re-render every 10s to keep running totals live
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  const cutoff = rangeStart(range);
  const now = Date.now();

  // Compute ms per task (only 'task' kind logs)
  const taskMs: Record<string, number> = {};
  for (const log of Object.values(timeLogs)) {
    if (log.kind !== 'task' || !log.taskId) continue;
    const start = Math.max(log.startTime, cutoff);
    const end = log.endTime ?? now;
    if (end <= cutoff) continue;
    const duration = Math.max(0, end - start);
    taskMs[log.taskId] = (taskMs[log.taskId] ?? 0) + duration;
  }

  // Compute ms per builtin kind
  const kindMs: Record<string, number> = {};
  for (const log of Object.values(timeLogs)) {
    if (log.kind === 'task') continue;
    const start = Math.max(log.startTime, cutoff);
    const end = log.endTime ?? now;
    if (end <= cutoff) continue;
    kindMs[log.kind] = (kindMs[log.kind] ?? 0) + Math.max(0, end - start);
  }

  // Sort tasks by time desc, include only those with time or all tasks
  const taskRows = Object.values(tasks)
    .map((t) => ({ task: t, ms: taskMs[t.id] ?? 0 }))
    .filter((r) => r.ms > 0)
    .sort((a, b) => b.ms - a.ms);

  const totalMs =
    Object.values(taskMs).reduce((s, v) => s + v, 0) +
    Object.values(kindMs).reduce((s, v) => s + v, 0);

  const bar = (ms: number) =>
    totalMs > 0 ? Math.max(2, Math.round((ms / totalMs) * 100)) : 0;

  return (
    <div className={styles.sidebar}>
      <div className={styles.header}>
        <span className={styles.title}>Time Log</span>
        <div className={styles.rangeTabs}>
          {(Object.keys(RANGE_LABELS) as Range[]).map((r) => (
            <button
              key={r}
              className={`${styles.rangeTab} ${range === r ? styles.rangeTabActive : ''}`}
              onClick={() => setRange(r)}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.body}>
        {totalMs === 0 && (
          <p className={styles.empty}>No time logged{range !== 'all' ? ' in this period' : ''}.</p>
        )}

        {/* Task rows */}
        {taskRows.length > 0 && (
          <section className={styles.section}>
            <h3 className={styles.sectionLabel}>Tasks</h3>
            {taskRows.map(({ task, ms }) => (
              <div key={task.id} className={styles.row}>
                <span className={styles.dot} style={{ background: task.color }} />
                <span className={styles.rowLabel} title={task.title}>{task.title}</span>
                <div className={styles.barTrack}>
                  <div
                    className={styles.barFill}
                    style={{ width: `${bar(ms)}%`, background: task.color }}
                  />
                </div>
                <span className={styles.rowTime}>{fmtDuration(ms)}</span>
              </div>
            ))}
          </section>
        )}

        {/* Built-in kind rows */}
        {BUILTIN_KINDS.some((k) => (kindMs[k.kind] ?? 0) > 0) && (
          <section className={styles.section}>
            <h3 className={styles.sectionLabel}>Other</h3>
            {BUILTIN_KINDS.map(({ kind, label, color }) => {
              const ms = kindMs[kind] ?? 0;
              if (ms === 0) return null;
              return (
                <div key={kind} className={styles.row}>
                  <span className={styles.dot} style={{ background: color }} />
                  <span className={styles.rowLabel}>{label}</span>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFill}
                      style={{ width: `${bar(ms)}%`, background: color }}
                    />
                  </div>
                  <span className={styles.rowTime}>{fmtDuration(ms)}</span>
                </div>
              );
            })}
          </section>
        )}

        {/* Total */}
        {totalMs > 0 && (
          <div className={styles.total}>
            <span>Total</span>
            <span>{fmtDuration(totalMs)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
