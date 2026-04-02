import React, { createContext, useContext, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../store/useAppStore';

interface TimelineContextValue {
  timestampToY: (ts: number) => number;
  yToTimestamp: (y: number) => number;
  msToPx: (ms: number) => number;
  pxToMs: (px: number) => number;
  visibleStartTime: () => number;
  visibleEndTime: (viewportHeight: number) => number;
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
    timestampToY: (ts) => (ts - anchorTime) * pxPerMs - scrollOffsetPx,
    yToTimestamp: (y) => anchorTime + (y + scrollOffsetPx) / pxPerMs,
    msToPx: (ms) => ms * pxPerMs,
    pxToMs: (px) => px / pxPerMs,
    visibleStartTime: () => anchorTime + scrollOffsetPx / pxPerMs,
    visibleEndTime: (viewportHeight) =>
      anchorTime + (scrollOffsetPx + viewportHeight) / pxPerMs,
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
