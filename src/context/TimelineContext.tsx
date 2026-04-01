import React, { createContext, useContext, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../store/useAppStore';

interface TimelineContextValue {
  timestampToX: (ts: number) => number;
  xToTimestamp: (x: number) => number;
  msToWidth: (ms: number) => number;
  widthToMs: (w: number) => number;
  visibleStartTime: () => number;
  visibleEndTime: (viewportWidth: number) => number;
}

const TimelineContext = createContext<TimelineContextValue | null>(null);

export function TimelineProvider({ children }: { children: React.ReactNode }) {
  const { anchorTime, pxPerMs, scrollOffsetPx } = useAppStore(
    useShallow((s) => ({
      anchorTime: s.ui.anchorTime,
      pxPerMs: s.ui.pxPerMs,
      scrollOffsetPx: s.ui.scrollOffsetPx,
    }))
  );

  const value = useMemo<TimelineContextValue>(() => ({
    timestampToX: (ts) => (ts - anchorTime) * pxPerMs - scrollOffsetPx,
    xToTimestamp: (x) => anchorTime + (x + scrollOffsetPx) / pxPerMs,
    msToWidth: (ms) => ms * pxPerMs,
    widthToMs: (w) => w / pxPerMs,
    visibleStartTime: () => anchorTime + scrollOffsetPx / pxPerMs,
    visibleEndTime: (viewportWidth) =>
      anchorTime + (scrollOffsetPx + viewportWidth) / pxPerMs,
  }), [anchorTime, pxPerMs, scrollOffsetPx]);

  return (
    <TimelineContext.Provider value={value}>
      {children}
    </TimelineContext.Provider>
  );
}

export function useTimeline() {
  const ctx = useContext(TimelineContext);
  if (!ctx) throw new Error('useTimeline must be used within TimelineProvider');
  return ctx;
}
