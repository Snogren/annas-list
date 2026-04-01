import { useRef, useEffect, useState } from 'react';
import {
  eachHourOfInterval,
  eachDayOfInterval,
  format,
  isSameDay,
} from 'date-fns';
import { useTimeline } from '../../context/TimelineContext';
import styles from './TimelineHeader.module.css';

const HOUR_MIN_PX = 40;

export function TimelineHeader() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(window.innerWidth);
  const { timestampToX, visibleStartTime, visibleEndTime, msToWidth } = useTimeline();

  useEffect(() => {
    const obs = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const startTs = visibleStartTime();
  const endTs = visibleEndTime(width);
  const hourMs = 60 * 60 * 1000;
  const hourWidth = msToWidth(hourMs);

  // Decide tick density based on zoom
  const showHours = hourWidth >= HOUR_MIN_PX;

  const days = eachDayOfInterval({
    start: new Date(startTs - 24 * hourMs),
    end: new Date(endTs + 24 * hourMs),
  });

  const hours = showHours
    ? eachHourOfInterval({
        start: new Date(startTs - hourMs),
        end: new Date(endTs + hourMs),
      })
    : [];

  const today = new Date();

  return (
    <div className={styles.header} ref={containerRef}>
      {/* Day labels */}
      {days.map((day) => {
        const x = timestampToX(day.getTime());
        const dayWidth = msToWidth(24 * hourMs);
        if (x + dayWidth < 0 || x > width) return null;
        return (
          <div
            key={day.getTime()}
            className={`${styles.dayLabel} ${isSameDay(day, today) ? styles.today : ''}`}
            style={{ left: x, width: dayWidth }}
          >
            <span className={styles.dayText}>{format(day, 'EEE, MMM d')}</span>
          </div>
        );
      })}

      {/* Hour ticks */}
      {hours.map((hour) => {
        const x = timestampToX(hour.getTime());
        if (x < -60 || x > width + 60) return null;
        const isStartOfDay = hour.getHours() === 0;
        return (
          <div
            key={hour.getTime()}
            className={`${styles.hourTick} ${isStartOfDay ? styles.dayBoundary : ''}`}
            style={{ left: x }}
          >
            <span className={styles.hourText}>
              {isStartOfDay ? '' : format(hour, 'h a')}
            </span>
          </div>
        );
      })}
    </div>
  );
}
