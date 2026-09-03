import { useState } from "react";
import type { FormInstance } from "antd";

export interface PickedPlace {
  lat: number;
  lng: number;
  name: string;
  address?: string;
}

export interface PickedPoint {
  lat: number;
  lng: number;
  address?: string;
}

/**
 * 「地点搜索 + 地图选点 + 坐标回填」组合。
 * 日程与住宿两处逐字重复，差异仅在是否回填 locationName（住宿表单无该字段）。
 */
export function useFormMapPicker(
  form: FormInstance,
  opts?: { fillLocationName?: boolean }
) {
  const [open, setOpen] = useState(false);
  const [initial, setInitial] = useState<{ lat?: number; lng?: number }>({});

  // 打开地图前读取当前坐标作初始中心点
  const openPicker = () => {
    const lat = Number(form.getFieldValue("lat"));
    const lng = Number(form.getFieldValue("lng"));
    setInitial(
      Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : {}
    );
    setOpen(true);
  };

  const pickLocation = (loc: PickedPlace) => {
    const cur = form.getFieldsValue();
    form.setFieldsValue({
      ...cur,
      ...(opts?.fillLocationName
        ? { locationName: cur.locationName || loc.name }
        : null),
      address: cur.address || loc.address || "",
      lat: loc.lat,
      lng: loc.lng,
    });
  };

  const pickMapPoint = (p: PickedPoint) => {
    const cur = form.getFieldsValue();
    form.setFieldsValue({
      ...cur,
      address: cur.address || p.address || "",
      lat: p.lat,
      lng: p.lng,
    });
    setOpen(false);
  };

  return { open, initial, openPicker, pickLocation, pickMapPoint, close: () => setOpen(false) };
}
