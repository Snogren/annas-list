import { useRef, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { TimelineProvider } from '../../context/TimelineContext';
import { TimelineHeader } from './TimelineHeader';
import { TimelineGrid } from './TimelineGrid';
import { useAppStore } from '../../store/useAppStore';
import styles from './Timeline.module.css';

function TimelineInner() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { scrollOffsetPx, pxPerMs, setScrollOffset, setZoom } = useAppStore(
    useShallow((s) => ({
      scrollOffsetPx: s.ui.scrollOffsetPx,
      pxPerMs: s.ui.pxPerMs,
      setScrollOffset: s.setScrollOffset,
      setZoom: s.setZoom,
    }))
  );

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const zoomFactor = e.deltaY > 0 ? 0.85 : 1.18;
        const rect = el.getBoundingClientRect();
        setZoom(pxPerMs * zoomFactor, e.clientY - rect.top);
      } else {
        const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
        setScrollOffset(scrollOffsetPx + delta);
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [scrollOffsetPx, pxPerMs, setScrollOffset, setZoom]);

  return (
    <div ref={wrapperRef} className={styles.timeline}>
      <TimelineHeader />
      <TimelineGrid />
    </div>
  );
}

export function Timeline() {
  return (
    <TimelineProvider>
      <TimelineInner />
    </TimelineProvider>
  );
}
