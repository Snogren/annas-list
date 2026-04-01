import type { Task, TaskId } from '../types';

export function assignLanes(tasks: Task[]): Map<TaskId, number> {
  const sorted = [...tasks].sort((a, b) => a.startTime - b.startTime);
  const laneEndTimes: number[] = [];
  const result = new Map<TaskId, number>();

  for (const task of sorted) {
    const endTime = task.startTime + task.durationMs;
    const freeLane = laneEndTimes.findIndex((t) => t <= task.startTime);
    const lane = freeLane === -1 ? laneEndTimes.length : freeLane;
    laneEndTimes[lane] = endTime;
    result.set(task.id, lane);
  }
  return result;
}
