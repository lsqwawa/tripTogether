import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Typography, AutoComplete, Spin, Button } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { loadTencentMap, getTMap, TENCENT_MAP_KEY, getLatLngbyAddress } from "../utils/tencentMap";

export interface PickedPoint {
  lat: number;
  lng: number;
  address?: string;
}

interface Props {
  open: boolean;
  initialLat?: number;
  initialLng?: number;
  onConfirm: (p: PickedPoint) => void;
  onCancel: () => void;
}

// 地图选点组件：输入地址搜索自动定位，或直接点击地图落点；
// 确认后回填 GCJ-02 经纬度，并尽量自动带上地址（搜索选中直接带地址，点图则逆地理编码兜底）。
export default function MapPicker({ open, initialLat, initialLng, onConfirm, onCancel }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerReady, setContainerReady] = useState(false);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const debounceRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<{ lat: number; lng: number; address?: string } | null>(null);
  const [searchOptions, setSearchOptions] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // 容器挂载/卸载通过回调 ref 上报，确保初始化地图时 DOM 已就绪
  const setContainerRef = useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node;
    setContainerReady(!!node);
  }, []);

  // 打开时重置状态并预载 SDK；关闭时清空 ready，避免下次打开复用旧状态导致重复初始化
  useEffect(() => {
    if (!open) {
      setReady(false);
      setPicked(null);
      setSearchValue("");
      setSearchOptions([]);
      return;
    }
    setPicked(initialLat && initialLng ? { lat: initialLat, lng: initialLng } : null);
    setError(null);
    setReady(false);
    let cancelled = false;
    loadTencentMap()
      .then(() => !cancelled && setReady(true))
      .catch(() => !cancelled && setError("腾讯地图加载失败，请检查 Key 与 Referer 白名单配置"));
    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [open, initialLat, initialLng]);

  // 初始化地图（SDK 就绪 + 容器挂载后；仅一次，初始中心取当前选中点或默认北京）
  // 二次打开时 SDK 已缓存、loadTencentMap 微任务即 resolve，此时 Modal 动画尚未结束、
  // 容器尺寸为 0，腾讯地图 WebGL 计算相机 far 平面会抛 "far <= 0"。故先用 rAF 轮询，
  // 等容器出现有效尺寸后再创建 Map 实例。
  useEffect(() => {
    if (!ready || !open || !containerReady || !containerRef.current) return;
    const TMap = getTMap();
    if (!TMap) return;
    let raf = 0;
    let cancelled = false;
    const tryInit = () => {
      if (cancelled) return;
      const el = containerRef.current;
      if (!el || el.clientWidth === 0 || el.clientHeight === 0) {
        raf = requestAnimationFrame(tryInit);
        return;
      }
      const map = new TMap.Map(el, {
        center: picked
          ? new TMap.LatLng(picked.lat, picked.lng)
          : new TMap.LatLng(39.908823, 116.39747),
        zoom: picked ? 15 : 11,
        baseMap: { type: "vector" },
      });
      mapRef.current = map;
      map.on("click", (e: any) => {
        setPicked({ lat: e.latLng.lat, lng: e.latLng.lng });
      });
    };
    raf = requestAnimationFrame(tryInit);
    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      // 地图可能在异步回调中尚未创建，从 ref 取以兼容该情况
      mapRef.current?.destroy?.();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, open, containerReady]);

  // 选中点变化 → 移动中心 + 更新标记（不重建地图）
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !picked) {
      if (markerRef.current) markerRef.current.setMap(null);
      markerRef.current = null;
      return;
    }
    const TMap = getTMap();
    if (!TMap) return;
    map.setCenter(new TMap.LatLng(picked.lat, picked.lng));
    if (markerRef.current) markerRef.current.setMap(null);
    markerRef.current = new TMap.MultiMarker({
      map,
      geometries: [{ id: "pick", position: new TMap.LatLng(picked.lat, picked.lng) }],
    });
  }, [picked]);

  // 地址搜索：输入关键词调用地点搜索服务给出候选
  const doSearch = async (kw: string) => {
    if (!kw || !ready) {
      setSearchOptions([]);
      return;
    }
    const TMap = getTMap();
    if (!TMap?.service?.Search) return;
    setSearching(true);
    try {
      const svc = new TMap.service.Search({ key: TENCENT_MAP_KEY });
      const res = await svc.search({ keyword: kw, boundary: 'region("全国",0)', page_size: 10 });
      const data = res?.data || [];
      setSearchOptions(
        data.map((p: any) => ({
          value: p.id,
          label: (
            <div style={{ padding: "2px 0" }}>
              <div style={{ fontSize: 13 }}>{p.title}</div>
              {p.address && <div style={{ fontSize: 11, color: "#999" }}>{p.address}</div>}
            </div>
          ),
          raw: { address: p.address, lat: p.location?.lat, lng: p.location?.lng },
        }))
      );
    } catch {
      setSearchOptions([]);
    } finally {
      setSearching(false);
    }
  };

  const onSearch = (value: string) => {
    setSearchValue(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  };

  // 点击搜索按钮：地址解析自动定位
  const handleSearchClick = async () => {
    const kw = searchValue.trim();
    if (!kw) return;
    setGeocoding(true);
    const loc = await getLatLngbyAddress(kw);
    setGeocoding(false);
    if (loc) {
      setPicked({ lat: loc.lat, lng: loc.lng, address: loc.address });
    }
  };

  const handleSelect = (_value: string, option: any) => {
    const raw = option?.raw;
    if (raw?.lat && raw?.lng) {
      setPicked({ lat: raw.lat, lng: raw.lng, address: raw.address || "" });
    }
  };

  const handleConfirm = () => {
    if (!picked || confirming) return;
    // 搜索选中已带地址则直接用，否则逆地理编码兜底
    if (picked.address) {
      onConfirm({ lat: picked.lat, lng: picked.lng, address: picked.address });
      return;
    }
    const finish = (addr?: string) => {
      setConfirming(false);
      onConfirm({ lat: picked.lat, lng: picked.lng, address: addr });
    };
    const TMap = getTMap();
    try {
      if (TMap?.service?.Geocoder) {
        setConfirming(true);
        const geo = new TMap.service.Geocoder({ key: TENCENT_MAP_KEY });
        // 3 秒超时兜底，避免逆地理编码挂起导致「点了没反应」
        const timer = setTimeout(() => finish(), 3000);
        geo
          .reverseGeocoder({ location: new TMap.LatLng(picked.lat, picked.lng) })
          .then((r: any) => {
            clearTimeout(timer);
            finish(r?.result?.address);
          })
          .catch(() => {
            clearTimeout(timer);
            finish();
          });
        return;
      }
    } catch {
      /* 逆地理编码不可用时不阻塞，仅回填坐标 */
    }
    finish();
  };

  return (
    <Modal
      title="在地图上选点"
      open={open}
      onOk={handleConfirm}
      onCancel={onCancel}
      okText="确认选点"
      cancelText="取消"
      okButtonProps={{ disabled: !picked || confirming }}
      confirmLoading={confirming}
      width={600}
    >
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <AutoComplete
          style={{ flex: 1 }}
          value={searchValue}
          options={searchOptions}
          onSearch={onSearch}
          onSelect={handleSelect}
          placeholder="输入地址搜索，自动定位"
          notFoundContent={searching ? <Spin size="small" /> : null}
          filterOption={false}
        />
        <Button
          type="primary"
          icon={<SearchOutlined />}
          loading={geocoding}
          onClick={handleSearchClick}
        >
          搜索
        </Button>
      </div>
      <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
        输入地址搜索自动定位，或直接点击地图放置标记；确认后自动回填地址与坐标。
      </Typography.Paragraph>
      {error ? (
        <div style={{ color: "#cf1322", padding: 12, background: "#fff1f0", borderRadius: 8 }}>
          {error}
        </div>
      ) : (
        <div
          ref={setContainerRef}
          style={{ height: "min(380px, 55vh)", borderRadius: 8, overflow: "hidden", border: "1px solid #f0f0f0" }}
        />
      )}
      {picked && (
        <div style={{ marginTop: 8, fontSize: 13, color: "#595959" }}>
          {picked.address ? `已选地点：${picked.address}` : "已在地图上选点，确认后自动回填地址"}
        </div>
      )}
    </Modal>
  );
}
