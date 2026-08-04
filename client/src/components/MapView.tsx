import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { loadTencentMap, getTMap, hexToRgbNum } from "../utils/tencentMap";

export interface MapLocation {
  lat: number;
  lng: number;
  title: string;
  dayIndex?: number;
  type?: string;
}

// 按天不同颜色，供地图标注、连线与图例共用
export const DAY_COLORS = [
  "#1677ff",
  "#52c41a",
  "#fa8c16",
  "#eb2f96",
  "#722ed1",
  "#13c2c2",
  "#f5222d",
  "#faad14",
];

// 跨天移动轨迹线（中性灰虚线）
const CROSS_DAY_COLOR = "#8c8c8c";

function pinHtml(color: string, label: string): string {
  return `<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;"><span style="transform:rotate(45deg);color:#fff;font-size:11px;font-weight:700;">${label}</span></div>`;
}

interface Props {
  locations: MapLocation[];
  showPolylines?: boolean;
}

function renderLocations(
  TMap: any,
  map: any,
  locations: MapLocation[],
  showPolylines: boolean,
  layersRef: MutableRefObject<any>
) {
  const old = layersRef.current;
  if (old.markers) old.markers.setMap(null);
  if (old.polylines) old.polylines.setMap(null);
  if (old.infoWindow) old.infoWindow.setMap(null);

  if (!locations || locations.length === 0) {
    layersRef.current = {};
    return;
  }

  const bounds = new TMap.LatLngBounds();
  const geometries: any[] = [];
  const styles: any = {};
  // 住宿专属标记样式
  styles["hotel"] = new TMap.MarkerStyle({
    width: 30,
    height: 30,
    anchor: { x: 15, y: 30 },
    content: pinHtml("#722ed1", "🏨"),
  });

  // 按天分组（用于连点成线），day>=1 才参与当天连线
  const dayMap: Record<number, MapLocation[]> = {};

  locations.forEach((loc, idx) => {
    const day = loc.dayIndex || 0;
    let styleId: string;
    if (loc.type === "hotel") {
      styleId = "hotel";
    } else {
      const color = day > 0 ? DAY_COLORS[(day - 1) % DAY_COLORS.length] : "#8c8c8c";
      styleId = `d${day}`;
      if (!styles[styleId]) {
        styles[styleId] = new TMap.MarkerStyle({
          width: 30,
          height: 30,
          anchor: { x: 15, y: 30 },
          content: pinHtml(color, day > 0 ? String(day) : "📍"),
        });
      }
    }
    geometries.push({
      id: `m${idx}`,
      styleId,
      position: new TMap.LatLng(loc.lat, loc.lng),
      properties: { title: loc.title, day, type: loc.type },
    });
    bounds.extend(new TMap.LatLng(loc.lat, loc.lng));
    if (day > 0) {
      if (!dayMap[day]) dayMap[day] = [];
      dayMap[day].push(loc);
    }
  });

  const markers = new TMap.MultiMarker({ map, geometries, styles });

  markers.on("click", (e: any) => {
    const g = e.geometry;
    if (!g) return;
    const props = g.properties || {};
    openInfo(TMap, map, layersRef, {
      lat: g.position.lat,
      lng: g.position.lng,
      title: props.title,
      day: props.day,
      type: props.type,
    });
  });

  let polylines: any = null;
  if (showPolylines) {
    const polyGeoms: any[] = [];
    const polyStyles: any = {};

    // 1) 当天内的点连成当日彩色线
    Object.keys(dayMap)
      .map(Number)
      .sort((a, b) => a - b)
      .forEach((day) => {
        const dl = dayMap[day];
        if (dl.length < 2) return;
        const color = DAY_COLORS[(day - 1) % DAY_COLORS.length];
        const sid = `p${day}`;
        polyStyles[sid] = new TMap.PolylineStyle({
          color: hexToRgbNum(color),
          width: 4,
          lineDash: [8, 6],
          borderWidth: 0,
        });
        polyGeoms.push({
          id: `pl${day}`,
          styleId: sid,
          paths: dl.map((l) => new TMap.LatLng(l.lat, l.lng)),
        });
      });

    // 2) 跨天移动：相邻行程天「最后一点 → 次日首点」用中性灰虚线串联
    const days = Object.keys(dayMap)
      .map(Number)
      .filter((d) => d >= 1)
      .sort((a, b) => a - b);
    for (let i = 0; i < days.length - 1; i++) {
      const cur = dayMap[days[i]];
      const next = dayMap[days[i + 1]];
      if (!cur.length || !next.length) continue;
      const last = cur[cur.length - 1];
      const first = next[0];
      polyStyles["xd"] = new TMap.PolylineStyle({
        color: hexToRgbNum(CROSS_DAY_COLOR),
        width: 3,
        lineDash: [4, 6],
        borderWidth: 0,
      });
      polyGeoms.push({
        id: `xd${days[i]}`,
        styleId: "xd",
        paths: [new TMap.LatLng(last.lat, last.lng), new TMap.LatLng(first.lat, first.lng)],
      });
    }

    if (polyGeoms.length > 0) {
      polylines = new TMap.MultiPolyline({ map, geometries: polyGeoms, styles: polyStyles });
    }
  }

  layersRef.current = { markers, polylines, infoWindow: layersRef.current.infoWindow };
  if (locations.length > 1) {
    map.fitBounds(bounds, 80);
  }
}

function openInfo(
  TMap: any,
  map: any,
  layersRef: MutableRefObject<any>,
  info: { lat: number; lng: number; title: string; day?: number; type?: string }
) {
  if (layersRef.current.infoWindow) layersRef.current.infoWindow.setMap(null);
  const tag = info.type === "hotel" ? "🏨 住宿" : info.day ? `第${info.day}天` : "";
  const iw = new TMap.InfoWindow({
    map,
    position: new TMap.LatLng(info.lat, info.lng),
    content: `<div style="padding:6px 8px;font-size:13px;max-width:200px;"><b>${info.title}</b>${tag ? `<br/>${tag}` : ""}</div>`,
    offset: { x: 0, y: -28 },
  });
  layersRef.current.infoWindow = iw;
}

export default function MapView({ locations, showPolylines = true }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layersRef = useRef<any>({});
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadTencentMap()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(() => {
        if (!cancelled)
          setError("腾讯地图加载失败，请检查 Key 与授权域名（Referer 白名单）配置");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const hasLocs = locations.length > 0;

  // 创建 / 销毁地图实例
  useEffect(() => {
    if (!ready || !hasLocs || !containerRef.current) return;
    const TMap = getTMap();
    if (!TMap) return;
    const first = locations[0];
    const map = new TMap.Map(containerRef.current, {
      center: new TMap.LatLng(first.lat, first.lng),
      zoom: 12,
      baseMap: { type: "vector" },
    });
    mapRef.current = map;
    setTimeout(() => map.resize?.(), 0);
    return () => {
      map.destroy?.();
      mapRef.current = null;
      layersRef.current = {};
    };
  }, [ready, hasLocs]);

  // 坐标变化时刷新图层
  useEffect(() => {
    const map = mapRef.current;
    const TMap = getTMap();
    if (!map || !TMap || !hasLocs) return;
    renderLocations(TMap, map, locations, showPolylines, layersRef);
  }, [locations, showPolylines, ready, hasLocs]);

  if (error) {
    return (
      <div
        style={{
          padding: 24,
          textAlign: "center",
          color: "#cf1322",
          background: "#fff1f0",
          borderRadius: 8,
        }}
      >
        {error}
      </div>
    );
  }

  if (!hasLocs) {
    return (
      <div
        style={{
          padding: 24,
          textAlign: "center",
          color: "#9ca3af",
          background: "#fafafa",
          borderRadius: 8,
        }}
      >
        暂无地点坐标数据。在日程项或住宿中通过「搜索定位」或「地图选点」填写地点后即可查看地图路线。
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        height: 420,
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid #f0f0f0",
        zIndex: 0,
      }}
    />
  );
}
