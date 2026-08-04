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
