import type { Trip } from "../entities/Trip";

/**
 * 按 dayIndex 与 sortOrder 对计划下的日程与日程项排序。
 * 抽出为公共函数，避免 tripRoutes 与 shareRoutes 重复同一段排序逻辑。
 */
export function sortTripSchedules(trip: Trip): void {
  trip.schedules?.sort((a, b) => a.dayIndex - b.dayIndex);
  trip.schedules?.forEach((s) => {
    s.items?.sort((a, b) => a.sortOrder - b.sortOrder);
  });
}
