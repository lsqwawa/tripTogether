/**
 * 交通信息匹配引擎（方案文档 P1）
 *
 * 把相邻日程项之间的接驳从自由文本升级为结构化数据：
 * - 市内接驳：步行/驾车，优先调用腾讯地图 WebService 路线规划，
 *   无 Key / 调用失败时降级为直线距离 + 速度估算（开发环境 Key 无
 *   Direction 权限，降级是常态路径）。
 * - 城际段（直线 > 100km）：按距离阈值建议交通方式，由路由层生成
 *   Transportation 草稿（matched=true，待用户确认）。
 *
 * 坐标系约定：全程 GCJ-02，无需转换。
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/** 参与匹配的日程项（路由层从 ScheduleItem + 日程天数组装） */
export interface SequenceItem {
  id: string;
  dayIndex: number;
  sortOrder: number;
  title: string;
  locationName?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export interface LegResult {
  fromItemId: string;
  toItemId: string;
  legMode: "walking" | "driving";
  legDistanceM: number;
  legDurationMin: number;
  legPolyline: string; // JSON [{lat,lng},...]
  legSummary: string;
  via: "tencent" | "fallback";
}

export interface IntercitySuggestion {
  fromItemId: string;
  toItemId: string;
  transportType: "flight" | "train" | "car";
  distanceM: number;
  durationMin: number;
  departurePlace: string;
  arrivalPlace: string;
  depLat: number;
  depLng: number;
  arrLat: number;
  arrLng: number;
}

export interface MatchPair {
  a: SequenceItem;
  b: SequenceItem;
}

export interface MatchOutput {
  legs: LegResult[];
  intercity: IntercitySuggestion[];
  skippedNoCoord: number;
}

// ===== 阈值与估算参数（可按需调整）=====
export const INTERCITY_THRESHOLD_M = 100_000; // 直线 >100km 判定城际
const WALK_MAX_M = 1000; // 1km 内步行，否则驾车
const WALK_SPEED_MPM = 75; // 4.5 km/h
const DRIVE_SPEED_MPM = 500; // 30 km/h
const TRAIN_SPEED_MPM = 4167; // 250 km/h
const FLIGHT_SPEED_MPM = 13333; // 800 km/h
const TRAIN_OVERHEAD_MIN = 30; // 进站/候车缓冲
const FLIGHT_OVERHEAD_MIN = 120; // 值机/安检缓冲
/** 单次全量匹配最多消耗的路线规划调用次数，防大行程打爆配额 */
export const MAX_API_LEGS = 40;

/** 球面直线距离（米） */
export function haversineM(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function fmtKm(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

export function buildLegSummary(
  mode: "walking" | "driving",
  distM: number,
  durMin: number
): string {
  const verb = mode === "walking" ? "步行" : "驾车";
  return `${verb}约 ${Math.max(1, Math.round(durMin))} 分钟 · ${fmtKm(distM)}`;
}

/** 降级估算：直线距离 + 恒定速度推时长 */
function fallbackLeg(a: SequenceItem, b: SequenceItem, distM: number): LegResult {
  const mode: LegResult["legMode"] = distM < WALK_MAX_M ? "walking" : "driving";
  const speed = mode === "walking" ? WALK_SPEED_MPM : DRIVE_SPEED_MPM;
  const durMin = distM / speed;
  return {
    fromItemId: a.id,
    toItemId: b.id,
    legMode: mode,
    legDistanceM: Math.round(distM),
    legDurationMin: Math.round(durMin),
    legPolyline: JSON.stringify([
      { lat: a.lat, lng: a.lng },
      { lat: b.lat, lng: b.lng },
    ]),
    legSummary: buildLegSummary(mode, distM, durMin),
    via: "fallback",
  };
}

interface TencentDirectionResult {
  distance: number;
  duration: number;
  polyline: LatLng[];
}

/**
 * 腾讯地图路线规划（WebService v1）。
 * 失败（网络/配额/鉴权/超时）返回 null，由调用方降级。
 */
async function tencentDirection(
  from: LatLng,
  to: LatLng,
  mode: "walking" | "driving",
  key: string
): Promise<TencentDirectionResult | null> {
  const url =
    `https://apis.map.qq.com/ws/direction/v1/${mode}/` +
    `?from=${from.lat},${from.lng}&to=${to.lat},${to.lng}&key=${encodeURIComponent(key)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    const data: any = await res.json();
    if (data?.status !== 0 || !data?.result?.routes?.length) return null;
    const route = data.result.routes[0];
    const raw: number[] = route.polyline || [];
    const polyline: LatLng[] = [];
    for (let i = 0; i + 1 < raw.length; i += 2) {
      polyline.push({ lat: raw[i], lng: raw[i + 1] });
    }
    if (polyline.length < 2) {
      polyline.push(from, to);
    }
    return {
      distance: Number(route.distance) || 0,
      duration: Number(route.duration) || 0,
      polyline,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 单段接驳解析：真实路线优先，失败降级直线估算 */
async function resolveLeg(
  a: SequenceItem,
  b: SequenceItem,
  distM: number,
  key: string | undefined,
  apiBudget: { remaining: number }
): Promise<LegResult> {
  const mode: LegResult["legMode"] = distM < WALK_MAX_M ? "walking" : "driving";
  if (key && apiBudget.remaining > 0) {
    apiBudget.remaining--;
    const real = await tencentDirection(
      { lat: a.lat!, lng: a.lng! },
      { lat: b.lat!, lng: b.lng! },
      mode,
      key
    );
    if (real && real.distance > 0) {
      return {
        fromItemId: a.id,
        toItemId: b.id,
        legMode: mode,
        legDistanceM: Math.round(real.distance),
        legDurationMin: Math.round(real.duration / 60),
        legPolyline: JSON.stringify(real.polyline),
        legSummary: buildLegSummary(mode, real.distance, real.duration / 60),
        via: "tencent",
      };
    }
  }
  return fallbackLeg(a, b, distM);
}

/** 城际交通方式建议（按直线距离阈值，方案 4.4） */
export function suggestIntercityType(
  distM: number
): IntercitySuggestion["transportType"] {
  if (distM < 300_000) return "train";
  return "flight";
}

function estimateIntercityDuration(
  type: IntercitySuggestion["transportType"],
  distM: number
): number {
  if (type === "flight") {
    return Math.round(distM / FLIGHT_SPEED_MPM + FLIGHT_OVERHEAD_MIN);
  }
  return Math.round(distM / TRAIN_SPEED_MPM + TRAIN_OVERHEAD_MIN);
}

function placeLabel(item: SequenceItem): string {
  return item.locationName || item.title;
}

/**
 * 全量匹配入口。
 * @param pairs  由路由层生成的相邻对（同日相邻 + 跨天终点→次日起点）
 * @param tencentKey 腾讯地图 WebService Key，可空（空则全量降级）
 */
export async function matchTransportPairs(
  pairs: MatchPair[],
  tencentKey: string | undefined
): Promise<MatchOutput> {
  const apiBudget = { remaining: MAX_API_LEGS };
  const legs: LegResult[] = [];
  const intercity: IntercitySuggestion[] = [];
  let skippedNoCoord = 0;

  for (const { a, b } of pairs) {
    if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) {
      skippedNoCoord++;
      continue;
    }
    const distM = haversineM(
      { lat: a.lat, lng: a.lng },
      { lat: b.lat, lng: b.lng }
    );

    if (distM > INTERCITY_THRESHOLD_M) {
      const type = suggestIntercityType(distM);
      intercity.push({
        fromItemId: a.id,
        toItemId: b.id,
        transportType: type,
        distanceM: Math.round(distM),
        durationMin: estimateIntercityDuration(type, distM),
        departurePlace: placeLabel(a),
        arrivalPlace: placeLabel(b),
        depLat: a.lat,
        depLng: a.lng,
        arrLat: b.lat,
        arrLng: b.lng,
      });
      continue;
    }

    legs.push(await resolveLeg(a, b, distM, tencentKey, apiBudget));
  }

  return { legs, intercity, skippedNoCoord };
}

/**
 * 由按天排序的日程项序列生成匹配对：
 * 同日相邻项 + 跨天「当日终点 → 次日起点」。
 */
export function buildMatchPairs(sorted: SequenceItem[]): MatchPair[] {
  const pairs: MatchPair[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    pairs.push({ a, b });
  }
  return pairs;
}
