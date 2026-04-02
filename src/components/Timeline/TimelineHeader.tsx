import { useRef, useEffect, useState } from 'react';
import {
  eachHourOfInterval,
  format,
  isSameDay,
  startOfDay,
} from 'date-fns';
import { useTimeline } from '../../context/TimelineContext';
import styles from './TimelineHeader.module.css';

const PX_PER_HOUR_MIN = 20; // below this, skip hour labels

export function TimelineHeader() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(window.innerHeight);
  const { timestampToY, visibleStartTime, visibleEndTime, msToPx } = useTimeline();

  useEffect(() => {
    const obs = new ResizeObserver((entries) => {
      setHeight(entries[0].contentRect.height);
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const startTs = visibleStartTime();
  const endTs = visibleEndTime(height);
  const hourMs = 60 * 60 * 1000;
  const hourPx = msToPx(hourMs);
  const showHours = hourPx >= PX_PER_HOUR_MIN;

  const hours = eachHourOfInterval({
    start: new Date(startTs - hourMs),
    end: new Date(endTs + hourMs),
  });

  const today = new Date();

  return (
    <div className={styles.ruler} ref={containerRef}>
      {hours.map((hour) => {
        const y = timestampToY(hour.getTime());
        if (y < -40 || y > height + 40) return null;
        const isStartOfDay = hour.getHours() === 0;
        const isToday = isSameDay(hour, today);

        return (
          <div
            key={hour.getTime()}
            className={`${styles.tick} ${isStartOfDay ? styles.dayTick : ''}`}
            style={{ top: y }}
          >
            {isStartOfDay ? (
              <span className={`${styles.dayLabel} ${isToday ? styles.today : ''}`}>
                {format(startOfDay(hour), 'MMM d')}
              </span>
            ) : (
              showHours && (
                <span className={styles.hourLabel}>
                  {format(hour, 'h a')}
                </span>
              )
            )}
          </div>
        );
      })}
    </div>
  );
}
