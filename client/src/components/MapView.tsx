import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { loadTencentMap, getTMap, hexToRgbNum, TENCENT_MAP_KEY, getCachedRoadPath } from "../utils/tencentMap";

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

// 创建自定义 marker DOM 元素（彩色圆形 pin + 天数编号）
function createMarkerDom(color: string, label: string): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText =
    "width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);" +
    "background:" + color + ";border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);" +
    "display:flex;align-items:center;justify-content:center;";
  const span = document.createElement("span");
  span.style.cssText =
    "transform:rotate(45deg);color:#fff;font-size:11px;font-weight:700;font-family:-apple-system,sans-serif;";
  span.textContent = label;
  el.appendChild(span);
  return el;
}

interface Props {
  locations: MapLocation[];
  showPolylines?: boolean;
}

// 路线生长动画：渐进 reveal 每个 polyline 的顶点
function animatePolylines(
  polylines: any,
  fullGeoms: any[],
  layersRef: MutableRefObject<any>,
  token: number
) {
  const FPS = 30;
  const DUR = 700;
  const frames = Math.ceil((FPS * DUR) / 1000);
  let f = 0;
  const timer = setInterval(() => {
    if (token !== layersRef.current.token) {
      clearInterval(timer);
      return;
    }
    f++;
    const p = Math.min(1, f / frames);
    const geoms = fullGeoms.map((g) => ({
      id: g.id,
      styleId: g.styleId,
      paths: g.paths.slice(0, Math.max(2, Math.ceil(g.paths.length * p))),
    }));
    try {
      polylines.setGeometries(geoms);
    } catch (e) {
      /* ignore */
    }
    if (f >= frames) {
      clearInterval(timer);
      if (layersRef.current.token === token) layersRef.current.animTimer = null;
    }
  }, 1000 / FPS);
  layersRef.current.animTimer = timer;
}

async function renderLocations(
  TMap: any,
  map: any,
  locations: MapLocation[],
  showPolylines: boolean,
  layersRef: MutableRefObject<any>
) {
  const token = (layersRef.current.token || 0) + 1;
  layersRef.current.token = token;

  // 清掉旧图层
  const old = layersRef.current || {};
  if (old.markerList) {
    old.markerList.forEach((m: any) => m.setMap(null));
  }
  if (old.polylines) old.polylines.setMap(null);
  if (old.infoWindow) old.infoWindow.setMap(null);
  if (old.animTimer) clearInterval(old.animTimer);

  if (!locations || locations.length === 0) {
    layersRef.current = { token };
    return;
  }

  const bounds = new TMap.LatLngBounds();
  const markerList: any[] = [];

  // 按天分组（用于连点成线），day>=1 才参与当天连线
  const dayMap: Record<number, MapLocation[]> = {};

  // 逐个创建 Marker（用 DOM overlay 确保自定义样式可靠渲染）
  locations.forEach((loc, idx) => {
    const day = loc.dayIndex || 0;
    let color: string;
    let label: string;

    if (loc.type === "hotel") {
      color = "#722ed1";
      label = "\u{1F3E8}"; // 🏨
    } else {
      color = day > 0 ? DAY_COLORS[(day - 1) % DAY_COLORS.length] : "#8c8c8c";
      label = day > 0 ? String(day) : "\u{1F4CD}"; // 📍
    }

    const dom = createMarkerDom(color, label);
    const marker = new TMap.Marker({
      map,
      position: new TMap.LatLng(loc.lat, loc.lng),
      content: dom,
      offset: { x: -14, y: -28 }, // 居中偏上（28px 高度）
      zIndex: loc.type === "hotel" ? 20 : 10 + (day || 0),
    });

    // 点击弹出信息窗口
    marker.on("click", () => {
      openInfo(TMap, map, layersRef, {
        lat: loc.lat,
        lng: loc.lng,
        title: loc.title,
        day,
        type: loc.type,
      });
    });

    markerList.push(marker);
    bounds.extend(new TMap.LatLng(loc.lat, loc.lng));

    if (day > 0) {
      if (!dayMap[day]) dayMap[day] = [];
      dayMap[day].push(loc);
    }
  });

  layersRef.current = { ...layersRef.current, markerList, infoWindow: old.infoWindow, token };
  if (locations.length > 1) map.fitBounds(bounds, { padding: 80 });

  if (!showPolylines) return;

  // 收集需要绘制的线段
  type Seg = {
    day: number;
    colorNum: number;
    a: { lat: number; lng: number };
    b: { lat: number; lng: number };
    straight?: boolean;
  };
  const segs: Seg[] = [];

  // 1) 当天内的相邻点 → 真实路径
  Object.keys(dayMap)
    .map(Number)
    .sort((a, b) => a - b)
    .forEach((day) => {
      const dl = dayMap[day];
      const colorNum = hexToRgbNum(DAY_COLORS[(day - 1) % DAY_COLORS.length]);
      for (let i = 0; i < dl.length - 1; i++) {
        segs.push({ day, colorNum, a: dl[i], b: dl[i + 1] });
      }
    });

  // 2) 跨天移动：相邻行程天「最后一点 → 次日首点」用中性灰虚线（直线）
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
    segs.push({
      day: days[i],
      colorNum: hexToRgbNum(CROSS_DAY_COLOR),
      a: { lat: last.lat, lng: last.lng },
      b: { lat: first.lat, lng: first.lng },
      straight: true,
    });
  }

  // 拉取真实路径（直线段跳过）；有界并发：最多 4 个同时请求，避免突破 5 QPS
  const MAX_CONCURRENT = 4;
  for (let i = 0; i < segs.length; i += MAX_CONCURRENT) {
    const batch = segs.slice(i, i + MAX_CONCURRENT).filter((s) => !s.straight);
    await Promise.all(
      batch.map(async (s) => {
        (s as any).points = await getCachedRoadPath(TMap, s.a, s.b);
      })
    );
    if (token !== layersRef.current.token) return;
  }

  // 构建 polyline 几何
  const polyGeoms: any[] = [];
  const polyStyles: any = {};
  segs.forEach((s, i) => {
    const pts: { lat: number; lng: number }[] = (s as any).points || [s.a, s.b];
    const sid = s.straight ? "xd" : `p${s.day}_${i}`;
    if (!polyStyles[sid]) {
      polyStyles[sid] = new TMap.PolylineStyle({
        color: s.colorNum,
        width: s.straight ? 3 : 4,
        lineDash: s.straight ? [4, 6] : undefined as any,
        borderWidth: 0,
      });
    }
    polyGeoms.push({
      id: `pl${i}`,
      styleId: sid,
      paths: pts.map((p) => new TMap.LatLng(p.lat, p.lng)),
    });
  });

  if (polyGeoms.length === 0) return;

  const polylines = new TMap.MultiPolyline({ map, geometries: polyGeoms, styles: polyStyles });
  layersRef.current = { ...layersRef.current, polylines, token };

  // 路线生长动画
  animatePolylines(polylines, polyGeoms, layersRef, token);
}

function openInfo(
  TMap: any,
  map: any,
  layersRef: MutableRefObject<any>,
  info: { lat: number; lng: number; title: string; day?: number; type?: string }
) {
  if (layersRef.current.infoWindow) layersRef.current.infoWindow.setMap(null);
  const tag = info.type === "hotel" ? "\u{1F3E8} \u4F4F\u5BBF" : info.day ? "\u7B2C" + info.day + "\u5929" : "";
  const iw = new TMap.InfoWindow({
    map,
    position: new TMap.LatLng(info.lat, info.lng),
    content:
      '<div style="padding:6px 8px;font-size:13px;max-width:200px;"><b>' +
      escapeHtml(info.title) +
      "</b>" +
      (tag ? "<br/>" + tag : "") +
      "</div>",
    offset: { x: 0, y: -28 },
  });
  layersRef.current.infoWindow = iw;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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
          setError("\u817E\u8BAF\u5730\u56FE\u52A0\u8F7D\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5 Key \u4E0E\u6388\u6743\u57DF\u540D\uFF08Referer \u767D\u540D\u5355\uFF09\u914D\u7F6E");
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
    // 浅色/简约底图样式（预设 style3=白浅）
    try {
      if (typeof map.setMapStyle === "function") map.setMapStyle("style3");
      else if (typeof map.setMapStyleId === "function") map.setMapStyleId("style3");
    } catch (e) {
      /* 样式不可用则保持默认底图 */
    }
    mapRef.current = map;
    setTimeout(() => map.resize?.(), 0);
    return () => {
      map.destroy?.();
      mapRef.current = null;
      layersRef.current = {};
    };
  }, [ready, hasLocs]);

  // 坐标变化时刷新图层（异步拉取真实路径）
  useEffect(() => {
    const map = mapRef.current;
    const TMap = getTMap();
    if (!map || !TMap || !hasLocs) return;
    renderLocations(TMap, map, locations, showPolylines, layersRef).catch((e) =>
      console.error("[MapView] \u6E32\u67D3\u5931\u8D25:", e)
    );
    return () => {
      if (layersRef.current.animTimer) {
        clearInterval(layersRef.current.animTimer);
        layersRef.current.animTimer = null;
      }
    };
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
        \u6682\u65E0\u5730\u70B9\u5750\u6807\u6570\u636E\u3002\u5728\u65E5\u7A0B\u9879\u6216\u4F4F\u5BBF\u4E2D\u901A\u8FC7\u300C\u641C\u7D22\u5B9A\u4F4D\u300D\u6216\u300C\u5730\u56FE\u9009\u70B9\u300D\u586B\u5199\u5730\u70B9\u540E\u5373\u53EF\u67E5\u770B\u5730\u56FE\u8DEF\u7EBF\u3002
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
