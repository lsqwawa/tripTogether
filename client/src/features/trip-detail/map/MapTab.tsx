import { useMemo, useState } from "react";
import { Select } from "antd";
import type { Trip } from "../../../types";
import MapView, { DAY_COLORS, toIntercitySegments } from "../../../components/MapView";
import type { MapLocation } from "../../../components/MapView";

interface MapTabProps {
  trip: Trip;
}

export default function MapTab({ trip }: MapTabProps) {
  const [filterDay, setFilterDay] = useState<number | "all">("all");
  const [showLines, setShowLines] = useState(true);
  const [showIntercity, setShowIntercity] = useState(true);
  const [showHotels, setShowHotels] = useState(true);
  const [showSchedule, setShowSchedule] = useState(true);
  const [clusterByDate, setClusterByDate] = useState(false);

  // 城际交通段（6.10）：坐标齐全的段画跨城蓝线；按单天筛选时不显示
  const intercity = useMemo(
    () => toIntercitySegments(trip.transportations),
    [trip.transportations]
  );

  // 按天收集坐标；住宿保留 dayIndex 供按天筛选展示，但不参与连线
  const allLocations = useMemo<MapLocation[]>(() => {
    const dayMap = new Map<number, MapLocation[]>();
    const dayDateMap = new Map<number, string>();
    trip.schedules?.forEach((s) => {
      dayDateMap.set(s.dayIndex, s.date);
      [...(s.items || [])]
        .sort(
          (x, y) =>
            (x.sortOrder ?? 0) - (y.sortOrder ?? 0) ||
            String(x.startTime || "").localeCompare(String(y.startTime || ""))
        )
        .forEach((item) => {
          if (item.lat && item.lng) {
            const arr = dayMap.get(s.dayIndex) || [];
            arr.push({
              lat: item.lat,
              lng: item.lng,
              title: item.title,
              dayIndex: s.dayIndex,
              type: item.type,
              date: dayDateMap.get(s.dayIndex),
            });
            dayMap.set(s.dayIndex, arr);
          }
        });
    });
    trip.accommodations?.forEach((a) => {
      if (!(a.lat && a.lng)) return;
      let targetDay: number | undefined;
      dayDateMap.forEach((date, day) => {
        if (date && a.checkInDate && date.slice(0, 10) === a.checkInDate.slice(0, 10))
          targetDay = day;
      });
      const loc: MapLocation = {
        lat: a.lat,
        lng: a.lng,
        title: a.name,
        dayIndex: targetDay ?? 0,
        type: "hotel",
      };
      const key = targetDay ?? 0;
      const arr = dayMap.get(key) || [];
      arr.push(loc);
      dayMap.set(key, arr);
    });
    const sortedDays = [...dayMap.keys()].sort((x, y) => x - y);
    return sortedDays.flatMap((d) => dayMap.get(d)!);
  }, [trip.schedules, trip.accommodations]);

  const dayOptions = trip.schedules?.map((s) => s.dayIndex) || [];
  const filtered = useMemo<MapLocation[]>(() => {
    let list =
      filterDay === "all"
        ? allLocations
        : allLocations.filter((l) => (l.dayIndex || 0) === filterDay);
    if (!showSchedule) list = list.filter((l) => l.type === "hotel");
    if (!showHotels) list = list.filter((l) => l.type !== "hotel");
    return list;
  }, [allLocations, filterDay, showSchedule, showHotels]);

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <Select value={filterDay} onChange={(v) => setFilterDay(v)} style={{ width: 160 }}>
          <Select.Option value="all">全部天数</Select.Option>
          {dayOptions.map((d) => (
            <Select.Option key={d} value={d}>
              第{d}天
            </Select.Option>
          ))}
        </Select>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={showLines}
            onChange={(e) => setShowLines(e.target.checked)}
          />
          显示路线连线
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={showIntercity}
            onChange={(e) => setShowIntercity(e.target.checked)}
          />
          显示交通信息
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={showHotels}
            onChange={(e) => setShowHotels(e.target.checked)}
          />
          显示住宿点
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={showSchedule}
            onChange={(e) => setShowSchedule(e.target.checked)}
          />
          显示日程
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={clusterByDate}
            onChange={(e) => setClusterByDate(e.target.checked)}
          />
          按日期聚合
        </label>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginLeft: "auto" }}>
          {intercity.length > 0 && (
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
              <span style={{ width: 16, height: 0, borderTop: "3px solid #2f54eb" }} />
              城际移动
            </span>
          )}
          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
            <span style={{ width: 16, height: 0, borderTop: "2px dashed #8c8c8c" }} />
            跨天移动
          </span>
          {trip.accommodations?.some((a) => a.lat && a.lng) && (
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
              <span style={{ fontSize: 13, lineHeight: "16px" }}>{"\u{1F3E8}"}</span>
              住宿（只标点）
            </span>
          )}
          {dayOptions.map((d) => (
            <span
              key={d}
              style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: DAY_COLORS[(d - 1) % DAY_COLORS.length],
                }}
              />
              第{d}天
            </span>
          ))}
        </div>
      </div>
      <MapView
        locations={filtered}
        showPolylines={showLines}
        intercity={filterDay === "all" ? intercity : []}
        showIntercity={showIntercity && showSchedule}
        cluster={clusterByDate}
      />
    </div>
  );
}
