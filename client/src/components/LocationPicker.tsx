import { useEffect, useRef, useState } from "react";
import { AutoComplete, Spin } from "antd";
import { loadTencentMap, getTMap, TENCENT_MAP_KEY } from "../utils/tencentMap";

export interface PickedLocation {
  lat: number;
  lng: number;
  name: string;
  address?: string;
}

interface Props {
  city?: string;
  placeholder?: string;
  onPick: (loc: PickedLocation) => void;
}

// 地点搜索结果缓存（内存 + localStorage），削减重复搜索请求，保护 200 次/日的免费配额
const SEARCH_LS_KEY = "ttmap_search_cache_v1";
const SEARCH_TTL = 7 * 24 * 3600 * 1000;

// 地点搜索组件：调用腾讯地图服务类附加库（TMap.service.Search）做关键词搜索，
// 选中后回填 GCJ-02 经纬度，供日程项 / 住宿表单录入坐标使用。
export default function LocationPicker({ city, placeholder, onPick }: Props) {
  const [options, setOptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  // 是否已发起过搜索且无结果；用于在非 loading 时也提示「未找到」，避免静默无反馈
  const [noResult, setNoResult] = useState(false);
  const memCache = useRef<Map<string, any[]>>(new Map());
  const debounceRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    loadTencentMap()
      .then(() => !cancelled && setReady(true))
      .catch(() => !cancelled && setReady(false));
    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const getCached = (key: string): any[] | null => {
    if (memCache.current.has(key)) return memCache.current.get(key)!;
    try {
      const raw = localStorage.getItem(SEARCH_LS_KEY);
      if (raw) {
        const obj = JSON.parse(raw);
        const entry = obj[key];
        if (entry && entry.e > Date.now()) {
          memCache.current.set(key, entry.v);
          return entry.v;
        }
      }
    } catch {
      /* 忽略缓存读取失败 */
    }
    return null;
  };

  const setCached = (key: string, value: any[]) => {
    memCache.current.set(key, value);
    try {
      const raw = localStorage.getItem(SEARCH_LS_KEY);
      const obj = raw ? JSON.parse(raw) : {};
      obj[key] = { e: Date.now() + SEARCH_TTL, v: value };
      localStorage.setItem(SEARCH_LS_KEY, JSON.stringify(obj));
    } catch {
      /* 忽略缓存写入失败 */
    }
  };

  // 把缓存中的纯数据项还原成带 React 节点的 option
  // （渲染时才构造节点，避免 React 元素被 JSON.stringify 损坏）
  const toOption = (p: any) => ({
    value: p.value,
    label: (
      <div style={{ padding: "2px 0" }}>
        <div style={{ fontSize: 13 }}>{p.title}</div>
        {p.address && (
          <div style={{ fontSize: 11, color: "#999" }}>{p.address}</div>
        )}
      </div>
    ),
    raw: { id: p.value, title: p.title, address: p.address, location: { lat: p.lat, lng: p.lng } },
  });

  const doSearch = async (kw: string) => {
    if (!kw || !ready) {
      setOptions([]);
      return;
    }
    const TMap = getTMap();
    if (!TMap?.service?.Search) return;
    const cacheKey = `${city || "全国"}::${kw.trim()}`;
    const cached = getCached(cacheKey);
    if (cached) {
      setOptions(cached.map(toOption));
      setNoResult(cached.length === 0);
      return;
    }
    setLoading(true);
    try {
      const boundary = city ? `region(${city},0)` : 'region("全国",0)';
      const svc = new TMap.service.Search({ key: TENCENT_MAP_KEY });
      const res = await svc.search({ keyword: kw, boundary, page_size: 10 });
      const data = res?.data || [];
      // 缓存只存纯数据 {value,title,address,lat,lng}，不存 React 元素
      const cacheData = data.map((p: any) => ({
        value: p.id,
        title: p.title,
        address: p.address,
        lat: p.location?.lat,
        lng: p.location?.lng,
      }));
      setOptions(cacheData.map(toOption));
      setCached(cacheKey, cacheData);
      setNoResult(cacheData.length === 0);
    } catch (e) {
      setOptions([]);
    } finally {
      setLoading(false);
    }
  };

  // 输入防抖：停顿 300ms 后才真正发起搜索，削减连续输入产生的无效请求
  const onSearch = (value: string) => {
    // 新输入先清掉旧「未找到」状态，避免下拉闪烁上一轮的提示
    setNoResult(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  };

  return (
    <AutoComplete
      style={{ width: "100%" }}
      options={options}
      onSearch={onSearch}
      onSelect={(_value, option: any) => {
        const raw = option?.raw;
        if (raw?.location) {
          onPick({
            lat: raw.location.lat,
            lng: raw.location.lng,
            name: raw.title,
            address: raw.address,
          });
        }
      }}
      placeholder={placeholder || "搜索地点，自动填充坐标"}
      notFoundContent={loading ? <Spin size="small" /> : noResult ? "未找到匹配地点" : null}
      filterOption={false}
    />
  );
}
