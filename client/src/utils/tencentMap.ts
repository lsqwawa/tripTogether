// 腾讯地图 JS API GL 动态加载与全局类型声明
// 坐标系：腾讯地图使用 GCJ-02，与腾讯地理编码 / 地点搜索返回的坐标一致，无需转换。

export const TENCENT_MAP_KEY = "5ULBZ-A4OET-RTQXK-VVT3R-4BNJO-KPF5Q";

declare global {
  interface Window {
    TMap?: any;
  }
}

let loadPromise: Promise<any> | null = null;

export function loadTencentMap(): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Tencent Map requires a browser environment"));
  }
  const w = window as any;
  if (w.TMap) return Promise.resolve(w.TMap);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<any>((resolve, reject) => {
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = `https://map.qq.com/api/gljs?v=1.exp&key=${TENCENT_MAP_KEY}&libraries=service`;
    script.async = true;
    script.onload = () => {
      if (w.TMap) resolve(w.TMap);
      else reject(new Error("腾讯地图脚本加载完成但未找到 TMap 对象"));
    };
    script.onerror = () => {
      loadPromise = null;
      reject(new Error("腾讯地图脚本加载失败（检查网络或 Key 配置）"));
    };
    document.head.appendChild(script);
  });
  return loadPromise;
}

export function getTMap(): any {
  return (window as any).TMap;
}

// #RRGGBB -> 十进制整数（腾讯 PolylineStyle.color 需要 number 类型）
export function hexToRgbNum(hex: string): number {
  return parseInt(hex.replace("#", ""), 16);
}

// ---------- 路线规划结果缓存（减少 WebService 配额消耗） ----------
// 地理路径长期不变，缓存到内存 + localStorage（30 天 TTL，裁剪至 800 条），
// 确保相同起终点不重复调用路线规划接口，避免触碰免费配额上限。

function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const ROUTE_LS_KEY = "ttmap_route_cache_v1";
const ROUTE_TTL = 30 * 24 * 3600 * 1000;
const routeMemCache = new Map<string, { lat: number; lng: number }[] | null>();

function routeCacheLoad(): Record<string, any> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(ROUTE_LS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function routeCacheSave(key: string, value: { lat: number; lng: number }[] | null) {
  if (typeof localStorage === "undefined") return;
  try {
    const all = routeCacheLoad();
    all[key] = { e: Date.now() + ROUTE_TTL, v: value };
    const keys = Object.keys(all);
    if (keys.length > 800) delete all[keys[0]]; // 裁剪，避免无限膨胀
    localStorage.setItem(ROUTE_LS_KEY, JSON.stringify(all));
  } catch {
    /* 忽略写入失败 */
  }
}

// ---------- 路线规划错误分类与重试 ----------
// 判断是否为「瞬时错误」（网络/超时/服务端5xx）。瞬时错误应重试、不应永久缓存降级；
// 持久错误（配额/鉴权/参数非法）则直接直线兜底并缓存，避免反复打 API 浪费配额。
function isTransientError(e: any): boolean {
  if (!e) return false;
  const msg = String((e as Error)?.message || e?.msg || "").toLowerCase();
  const status = e?.status ?? e?.code ?? e?.result?.status ?? e?.statusCode;
  if (typeof status === "number" && status !== 0) {
    // 明确业务失败：含配额/鉴权/参数等关键词 → 持久错误
    if (/quota|limit|frequency|too many|key|auth|permission|signature|invalid|illegal|forbidden|unauthorized|403|401/.test(msg)) {
      return false;
    }
    return false; // 其它业务错误（如起终点相同）也按持久处理，直接直线兜底
  }
  // 网络/超时/脚本加载/未知 → 瞬时
  if (/network|timeout|timed out|fetch|abort|failed to|load|unknown|econn|dns|socket/i.test(msg)) return true;
  if (e instanceof TypeError || e instanceof DOMException) return true;
  // 兜底：无法判定 → 当作瞬时，允许重试（宁可多试，不要误缓存降级）
  return true;
}

// 实际调用路线规划，对瞬时错误做指数退避重试（最多 2 次）
async function fetchRouteWithRetry(
  TMap: any,
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
  mode: "WALKING" | "DRIVING",
  maxRetry = 2
): Promise<{ value: { lat: number; lng: number }[] | null; transient: boolean }> {
  for (let attempt = 0; attempt <= maxRetry; attempt++) {
    try {
      const dir = new TMap.service.Direction({ key: TENCENT_MAP_KEY });
      const res = await dir.getRoute({
        from: `${a.lat},${a.lng}`,
        to: `${b.lat},${b.lng}`,
        mode,
      });
      const routes = res?.routes || res?.result?.routes || [];
      const polyline = routes[0]?.polyline;
      if (Array.isArray(polyline) && polyline.length > 1) {
        return { value: polyline.map((p: any) => ({ lat: p.lat, lng: p.lng })), transient: false };
      }
      return { value: [a, b], transient: false }; // 成功但无路线 → 直线兜底（确定结果）
    } catch (e) {
      const transient = isTransientError(e);
      if (!transient) return { value: null, transient: false }; // 持久错误，不重试
      if (attempt < maxRetry) {
        await new Promise((r) => setTimeout(r, 400 * Math.pow(2, attempt)));
      }
    }
  }
  return { value: null, transient: true }; // 重试耗尽，仍瞬时
}

// 拉取真实道路路径（腾讯路线规划），失败/跨海/同点兜底为直线；
// 瞬时错误只写内存缓存（下次刷新可重试），持久错误才写 localStorage 30 天降级。
export async function getCachedRoadPath(
  TMap: any,
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): Promise<{ lat: number; lng: number }[] | null> {
  const dist = haversine(a, b);
  if (dist < 15) return [a, b]; // 几乎同一点
  const mode = dist < 1000 ? "WALKING" : "DRIVING"; // 短距步行，长距驾车
  const key = `r_${mode}_${a.lat.toFixed(5)},${a.lng.toFixed(5)}_${b.lat.toFixed(5)},${b.lng.toFixed(5)}`;

  if (routeMemCache.has(key)) return routeMemCache.get(key)!;
  const persisted = routeCacheLoad();
  const entry = persisted[key];
  if (entry && entry.e > Date.now()) {
    routeMemCache.set(key, entry.v);
    return entry.v;
  }

  const { value, transient } = await fetchRouteWithRetry(TMap, a, b, mode);
  if (value) {
    routeMemCache.set(key, value);
    routeCacheSave(key, value);
    return value;
  }
  // 失败兜底直线
  console.warn("[tencentMap] 路线规划失败，回退直线。");
  routeMemCache.set(key, [a, b]);
  if (!transient) {
    // 持久错误：写 localStorage 30 天降级，避免反复打 API 浪费配额
    console.warn("[tencentMap] 持久错误（配额/授权/参数），已降级为直线并缓存。请检查 Key 额度与授权域配置。");
    routeCacheSave(key, [a, b]);
  }
  // 瞬时错误：仅内存缓存，下次刷新重试，不写 localStorage
  return [a, b];
}
