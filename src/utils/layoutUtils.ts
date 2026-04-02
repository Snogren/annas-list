import type { SessionId } from '../types';

interface Slottable {
  id: string;
  startTime: number;
  durationMs: number;
}

export function assignLanes(items: Slottable[]): Map<SessionId, number> {
  const sorted = [...items].sort((a, b) => a.startTime - b.startTime);
  const laneEndTimes: number[] = [];
  const result = new Map<string, number>();

  for (const item of sorted) {
    const endTime = item.startTime + item.durationMs;
    const freeLane = laneEndTimes.findIndex((t) => t <= item.startTime);
    const lane = freeLane === -1 ? laneEndTimes.length : freeLane;
    laneEndTimes[lane] = endTime;
    result.set(item.id, lane);
  }
  return result;
}
