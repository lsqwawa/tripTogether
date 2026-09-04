import { useState } from "react";
import type { FormInstance } from "antd";

export interface PickedPoint {
  lat: number;
  lng: number;
  address?: string;
}

/**
 * 「地图选点 + 坐标回填」组合。
 * 日程与住宿表单共用：打开地图前读表单已有坐标作初始中心点，
 * 选点后自动回填 lat/lng（地址仍写回 address 供地图标注/分享页展示）。
 */
export function useFormMapPicker(form: FormInstance) {
  const [open, setOpen] = useState(false);
  const [initial, setInitial] = useState<{ lat?: number; lng?: number }>({});

  // 打开地图前读取当前坐标作初始中心点（有经纬度时定位到上次选点）
  const openPicker = () => {
    const lat = Number(form.getFieldValue("lat"));
    const lng = Number(form.getFieldValue("lng"));
    setInitial(
      Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : {}
    );
    setOpen(true);
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

  return { open, initial, openPicker, pickMapPoint, close: () => setOpen(false) };
}
