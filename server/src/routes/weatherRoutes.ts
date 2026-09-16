import { Router, Request, Response } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { WEATHER_CITIES } from "../data/weatherCities";

const router = Router();

/** 球面直线距离（米），用于经纬度就近匹配城市码 */
function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// WMO 天气码 → 中文文案 + emoji（Open-Meteo 兜底源用）
const WEATHER_CODES: Record<number, { text: string; icon: string }> = {
  0: { text: "晴", icon: "☀️" },
  1: { text: "大部晴朗", icon: "🌤️" },
  2: { text: "多云", icon: "⛅" },
  3: { text: "阴", icon: "☁️" },
  45: { text: "雾", icon: "🌫️" },
  48: { text: "雾凇", icon: "🌫️" },
  51: { text: "毛毛雨", icon: "🌦️" },
  53: { text: "毛毛雨", icon: "🌦️" },
  55: { text: "毛毛雨", icon: "🌦️" },
  56: { text: "冻毛毛雨", icon: "🌧️" },
  57: { text: "冻毛毛雨", icon: "🌧️" },
  61: { text: "小雨", icon: "🌧️" },
  63: { text: "中雨", icon: "🌧️" },
  65: { text: "大雨", icon: "🌧️" },
  66: { text: "冻雨", icon: "🌧️" },
  67: { text: "冻雨", icon: "🌧️" },
  71: { text: "小雪", icon: "🌨️" },
  73: { text: "中雪", icon: "🌨️" },
  75: { text: "大雪", icon: "❄️" },
  77: { text: "米雪", icon: "🌨️" },
  80: { text: "阵雨", icon: "🌦️" },
  81: { text: "阵雨", icon: "🌧️" },
  82: { text: "强阵雨", icon: "⛈️" },
  85: { text: "阵雪", icon: "🌨️" },
  86: { text: "阵雪", icon: "🌨️" },
  95: { text: "雷雨", icon: "⛈️" },
  96: { text: "雷雨伴冰雹", icon: "⛈️" },
  99: { text: "雷雨伴冰雹", icon: "⛈️" },
};

/**
 * 取「本地日历日」的 YYYY-MM-DD。
 * 不能用 toISOString().slice(0,10)：那是 UTC 日，东八区会比本地少一天，
 * 导致夹取窗口与注释不符（曾经表现为 今天-6 ~ 今天+14）。
 */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 严格校验 YYYY-MM-DD：既校验格式，也用「往返相等」挡掉 2026-02-31
 * 这类会被 Date 宽松解析成 3 月 3 日的非法日期。
 */
export function isValidDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return false;
  return toISODate(d) === s;
}

// ==================== 数据源 ====================

export type DayForecast = {
  date: string;
  text: string;
  icon: string;
  tmax: number;
  tmin: number;
  precipProb: number | null;
};

const FETCH_TIMEOUT_MS = 8000;

async function httpGet(url: string, headers?: Record<string, string>) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: ctrl.signal, headers });
  } finally {
    clearTimeout(timer);
  }
}

async function getJson(url: string, headers?: Record<string, string>): Promise<any> {
  const resp = await httpGet(url, headers);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

async function getText(url: string, headers?: Record<string, string>): Promise<string> {
  const resp = await httpGet(url, headers);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.text();
}

// ==================== 中国天气网（主源） ====================

/**
 * 中国天气网文案 → emoji，按恶劣程度优先。
 * 月历接口的 w1 是"晴转多云"这类文案而非代码，"X转Y"取更恶劣的一侧
 * （出行场景更关心会不会下雨下雪）。
 */
export function textToIcon(text: string): string {
  const t = text || "";
  if (t.includes("雷") || t.includes("雹")) return "⛈️";
  if (t.includes("雪")) return t.includes("暴") ? "❄️" : "🌨️";
  if (t.includes("雨")) return t.includes("阵雨") ? "🌦️" : "🌧️";
  if (t.includes("沙") || t.includes("尘")) return "🌪️";
  if (t.includes("霾")) return "😷";
  if (t.includes("雾")) return "🌫️";
  if (t.includes("阴")) return "☁️";
  if (t.includes("云")) return "⛅";
  if (t.includes("晴")) return "☀️";
  return "🌡️";
}

// 中国范围粗略边界框；框外视为境外，直接走 Open-Meteo（全球数据）
const CN_BBOX = { latMin: 3.5, latMax: 54, lngMin: 73, lngMax: 135.5 };
const MAX_CITY_DIST_M = 300_000;

/**
 * 经纬度 → 中国天气网城市码：内嵌城市码表（427 城，含坐标）就近匹配，
 * 完全离线，不依赖任何逆地理编码 Key（即便配了腾讯 Key 也不走网络）。
 * 之所以不用「腾讯逆地理 + toy1.weather.com.cn 名称搜索」的历史方案：
 * toy1 搜索接口已失效（返回空 JSONP），且离线就近匹配免配额、更快。
 * 境外坐标或距最近城市 >300km 返回 null。
 */
export function nearestCityCode(lat: number, lng: number): string | null {
  if (
    lat < CN_BBOX.latMin || lat > CN_BBOX.latMax ||
    lng < CN_BBOX.lngMin || lng > CN_BBOX.lngMax
  ) {
    return null;
  }
  let best: string | null = null;
  let bestDist = Infinity;
  for (const c of WEATHER_CITIES) {
    const d = haversineM({ lat, lng }, { lat: c.lat, lng: c.lon });
    if (d < bestDist) {
      bestDist = d;
      best = c.code;
    }
  }
  return bestDist <= MAX_CITY_DIST_M ? best : null;
}

// 月历条目（d1.weather.com.cn/calendar_new 的 fc40 数组元素，仅列用到的字段）
interface CalEntry {
  date: string; // YYYYMMDD
  w1?: string; // 天气文案：15 天档有值；40 天档/过去日期为空
  max?: string; // 预报最高温
  min?: string; // 预报最低温
  hmax?: string; // 历史均值/实测最高温（过去日期用）
  hmin?: string;
}

// 月历缓存：预报每天更新约两次，30 分钟 TTL 足够，避免高频打上游
const MONTH_TTL_MS = 30 * 60 * 1000;
const monthCache = new Map<string, { ts: number; entries: CalEntry[] }>();

const CMA_HEADERS = {
  // 非官方网页接口：缺 Referer 会 403
  Referer: "http://www.weather.com.cn/",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
};

async function fetchCalendarMonth(cityCode: string, yyyymm: string): Promise<CalEntry[]> {
  const cacheKey = `${cityCode}_${yyyymm}`;
  const cached = monthCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < MONTH_TTL_MS) return cached.entries;

  try {
    const s = await getText(
      `https://d1.weather.com.cn/calendar_new/${yyyymm.slice(0, 4)}/${cityCode}_${yyyymm}.html`,
      CMA_HEADERS
    );
    // 响应形如 `var fc40 = [{...},{...}]`，取首个 [ 到最后一个 ] 之间做 JSON
    const lb = s.indexOf("[");
    const rb = s.lastIndexOf("]");
    if (lb < 0 || rb <= lb) return [];
    const entries = JSON.parse(s.slice(lb, rb + 1));
    if (!Array.isArray(entries)) return [];
    if (monthCache.size > 200) {
      const now = Date.now();
      for (const [k, v] of monthCache) {
        if (now - v.ts >= MONTH_TTL_MS) monthCache.delete(k);
      }
    }
    monthCache.set(cacheKey, { ts: Date.now(), entries });
    return entries;
  } catch {
    return []; // 上游异常：静默，由调用方兜底
  }
}

function firstNum(...vals: (string | undefined)[]): number | null {
  for (const v of vals) {
    const t = String(v ?? "").trim();
    if (!t) continue;
    const n = Number(t);
    if (Number.isFinite(n)) return Math.round(n);
  }
  return null;
}

function monthsBetween(startISO: string, endISO: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${startISO}T00:00:00`);
  const end = new Date(`${endISO}T00:00:00`);
  while (cur.getTime() <= end.getTime() && out.length < 3) {
    out.push(`${cur.getFullYear()}${String(cur.getMonth() + 1).padStart(2, "0")}`);
    cur.setMonth(cur.getMonth() + 1);
  }
  return out;
}

/**
 * 中国天气网：月历接口覆盖整月网格（15 天档含文案+气温，40 天档仅气温，
 * 过去日期仅历史气温），比 weather_index 的 5~7 天预报覆盖完整得多。
 * 返回以 YYYY-MM-DD 为键的逐日预报；无文案的条目 text 为空串、
 * icon 为 🌡️，路由层会用 Open-Meteo 优先升级这些日期。
 */
async function fetchCma(
  lat: number,
  lng: number,
  startISO: string,
  endISO: string
): Promise<Record<string, DayForecast>> {
  const cityCode = nearestCityCode(lat, lng);
  if (!cityCode) return {};

  const months = monthsBetween(startISO, endISO);
  const monthEntries = await Promise.all(months.map((m) => fetchCalendarMonth(cityCode, m)));

  const out: Record<string, DayForecast> = {};
  const scores: Record<string, number> = {};
  monthEntries.forEach((entries, mi) => {
    const homeMonth = `${months[mi].slice(0, 4)}-${months[mi].slice(4)}`;
    for (const e of entries) {
      if (!/^\d{8}$/.test(String(e.date))) continue;
      const iso = `${e.date.slice(0, 4)}-${e.date.slice(4, 6)}-${e.date.slice(6, 8)}`;
      if (iso < startISO || iso > endISO) continue;
      const tmax = firstNum(e.max, e.hmax);
      const tmin = firstNum(e.min, e.hmin);
      if (tmax === null || tmin === null) continue;
      const text = String(e.w1 || "").trim();
      // 月历网格含前后跨月日期；同一天优先取"归属月"且带文案的条目
      const score = (text ? 2 : 0) + (iso.slice(0, 7) === homeMonth ? 1 : 0);
      if (scores[iso] !== undefined && score <= scores[iso]) continue;
      scores[iso] = score;
      out[iso] = {
        date: iso,
        text,
        icon: textToIcon(text),
        tmax,
        tmin,
        precipProb: null, // 月历接口不提供降水概率
      };
    }
  });
  return out;
}

// ==================== Open-Meteo（兜底源） ====================

/** Open-Meteo：免 Key，窗口约 16 天，用于境外坐标与补齐中国天气网缺口 */
async function fetchOpenMeteo(
  lat: number,
  lng: number,
  start: string,
  end: string
): Promise<Record<string, DayForecast>> {
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${lat}&longitude=${lng}` +
    "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max" +
    `&start_date=${start}&end_date=${end}&timezone=auto`;

  const daily = (await getJson(url))?.daily;
  if (!daily?.time?.length) return {};

  const out: Record<string, DayForecast> = {};
  daily.time.forEach((date: string, i: number) => {
    const tmax = Number(daily.temperature_2m_max?.[i]);
    const tmin = Number(daily.temperature_2m_min?.[i]);
    if (!Number.isFinite(tmax) || !Number.isFinite(tmin)) return;
    const code = Number(daily.weather_code?.[i]);
    const info = WEATHER_CODES[code] || { text: "未知", icon: "🌡️" };
    out[date] = {
      date,
      text: info.text,
      icon: info.icon,
      tmax: Math.round(tmax),
      tmin: Math.round(tmin),
      precipProb: daily.precipitation_probability_max?.[i] ?? null,
    };
  });
  return out;
}

export function enumerateDates(start: string, end: string): string[] {
  const out: string[] = [];
  const cur = new Date(start);
  const last = new Date(end);
  while (cur.getTime() <= last.getTime() && out.length < 400) {
    out.push(toISODate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/**
 * 天气代理：GET /api/weather?lat&lng&start&end
 * 主数据源中国天气网（月历接口，内嵌城市码表就近匹配，15 天档含文案，
 * 40 天档与过去日期仅气温）；无文案的日期及境外坐标由 Open-Meteo
 * （免 Key，窗口约 16 天，含降水概率）补齐/升级。
 * 请求范围会被夹取到可用窗口内，完全超窗或上游全部失败返回空数组，
 * 前端静默降级不阻塞主流程。响应带 source 字段便于排障。
 */
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const start = String(req.query.start || "");
    const end = String(req.query.end || "");

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !start || !end) {
      return res.status(400).json({ error: "需要 lat / lng / start / end 参数" });
    }
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return res.status(400).json({ error: "坐标超出范围" });
    }

    // 日期校验必须早于夹取：否则 new Date("abc") 得到 NaN，
    // Math.max(NaN, x) 仍为 NaN，toISODate 里会抛 RangeError → 500
    if (!isValidDate(start) || !isValidDate(end)) {
      return res.status(400).json({ error: "日期格式无效，应为 YYYY-MM-DD" });
    }

    // 夹取到预报可用窗口（约今天-5 ~ 今天+15）
    const today = new Date();
    const minDate = new Date(today);
    minDate.setDate(minDate.getDate() - 5);
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + 15);

    const clampedStart = toISODate(
      new Date(Math.max(new Date(start).getTime(), minDate.getTime()))
    );
    const clampedEnd = toISODate(
      new Date(Math.min(new Date(end).getTime(), maxDate.getTime()))
    );
    if (clampedStart > clampedEnd) {
      return res.json({ days: [], source: "none" }); // 完全超出预报窗口
    }

    const dates = enumerateDates(clampedStart, clampedEnd);
    const byDate: Record<string, DayForecast> = {};
    const sources: string[] = [];

    // 1) 中国天气网月历（境内主源）
    let cmaUsed = false;
    try {
      const cma = await fetchCma(lat, lng, clampedStart, clampedEnd);
      for (const d of dates) {
        if (cma[d]) {
          byDate[d] = cma[d];
          cmaUsed = true;
        }
      }
    } catch {
      // 中国天气网不可用（境外坐标 / 上游异常）：静默，交由 Open-Meteo 兜底
    }
    if (cmaUsed) sources.push("cma");

    // 2) CMA 未覆盖或仅气温（无文案）的日期，用 Open-Meteo 补齐/升级
    const missing = dates.filter((d) => !byDate[d]?.text);
    if (missing.length) {
      try {
        const om = await fetchOpenMeteo(lat, lng, clampedStart, clampedEnd);
        let added = 0;
        for (const d of missing) {
          if (om[d]) {
            byDate[d] = om[d];
            added++;
          }
        }
        if (added) sources.push("open-meteo");
      } catch {
        // 两个数据源都不可用：静默降级，CMA 的仅气温条目仍会输出
      }
    }

    const days = dates.map((d) => byDate[d]).filter(Boolean);
    res.json({ days, source: sources.length ? sources.join("+") : "none" });
  })
);

export default router;
