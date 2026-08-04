import { useEffect, useState } from "react";
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

// 地点搜索组件：调用腾讯地图服务类附加库（TMap.service.Search）做关键词搜索，
// 选中后回填 GCJ-02 经纬度，供日程项 / 住宿表单录入坐标使用。
export default function LocationPicker({ city, placeholder, onPick }: Props) {
  const [options, setOptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadTencentMap()
      .then(() => !cancelled && setReady(true))
      .catch(() => !cancelled && setReady(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const doSearch = async (kw: string) => {
    if (!kw || !ready) {
      setOptions([]);
      return;
    }
    const TMap = getTMap();
    if (!TMap?.service?.Search) return;
    setLoading(true);
    try {
      const boundary = city ? `region(${city},0)` : 'region("全国",0)';
      const svc = new TMap.service.Search({ key: TENCENT_MAP_KEY });
      const res = await svc.search({ keyword: kw, boundary, page_size: 10 });
      const list = (res?.data || []).map((p: any) => ({
        value: p.id,
        label: (
          <div style={{ padding: "2px 0" }}>
            <div style={{ fontSize: 13 }}>{p.title}</div>
            {p.address && (
              <div style={{ fontSize: 11, color: "#999" }}>{p.address}</div>
            )}
          </div>
        ),
        raw: p,
      }));
      setOptions(list);
    } catch (e) {
      setOptions([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AutoComplete
      style={{ width: "100%" }}
      options={options}
      onSearch={doSearch}
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
      notFoundContent={loading ? <Spin size="small" /> : null}
      filterOption={false}
    />
  );
}
