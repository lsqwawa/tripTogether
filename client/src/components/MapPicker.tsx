import { useEffect, useRef, useState } from "react";
import { Modal, Button, Typography } from "antd";
import { loadTencentMap, getTMap, TENCENT_MAP_KEY } from "../utils/tencentMap";

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

// 地图选点组件：在腾讯地图上点击落点，确认后回填 GCJ-02 经纬度（best-effort 逆地理编码填充地址）。
export default function MapPicker({ open, initialLat, initialLng, onConfirm, onCancel }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    setPicked(initialLat && initialLng ? { lat: initialLat, lng: initialLng } : null);
    setError(null);
    setReady(false);
    let cancelled = false;
    loadTencentMap()
      .then(() => !cancelled && setReady(true))
      .catch(() => !cancelled && setError("腾讯地图加载失败，请检查 Key 与 Referer 白名单配置"));
    return () => {
      cancelled = true;
    };
  }, [open, initialLat, initialLng]);

  useEffect(() => {
    if (!ready || !open || !containerRef.current) return;
    const TMap = getTMap();
    if (!TMap) return;

    const center = picked
      ? new TMap.LatLng(picked.lat, picked.lng)
      : new TMap.LatLng(39.908823, 116.39747); // 默认北京
    const map = new TMap.Map(containerRef.current, {
      center,
      zoom: picked ? 14 : 11,
      baseMap: { type: "vector" },
    });
    mapRef.current = map;

    const addMarker = (lat: number, lng: number) => {
      if (markerRef.current) markerRef.current.setMap(null);
      markerRef.current = new TMap.MultiMarker({
        map,
        geometries: [{ id: "pick", position: new TMap.LatLng(lat, lng) }],
      });
    };
    if (picked) addMarker(picked.lat, picked.lng);

    map.on("click", (e: any) => {
      const lat = e.latLng.lat;
      const lng = e.latLng.lng;
      setPicked({ lat, lng });
      addMarker(lat, lng);
    });

    return () => {
      map.destroy?.();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [ready, open, picked]);

  const handleConfirm = () => {
    if (!picked) return;
    const TMap = getTMap();
    const finish = (addr?: string) =>
      onConfirm({ lat: picked.lat, lng: picked.lng, address: addr });
    try {
      if (TMap?.service?.Geocoder) {
        const geo = new TMap.service.Geocoder({ key: TENCENT_MAP_KEY });
        geo
          .reverseGeocoder({ location: new TMap.LatLng(picked.lat, picked.lng) })
          .then((r: any) => finish(r?.result?.address))
          .catch(() => finish());
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
      okButtonProps={{ disabled: !picked }}
      width={600}
    >
      <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
        点击地图任意位置放置标记，确认后回填经纬度（并尽量自动填入地址）。
      </Typography.Paragraph>
      {error ? (
        <div style={{ color: "#cf1322", padding: 12, background: "#fff1f0", borderRadius: 8 }}>
          {error}
        </div>
      ) : (
        <div
          ref={containerRef}
          style={{ height: "min(380px, 55vh)", borderRadius: 8, overflow: "hidden", border: "1px solid #f0f0f0" }}
        />
      )}
      {picked && (
        <div style={{ marginTop: 8, fontSize: 13 }}>
          已选坐标：{picked.lat.toFixed(6)}, {picked.lng.toFixed(6)}
        </div>
      )}
    </Modal>
  );
}
