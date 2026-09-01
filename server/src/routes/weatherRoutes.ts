import { Router, Request, Response } from "express";
import { asyncHandler } from "../middleware/asyncHandler";

const router = Router();

// WMO 天气码 → 中文文案 + emoji
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

// 中国天气网天气现象代码（fc.f[].fa 为白天、fb 为夜间，两者取白天优先）
const CMA_CODES: Record<string, { text: string; icon: string }> = {
  "00": { text: "晴", icon: "☀️" },
  "01": { text: "多云", icon: "⛅" },
  "02": { text: "阴", icon: "☁️" },
  "03": { text: "阵雨", icon: "🌦️" },
  "04": { text: "雷阵雨", icon: "⛈️" },
  "05": { text: "雷阵雨伴冰雹", icon: "⛈️" },
  "06": { text: "雨夹雪", icon: "🌨️" },
  "07": { text: "小雨", icon: "🌧️" },
  "08": { text: "中雨", icon: "🌧️" },
  "09": { text: "大雨", icon: "🌧️" },
  10: { text: "暴雨", icon: "🌧️" },
  11: { text: "大暴雨", icon: "🌧️" },
  12: { text: "特大暴雨", icon: "🌧️" },
  13: { text: "阵雪", icon: "🌨️" },
  14: { text: "小雪", icon: "🌨️" },
  15: { text: "中雪", icon: "🌨️" },
  16: { text: "大雪", icon: "❄️" },
  17: { text: "暴雪", icon: "❄️" },
  18: { text: "雾", icon: "🌫️" },
  19: { text: "冻雨", icon: "🌧️" },
  20: { text: "沙尘暴", icon: "🌪️" },
  21: { text: "小到中雨", icon: "🌧️" },
  22: { text: "中到大雨", icon: "🌧️" },
  23: { text: "大到暴雨", icon: "🌧️" },
  24: { text: "暴雨到大暴雨", icon: "🌧️" },
  25: { text: "大暴雨到特大暴雨", icon: "🌧️" },
  26: { text: "小到中雪", icon: "🌨️" },
  27: { text: "中到大雪", icon: "🌨️" },
  28: { text: "大到暴雪", icon: "❄️" },
  29: { text: "浮尘", icon: "🌫️" },
  30: { text: "扬沙", icon: "🌫️" },
  31: { text: "强沙尘暴", icon: "🌪️" },
  53: { text: "霾", icon: "🌫️" },
  99: { text: "未知", icon: "🌡️" },
};

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

/** 经纬度 → 中国天气网城市 ID（需 TENCENT_MAP_KEY 做逆地理编码，缺 Key 时返回 null） */
async function cmaCityId(lat: number, lng: number): Promise<string | null> {
  const key = process.env.TENCENT_MAP_KEY;
  if (!key) return null;

  const geo = await getJson(
    `https://apis.map.qq.com/ws/geocoder/v1/?location=${lat},${lng}` +
      `&key=${encodeURIComponent(key)}&get_poi=0`
  );
  const city: string = geo?.result?.address_component?.city || "";
  if (!city) return null;

  const name = city.replace(/市$/, "");
  const raw = await getText(
    `http://toy1.weather.com.cn/search?cityname=${encodeURIComponent(name)}`,
    { Referer: "http://www.weather.com.cn/" }
  );
  // 返回是 JSONP：({...})，去掉外层括号后再解析
  const list = JSON.parse(raw.trim().replace(/^\(/, "").replace(/\)$/, ""));
  const ref = Array.isArray(list) ? String(list[0]?.ref || "") : "";
  const id = ref.split("~")[0];
  return /^\d{9}$/.test(id) ? id : null;
}

/** 中国天气网：返回以 YYYY-MM-DD 为键的逐日预报（通常覆盖今天起 5 天） */
async function fetchCma(lat: number, lng: number): Promise<Record<string, DayForecast>> {
  const cityId = await cmaCityId(lat, lng);
  if (!cityId) return {};

  const html = await getText(`http://d1.weather.com.cn/weather_index/${cityId}.html`, {
    Referer: "http://www.weather.com.cn/",
  });
  const m = html.match(/var\s+fc\s*=\s*(\{[\s\S]*?\})\s*;?/);
  if (!m) return {};

  const list = JSON.parse(m[1])?.f;
  if (!Array.isArray(list) || list.length === 0) return {};

  const out: Record<string, DayForecast> = {};
  const today = new Date();
  let py = today.getFullYear();
  let pm = today.getMonth() + 1;
  let pd = today.getDate();

  for (const it of list) {
    const parts = String(it?.fi || "").split("/");
    if (parts.length !== 2) continue;
    const mm = Number(parts[0]);
    const dd = Number(parts[1]);
    if (!Number.isInteger(mm) || !Number.isInteger(dd)) continue;
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) continue;

    // 接口只给「月/日」，年份靠递增推断：比上一条小即视为跨年
    let year = py;
    if (mm < pm || (mm === pm && dd < pd)) year = py + 1;
    py = year;
    pm = mm;
    pd = dd;
    const date = `${year}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;

    const tmax = Number(it?.fc);
    const tmin = Number(it?.fd);
    if (!Number.isFinite(tmax) || !Number.isFinite(tmin)) continue;

    const code = String(it?.fa ?? it?.fb ?? "99").padStart(2, "0");
    const info = CMA_CODES[code] || CMA_CODES["99"];
    const pf = Number(it?.fm);
    const pn = Number(it?.fn);
    let precipProb: number | null = null;
    if (Number.isFinite(pf) && Number.isFinite(pn)) precipProb = Math.round((pf + pn) / 2);
    else if (Number.isFinite(pf)) precipProb = Math.round(pf);
    else if (Number.isFinite(pn)) precipProb = Math.round(pn);

    out[date] = {
      date,
      text: info.text,
      icon: info.icon,
      tmax: Math.round(tmax),
      tmin: Math.round(tmin),
      precipProb,
    };
  }
  return out;
}

/** Open-Meteo：免 Key，窗口约 16 天，用于兜底与中国天气网覆盖不到的日期 */
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
 * 主数据源中国天气网（需 TENCENT_MAP_KEY 做逆地理编码，覆盖今天起约 5 天），
 * 其覆盖不到的日期由 Open-Meteo（免 Key，窗口约 16 天）补齐；
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
    // Math.max(NaN, x) 仍为 NaN，toISODate 里 toISOString() 会抛 RangeError → 500
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

    // 1) 中国天气网（境内访问更稳，但仅覆盖约 5 天）
    try {
      const cma = await fetchCma(lat, lng);
      for (const d of dates) {
        if (cma[d]) byDate[d] = cma[d];
      }
      if (Object.keys(byDate).length) sources.push("cma");
    } catch {
      // 中国天气网不可用（缺 Key / 逆地理失败 / 上游异常）：静默，交由 Open-Meteo 兜底
    }

    // 2) 中国天气网没覆盖到的日期，用 Open-Meteo 补齐
    const missing = dates.filter((d) => !byDate[d]);
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
        // 两个数据源都不可用：静默降级
      }
    }

    const days = dates.map((d) => byDate[d]).filter(Boolean);
    res.json({ days, source: sources.length ? sources.join("+") : "none" });
  })
);

export default router;
