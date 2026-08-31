import { useEffect, useRef, useState, useMemo, type MutableRefObject } from "react";
import { loadTencentMap, getTMap, TENCENT_MAP_KEY, getCachedRoadPath } from "../utils/tencentMap";
import { STATUS_LABELS, type Transportation } from "../types";

export interface MapLocation {
  lat: number;
  lng: number;
  title: string;
  dayIndex?: number;
  type?: string;
}

// 城际交通段（6.10）：两端坐标齐全时才绘制跨城连线
export interface IntercitySegment {
  id: string;
  depLat: number;
  depLng: number;
  arrLat: number;
  arrLng: number;
  depName?: string;
  arrName?: string;
  transportType?: string;
  bookingInfo?: string;
  departureTime?: string;
  cost?: number;
  statusLabel?: string;
}

// 交通记录 → 城际段：仅两端坐标齐全的才参与跨城连线（避免把地名误画到错误位置）
export function toIntercitySegments(list?: Transportation[]): IntercitySegment[] {
  return (list || [])
    .filter(
      (t) =>
        t.depLat != null && t.depLng != null && t.arrLat != null && t.arrLng != null
    )
    .map((t) => ({
      id: t.id,
      depLat: t.depLat as number,
      depLng: t.depLng as number,
      arrLat: t.arrLat as number,
      arrLng: t.arrLng as number,
      depName: t.departurePlace,
      arrName: t.arrivalPlace,
      transportType: t.transportType,
      bookingInfo: t.bookingInfo,
      departureTime: t.departureTime
        ? t.departureTime.slice(5, 16).replace("T", " ")
        : undefined,
      cost: t.cost,
      statusLabel: STATUS_LABELS[t.status] || t.status,
    }));
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

// 城际交通跨城连线（深蓝实线，6.10）
export const INTERCITY_COLOR = "#2f54eb";

// 城际线绘制用 60% 透明度深蓝，衬托浅色箭头纹
const INTERCITY_LINE_COLOR = "rgba(47,84,235,0.6)";

// 生成水滴形 pin 的 SVG data-URI（颜色 + 标签文字）。
// 新版腾讯 GL SDK（v=1.exp）已移除独立 TMap.Marker 类，
// 标点统一走 MultiMarker + MarkerStyle 图片样式渲染。
function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pinDataUri(color: string, label: string): string {
  const fs = label.length >= 4 ? 9 : 11;
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="34" viewBox="0 0 28 34">' +
    '<path d="M14 1C7.1 1 1.5 6.6 1.5 13.5 1.5 22.6 14 33 14 33s12.5-10.4 12.5-19.5C26.5 6.6 20.9 1 14 1Z" fill="' +
    color +
    '" stroke="#ffffff" stroke-width="2"/>' +
    `<text x="14" y="18.5" text-anchor="middle" font-size="${fs}" font-weight="700" fill="#ffffff" font-family="-apple-system,sans-serif">` +
    escapeXml(label) +
    "</text>" +
    "</svg>";
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

// 飞行段的二次贝塞尔弧线路径：中点沿垂直方向抬升，贴近航线图视觉
function flightArcPath(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
  samples = 36
): { lat: number; lng: number }[] {
  const dx = b.lng - a.lng;
  const dy = b.lat - a.lat;
  const len = Math.hypot(dx, dy);
  if (len === 0) return [a, b];
  const lift = len * 0.18;
  const c = {
    lat: (a.lat + b.lat) / 2 + (dx / len) * lift,
    lng: (a.lng + b.lng) / 2 - (dy / len) * lift,
  };
  const pts: { lat: number; lng: number }[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const u = 1 - t;
    pts.push({
      lat: u * u * a.lat + 2 * u * t * c.lat + t * t * b.lat,
      lng: u * u * a.lng + 2 * u * t * c.lng + t * t * b.lng,
    });
  }
  return pts;
}

// 沿折线路径按比例 p(0~1) 线性插值取点（路径顶点按等参数采样，索引插值即可）
function pointAt(path: { lat: number; lng: number }[], p: number): { lat: number; lng: number } {
  if (path.length === 1) return path[0];
  const f = Math.min(1, Math.max(0, p)) * (path.length - 1);
  const i = Math.min(path.length - 2, Math.floor(f));
  const r = f - i;
  return {
    lat: path[i].lat + (path[i + 1].lat - path[i].lat) * r,
    lng: path[i].lng + (path[i + 1].lng - path[i].lng) * r,
  };
}

// a→b 的行进方位角（正北顺时针，角度制），用于旋转方向箭头
function bearingDeg(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const p1 = (a.lat * Math.PI) / 180;
  const p2 = (b.lat * Math.PI) / 180;
  const dl = ((b.lng - a.lng) * Math.PI) / 180;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// 导航箭头 SVG data-URI：默认朝北，rotate 为顺时针旋转角度
function arrowDataUri(color: string, rotate: number, size: number, stroke = "#ffffff"): string {
  const h = size / 2;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<path d="M${h} 1.5 L${size - 2} ${size - 3} L${h} ${size - 6} L2 ${size - 3} Z" fill="${color}" stroke="${stroke}" stroke-width="1.2" transform="rotate(${rotate} ${h} ${h})"/>` +
    "</svg>";
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

// 方位角 → 15° 分桶编号（预生成旋转样式，避免每帧新建 MarkerStyle）
function bearingBucket(deg: number): number {
  return ((Math.round(deg / 15) % 24) + 24) % 24;
}

interface Props {
  locations: MapLocation[];
  showPolylines?: boolean;
  intercity?: IntercitySegment[];
  showIntercity?: boolean;
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
  intercity: IntercitySegment[],
  showIntercity: boolean,
  layersRef: MutableRefObject<any>
) {
  const token = (layersRef.current.token || 0) + 1;
  layersRef.current.token = token;

  const icSegs = intercity || [];

  // 清理函数：清掉旧图层（在新图层构建完成前一刻才执行，避免中间态空图）
  const clearLayers = () => {
    const old = layersRef.current || {};
    if (old.markers) old.markers.setMap(null);
    if (old.polylines) old.polylines.setMap(null);
    if (old.chevrons) old.chevrons.setMap(null);
    if (old.infoWindow) old.infoWindow.setMap(null);
    if (old.animTimer) clearInterval(old.animTimer);
    return old;
  };

  if ((!locations || locations.length === 0) && icSegs.length === 0) {
    clearLayers();
    layersRef.current = { token };
    return;
  }

  const bounds = new TMap.LatLngBounds();

  // 按天分组（用于连点成线）：day>=1 且非住宿才参与当天连线（住宿只标点不连线）
  const dayMap: Record<number, MapLocation[]> = {};

  // MultiMarker 三件套：几何点、样式表、id→信息映射（点击时按 geometry.id 查）
  const geometries: any[] = [];
  const markerStyles: Record<string, any> = {};
  const infoById: Record<string, any> = {};
  const ensureStyle = (styleId: string, color: string, label: string) => {
    if (!markerStyles[styleId]) {
      markerStyles[styleId] = new TMap.MarkerStyle({
        src: pinDataUri(color, label),
        width: 28,
        height: 34,
      });
    }
  };

  // 当天内的先后序号（按 locations 数组顺序，父组件已按 sortOrder/startTime 排序）
  const daySeq: Record<number, number> = {};

  locations.forEach((loc, idx) => {
    const day = loc.dayIndex || 0;
    let styleId: string;
    let color: string;
    let label: string;

    if (loc.type === "hotel") {
      styleId = "hotel";
      color = "#722ed1";
      label = "\u{1F3E8}"; // 🏨
    } else if (day > 0) {
      const seq = (daySeq[day] = (daySeq[day] || 0) + 1);
      styleId = `day${(day - 1) % DAY_COLORS.length}_${seq}`;
      color = DAY_COLORS[(day - 1) % DAY_COLORS.length];
      label = `${day}.${seq}`;
    } else {
      styleId = "gray";
      color = "#8c8c8c";
      label = "\u{1F4CD}"; // 📍
    }

    ensureStyle(styleId, color, label);
    const gid = `loc_${idx}`;
    geometries.push({
      id: gid,
      styleId,
      position: new TMap.LatLng(loc.lat, loc.lng),
    });
    infoById[gid] = { lat: loc.lat, lng: loc.lng, title: loc.title, day, type: loc.type };
    bounds.extend(new TMap.LatLng(loc.lat, loc.lng));

    if (day > 0 && loc.type !== "hotel") {
      if (!dayMap[day]) dayMap[day] = [];
      dayMap[day].push(loc);
    }
  });

  // 城际交通起讫点标记（车站/机场图标），点击展示班次概要
  icSegs.forEach((seg, si) => {
    const icon =
      seg.transportType === "flight"
        ? "\u2708\uFE0F"
        : seg.transportType === "train"
          ? "\u{1F684}"
          : "\u{1F689}";
    ensureStyle(`ic_${seg.transportType || "other"}`, INTERCITY_COLOR, icon);
    const points: { lat: number; lng: number; name?: string; side: string }[] = [
      { lat: seg.depLat, lng: seg.depLng, name: seg.depName, side: "出发" },
      { lat: seg.arrLat, lng: seg.arrLng, name: seg.arrName, side: "到达" },
    ];
    points.forEach((p, pi) => {
      const gid = `ic_${si}_${pi}`;
      geometries.push({
        id: gid,
        styleId: `ic_${seg.transportType || "other"}`,
        position: new TMap.LatLng(p.lat, p.lng),
      });
      infoById[gid] = {
        lat: p.lat,
        lng: p.lng,
        title: `${seg.depName || "?"} \u2192 ${seg.arrName || "?"}`,
        tag: [
          p.side,
          seg.bookingInfo,
          seg.departureTime,
          seg.cost ? `\uFFE5${seg.cost}` : "",
          seg.statusLabel,
        ]
          .filter(Boolean)
          .join(" \u00B7 "),
      };
      bounds.extend(new TMap.LatLng(p.lat, p.lng));
    });
  });

  // 标点一次性挂载后，才清旧图层，避免「先清后画」造成空图闪烁
  const old = clearLayers();
  let markers: any = null;
  if (geometries.length > 0) {
    markers = new TMap.MultiMarker({ map, geometries, styles: markerStyles });
    markers.on("click", (evt: any) => {
      const gid = evt?.geometry?.id;
      const info = gid != null ? infoById[gid] : undefined;
      if (info) openInfo(TMap, map, layersRef, info);
    });
  }
  layersRef.current = { markers, infoWindow: old.infoWindow, token };
  if (locations.length + icSegs.length * 2 > 1) map.fitBounds(bounds, { padding: 80 });

  if (!showPolylines) return;

  // 收集需要绘制的线段
  type Seg = {
    day: number;
    color: string;
    a: { lat: number; lng: number };
    b: { lat: number; lng: number };
    straight?: boolean;
    kind?: "ic";
    path?: { lat: number; lng: number }[];
  };
  const segs: Seg[] = [];

  // 1) 当天内的相邻点 → 真实路径
  Object.keys(dayMap)
    .map(Number)
    .sort((a, b) => a - b)
    .forEach((day) => {
      const dl = dayMap[day];
      const color = DAY_COLORS[(day - 1) % DAY_COLORS.length];
      for (let i = 0; i < dl.length - 1; i++) {
        segs.push({ day, color, a: dl[i], b: dl[i + 1] });
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
      color: CROSS_DAY_COLOR,
      a: { lat: last.lat, lng: last.lng },
      b: { lat: first.lat, lng: first.lng },
      straight: true,
    });
  }

  // 3) 城际交通：两端坐标齐全的段画蓝色粗线；飞机走弧线（航线视觉），其余直线（6.10）
  if (showIntercity) {
    icSegs.forEach((seg) => {
      const a = { lat: seg.depLat, lng: seg.depLng };
      const b = { lat: seg.arrLat, lng: seg.arrLng };
      segs.push({
        day: 0,
        color: INTERCITY_LINE_COLOR,
        a,
        b,
        straight: true,
        kind: "ic",
        path: seg.transportType === "flight" ? flightArcPath(a, b) : [a, b],
      });
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
    const pts: { lat: number; lng: number }[] = s.path || (s as any).points || [s.a, s.b];
    const sid = s.kind === "ic" ? "ic" : s.straight ? "xd" : `p${s.day}_${i}`;
    if (!polyStyles[sid]) {
      const styleOpts: any = {
        color: s.color,
        width: sid === "ic" ? 5 : s.straight ? 3 : 4,
        borderWidth: 0,
      };
      if (s.straight && sid !== "ic") styleOpts.dashArray = [4, 6];
      polyStyles[sid] = new TMap.PolylineStyle(styleOpts);
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

  // 城际方向箭头纹：白色静态箭头沿线路每 20% 等距分布，朝向行进方向，直观体现起→终
  if (showIntercity && icSegs.length > 0) {
    const icPaths = segs.filter((s) => s.kind === "ic").map((s) => s.path || [s.a, s.b]);
    // 旋转样式按 15° 分桶预生成，避免重复创建 MarkerStyle
    const chevStyles: Record<string, any> = {};
    for (let b = 0; b < 24; b++) {
      chevStyles[`cb${b}`] = new TMap.MarkerStyle({
        src: arrowDataUri("rgba(47,84,235,0.9)", b * 15, 12, "none"),
        width: 12,
        height: 12,
        anchor: { x: 6, y: 6 },
      });
    }
    const chevGeoms: any[] = [];
    icPaths.forEach((path, i) => {
      [0.2, 0.4, 0.6, 0.8].forEach((p, k) => {
        const pos = pointAt(path, p);
        const back = pointAt(path, Math.max(0, p - 0.02));
        chevGeoms.push({
          id: `ch${i}_${k}`,
          styleId: `cb${bearingBucket(bearingDeg(back, pos))}`,
          position: new TMap.LatLng(pos.lat, pos.lng),
        });
      });
    });
    const chevrons = new TMap.MultiMarker({ map, geometries: chevGeoms, styles: chevStyles });
    layersRef.current = { ...layersRef.current, chevrons, token };
  }
}

function openInfo(
  TMap: any,
  map: any,
  layersRef: MutableRefObject<any>,
  info: { lat: number; lng: number; title: string; day?: number; type?: string; tag?: string }
) {
  if (layersRef.current.infoWindow) layersRef.current.infoWindow.setMap(null);
  const tag =
    info.tag ?? (info.type === "hotel" ? "\u{1F3E8} \u4F4F\u5BBF" : info.day ? "\u7B2C" + info.day + "\u5929" : "");
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

export default function MapView({ locations, showPolylines = true, intercity = [], showIntercity = true }: Props) {
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

  const hasData = locations.length > 0 || intercity.length > 0;

  // 用内容签名替代数组引用做依赖：父组件每次重渲染都会生成新数组（如行程总览/分享页内联计算），
  // 若以引用为依赖会导致图层反复清空重建、标点闪烁消失。内容不变则跳过重渲染。
  const locKey = useMemo(() => JSON.stringify(locations), [locations]);
  const icKey = useMemo(() => JSON.stringify(intercity), [intercity]);

  // 创建 / 销毁地图实例
  useEffect(() => {
    if (!ready || !hasData || !containerRef.current) return;
    const TMap = getTMap();
    if (!TMap) return;
    const first = intercity.length > 0
      ? { lat: intercity[0].depLat, lng: intercity[0].depLng }
      : locations[0];
    let map: any;
    try {
      map = new TMap.Map(containerRef.current, {
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
    } catch (e) {
      // 底图初始化失败（如当前环境 WebGL 异常）：降级为错误提示，避免整页白屏
      console.error("[MapView] \u5730\u56FE\u521D\u59CB\u5316\u5931\u8D25:", e);
      setError("\u5730\u56FE\u521D\u59CB\u5316\u5931\u8D25\uFF0C\u53EF\u80FD\u662F\u6D4F\u89C8\u5668\u786C\u4EF6\u52A0\u901F/WebGL \u5F02\u5E38\uFF0C\u8BF7\u68C0\u67E5\u6D4F\u89C8\u5668\u8BBE\u7F6E\u540E\u91CD\u8BD5");
      return;
    }
    mapRef.current = map;
    setTimeout(() => map.resize?.(), 0);
    return () => {
      map.destroy?.();
      mapRef.current = null;
      layersRef.current = {};
    };
  }, [ready, hasData]);

  // 坐标变化时刷新图层（异步拉取真实路径）
  useEffect(() => {
    const map = mapRef.current;
    const TMap = getTMap();
    if (!map || !TMap || !hasData) return;
    renderLocations(TMap, map, locations, showPolylines, intercity, showIntercity, layersRef).catch((e) =>
      console.error("[MapView] \u6E32\u67D3\u5931\u8D25:", e)
    );
    return () => {
      if (layersRef.current.animTimer) {
        clearInterval(layersRef.current.animTimer);
        layersRef.current.animTimer = null;
      }
    };
  }, [locKey, icKey, showPolylines, showIntercity, ready, hasData]);

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

  if (!hasData) {
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
