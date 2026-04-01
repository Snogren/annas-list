import { TimelineProvider } from '../../context/TimelineContext';
import { TimelineHeader } from './TimelineHeader';
import { TimelineGrid } from './TimelineGrid';
import styles from './Timeline.module.css';

export function Timeline() {
  return (
    <TimelineProvider>
      <div className={styles.timeline}>
        <TimelineHeader />
        <TimelineGrid />
      </div>
    </TimelineProvider>
  );
}
