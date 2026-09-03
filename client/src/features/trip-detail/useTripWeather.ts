import { useEffect, useMemo, useState } from "react";
import type { Trip, WeatherDay } from "../../types";
import { weatherApi } from "../../api";
import { getLatLngbyAddress } from "../../utils/tencentMap";

/** 天气锚点：住宿 → 日程项 → 目的地地理编码，单点定义避免双写 */
function pickWeatherAnchor(trip: Trip): {
  key: string;
  lat?: number;
  lng?: number;
  needGeocode: boolean;
} {
  const acc = trip.accommodations?.find((a) => a.lat && a.lng);
  if (acc) return { key: `acc:${acc.id}:${acc.lat}:${acc.lng}`, lat: acc.lat, lng: acc.lng, needGeocode: false };
  const item = trip.schedules
    ?.flatMap((s) => s.items || [])
    .find((i) => i.lat && i.lng);
  if (item) return { key: `item:${item.id}:${item.lat}:${item.lng}`, lat: item.lat, lng: item.lng, needGeocode: false };
  if (trip.destination) return { key: `dest:${trip.destination}`, needGeocode: true };
  return { key: "", needGeocode: false };
}

/** 目的地逐日天气；坐标指纹 + 日期区间变化时重拉，失败静默降级 */
export function useTripWeather(trip: Trip | null) {
  const [weatherByDate, setWeatherByDate] = useState<Record<string, WeatherDay>>({});

  const anchor = useMemo(() => (trip ? pickWeatherAnchor(trip) : null), [trip]);
  const dateKey = `${trip?.startDate ?? ""}|${trip?.endDate ?? ""}`;

  useEffect(() => {
    if (!trip || !anchor || !anchor.key) return;
    let cancelled = false;
    (async () => {
      let { lat, lng } = anchor;
      if (anchor.needGeocode && trip.destination) {
        const g = await getLatLngbyAddress(trip.destination);
        if (g) {
          lat = g.lat;
          lng = g.lng;
        }
      }
      if (lat == null || lng == null) return;
      try {
        const days = await weatherApi.daily({
          lat,
          lng,
          start: trip.startDate,
          end: trip.endDate,
        });
        if (cancelled) return;
        const map: Record<string, WeatherDay> = {};
        days.forEach((d) => {
          map[d.date] = d;
        });
        setWeatherByDate(map);
      } catch {
        // 静默降级：不阻塞主流程
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [anchor, dateKey, trip]);

  return weatherByDate;
}
