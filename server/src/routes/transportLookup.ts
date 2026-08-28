import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";

const router = Router();

// 该路由仅做「班次查询代理」，需登录（与既有路由一致）
router.use(authenticate);

// ===================== 简易缓存（60s） =====================
interface CacheEntry {
  expires: number;
  data: unknown;
}
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 1000;

function cacheGet(key: string): unknown | undefined {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.data;
  return undefined;
}
function cacheSet(key: string, data: unknown) {
  cache.set(key, { expires: Date.now() + CACHE_TTL_MS, data });
}

// ===================== fetch 工具 =====================
async function fetchJson(url: string): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) TripTogether/1.0",
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    if (!resp.ok) {
      throw new Error(`上游返回 ${resp.status}`);
    }
    return await resp.json();
  } finally {
    clearTimeout(timer);
  }
}

// ===================== 航班：Aviationstack =====================
// 免费层需要 AVIATIONSTACK_KEY；未配置时回退 mock，保证交互可全程跑通。
async function lookupFlight(code: string): Promise<{
  source: "aviationstack" | "mock";
  data: any;
}> {
  const key = process.env.AVIATIONSTACK_KEY;
  const upper = code.toUpperCase();
  if (!key) {
    return { source: "mock", data: buildMockFlight(upper) };
  }
  const url = `https://api.aviationstack.com/v1/flights?access_key=${encodeURIComponent(
    key
  )}&flight_iata=${encodeURIComponent(upper)}`;
  const json = await fetchJson(url);
  const flight = Array.isArray(json?.data) ? json.data[0] : undefined;
  if (!flight) {
    throw new Error("未查询到该航班，请检查航班号");
  }
  return {
    source: "aviationstack",
    data: {
      flightNumber: flight.flight?.iata || flight.flight?.iata_number || upper,
      airline: flight.airline?.name || "",
      status: flight.flight_status || "",
      departure: {
        airport: flight.departure?.airport || "",
        iata: flight.departure?.iata || "",
        terminal: flight.departure?.terminal || "",
        gate: flight.departure?.gate || "",
        scheduled: flight.departure?.scheduled || "",
        estimated: flight.departure?.estimated || "",
        actual: flight.departure?.actual || "",
      },
      arrival: {
        airport: flight.arrival?.airport || "",
        iata: flight.arrival?.iata || "",
        terminal: flight.arrival?.terminal || "",
        gate: flight.arrival?.gate || "",
        scheduled: flight.arrival?.scheduled || "",
        estimated: flight.arrival?.estimated || "",
        actual: flight.arrival?.actual || "",
      },
      aircraft: flight.aircraft?.registration || "",
    },
  };
}

function buildMockFlight(code: string) {
  // 仅用于未配置 Key 时的演示数据
  return {
    flightNumber: code,
    airline: code.startsWith("CA")
      ? "中国国际航空"
      : code.startsWith("MU")
        ? "中国东方航空"
        : "示例航司",
    status: "scheduled",
    departure: {
      airport: "北京首都国际机场",
      iata: "PEK",
      terminal: "T3",
      gate: "C12",
      scheduled: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
      estimated: "",
      actual: "",
    },
    arrival: {
      airport: "上海虹桥国际机场",
      iata: "SHA",
      terminal: "T2",
      gate: "A05",
      scheduled: new Date(Date.now() + 4.5 * 3600 * 1000).toISOString(),
      estimated: "",
      actual: "",
    },
    aircraft: "B-1234",
    _mock: true,
  };
}

// ===================== 火车：12306 官方接口（免 key） =====================
// 第一步：按车次号搜索 → 拿到 train_no / 始发 / 终到 / 停靠数
// 第二步（增强）：queryByTrainNo 拿完整经停时刻表（需站名电报码，失败则跳过）
async function lookupTrain(code: string): Promise<{
  source: "12306";
  data: any;
}> {
  const date = format12306Date(new Date());
  const searchUrl = `https://search.12306.cn/search/v1/train/search?keyword=${encodeURIComponent(
    code
  )}&date=${date}`;
  const searchJson = await fetchJson(searchUrl);
  const list: any[] = Array.isArray(searchJson?.data) ? searchJson.data : [];
  // 精确匹配车次号（station_train_code 可能带字母前缀差异，做大小写/去空格比对）
  const matched =
    list.find(
      (t) => String(t.station_train_code).toUpperCase() === code.toUpperCase()
    ) || list[0];
  if (!matched) {
    throw new Error("未查询到该车次，请检查车次号");
  }

  const result: any = {
    trainNumber: matched.station_train_code,
    fromStation: matched.from_station,
    toStation: matched.to_station,
    date: matched.date,
    stopCount: Number(matched.total_num) || 0,
    trainNo: matched.train_no,
    timetable: [] as any[],
  };

  // 增强：尝试拉经停时刻表（失败不影响主结果）
  try {
    const fromTc = await getTelecode(matched.from_station);
    const toTc = await getTelecode(matched.to_station);
    if (fromTc && toTc) {
      const detailUrl = `https://kyfw.12306.cn/otn/czxx/queryByTrainNo?train_no=${matched.train_no}&from_station_telecode=${fromTc}&to_station_telecode=${toTc}&date=${matched.date.replace(
        /(\d{4})(\d{2})(\d{2})/,
        "$1-$2-$3"
      )}`;
      const detailJson = await fetchJson(detailUrl);
      const stops: any[] = Array.isArray(detailJson?.data?.data)
        ? detailJson.data.data
        : [];
      result.timetable = stops.map((s) => ({
        station: s.station_name,
        arriveTime: s.arrive_time,
        departTime: s.start_time,
        stopover: s.stopover_time,
      }));
    }
  } catch {
    // 经停查询失败：忽略，主信息仍然有效
  }

  return { source: "12306", data: result };
}

function format12306Date(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

// 站名 → 电报码（懒加载并缓存 12306 站名表）
let stationMapCache: { expires: number; map: Map<string, string> } | null = null;
async function getTelecode(stationName: string): Promise<string | undefined> {
  if (!stationMapCache || stationMapCache.expires < Date.now()) {
    try {
      const js = await fetch(
        "https://kyfw.12306.cn/otn/resources/js/framework/station_name.js",
        {
          headers: {
            "User-Agent": "Mozilla/5.0",
            Accept: "*/*",
          },
        }
      ).then((r) => r.text());
      const map = new Map<string, string>();
      const re = /([A-Za-z]+)\|([^|]+)\|([A-Z]{3})/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(js)) !== null) {
        map.set(m[2], m[3]); // name -> telecode
      }
      stationMapCache = { expires: Date.now() + 24 * 3600 * 1000, map };
    } catch {
      stationMapCache = { expires: Date.now() + 60 * 1000, map: new Map() };
    }
  }
  return stationMapCache.map.get(stationName);
}

// ===================== 路由 =====================
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const type = String(req.query.type || "").toLowerCase();
    const code = String(req.query.code || "").trim();

    if (!["flight", "train"].includes(type)) {
      return res.status(400).json({ error: "type 仅支持 flight 或 train" });
    }
    if (!code) {
      return res.status(400).json({ error: "缺少班次号 code 参数" });
    }

    const cacheKey = `${type}:${code.toUpperCase()}`;
    const cached = cacheGet(cacheKey);
    if (cached !== undefined) {
      return res.json({ success: true, cached: true, ...(cached as object) });
    }

    let result: { source: string; data: any };
    if (type === "flight") {
      result = await lookupFlight(code);
    } else {
      result = await lookupTrain(code);
    }

    cacheSet(cacheKey, result);
    return res.json({ success: true, cached: false, ...result });
  })
);

export default router;
