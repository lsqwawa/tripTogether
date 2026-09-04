import type { Trip } from "../../types";
import type { MapLocation } from "../../components/MapView";

/** 收集行程中所有有坐标的地点（住宿 + 日程项），供总览/分享页地图共用 */
export function collectTripLocations(trip: Trip): MapLocation[] {
  const locs: MapLocation[] = [];

  trip.accommodations?.forEach((a) => {
    if (a.lat && a.lng) {
      locs.push({ lat: a.lat, lng: a.lng, title: a.name, type: "hotel" });
    }
  });

  trip.schedules?.forEach((s) => {
    s.items?.forEach((item) => {
      if (item.lat && item.lng) {
        locs.push({
          lat: item.lat,
          lng: item.lng,
          title: item.title,
          dayIndex: s.dayIndex,
          type: item.type,
          date: s.date,
        });
      }
    });
  });

  return locs;
}
