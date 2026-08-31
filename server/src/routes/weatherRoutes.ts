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
  61: { text: "小雨", icon: "🌧️" },
  63: { text: "中雨", icon: "🌧️" },
  65: { text: "大雨", icon: "🌧️" },
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

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * 天气代理：GET /api/weather?lat&lng&start&end
 * 数据源 Open-Meteo（免 Key）。预报窗口约为过去数日 ~ 未来 16 天，
 * 请求范围会被夹取到可用窗口内；完全超窗或上游失败返回空数组，
 * 前端静默降级不阻塞主流程。
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
    if (Number.isNaN(new Date(start).getTime()) || Number.isNaN(new Date(end).getTime())) {
      return res.status(400).json({ error: "日期格式无效" });
    }
    if (clampedStart > clampedEnd) {
      return res.json({ days: [] }); // 完全超出预报窗口
    }

    const url =
      "https://api.open-meteo.com/v1/forecast" +
      `?latitude=${lat}&longitude=${lng}` +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max" +
      `&start_date=${clampedStart}&end_date=${clampedEnd}&timezone=auto`;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const resp = await fetch(url, { signal: ctrl.signal });
      if (!resp.ok) return res.json({ days: [] });
      const data: any = await resp.json();
      const daily = data?.daily;
      if (!daily?.time?.length) return res.json({ days: [] });

      const days = daily.time.map((date: string, i: number) => {
        const code = Number(daily.weather_code?.[i]);
        const info = WEATHER_CODES[code] || { text: "未知", icon: "🌡️" };
        return {
          date,
          text: info.text,
          icon: info.icon,
          tmax: Math.round(daily.temperature_2m_max?.[i]),
          tmin: Math.round(daily.temperature_2m_min?.[i]),
          precipProb: daily.precipitation_probability_max?.[i] ?? null,
        };
      });
      res.json({ days });
    } catch {
      res.json({ days: [] }); // 上游不可达：静默降级
    } finally {
      clearTimeout(timer);
    }
  })
);

export default router;
