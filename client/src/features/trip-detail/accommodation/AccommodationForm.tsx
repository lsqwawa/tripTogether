import { Form, Input, Select, InputNumber } from "antd";
import type { FormInstance } from "antd";
import ResponsiveDatePicker from "../../../components/ResponsiveDatePicker";
import GeoLocationButton from "../../../components/GeoLocationButton";
import MapPicker from "../../../components/MapPicker";
import { useFormMapPicker } from "../../../hooks/useFormMapPicker";

const { TextArea } = Input;

interface AccommodationFormProps {
  form: FormInstance;
}

/** 住宿「添加/编辑」表单内容（不含 locationName 回填） */
export default function AccommodationForm({ form }: AccommodationFormProps) {
  const { open, initial, openPicker, pickMapPoint, close } =
    useFormMapPicker(form);

  return (
    <>
      <Form form={form} layout="vertical">
        <Form.Item
          name="name"
          label="住宿名称"
          rules={[{ required: true, message: "请输入名称" }]}
        >
          <Input placeholder="例如：京都四条大酒店" />
        </Form.Item>
        <Form.Item label="地点定位">
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <GeoLocationButton onClick={openPicker} />
            <span style={{ fontSize: 12, color: "#9ca3af" }}>
              选点后自动回填经纬度，再次点击可在地图上定位到上次选点
            </span>
          </div>
        </Form.Item>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Form.Item name="lat" label="纬度" style={{ flex: 1, minWidth: 140 }}>
            <InputNumber
              style={{ width: "100%" }}
              min={-90}
              max={90}
              step={0.000001}
              placeholder="自动回填"
            />
          </Form.Item>
          <Form.Item name="lng" label="经度" style={{ flex: 1, minWidth: 140 }}>
            <InputNumber
              style={{ width: "100%" }}
              min={-180}
              max={180}
              step={0.000001}
              placeholder="自动回填"
            />
          </Form.Item>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Form.Item
            name="checkInDate"
            label="入住日期"
            rules={[{ required: true }]}
            style={{ flex: 1, minWidth: 140 }}
          >
            <ResponsiveDatePicker style={{ width: "100%" }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item
            name="checkOutDate"
            label="退房日期"
            rules={[{ required: true }]}
            style={{ flex: 1, minWidth: 140 }}
          >
            <ResponsiveDatePicker style={{ width: "100%" }} format="YYYY-MM-DD" />
          </Form.Item>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Form.Item name="cost" label="花费 (¥)" style={{ flex: 1, minWidth: 140 }}>
            <InputNumber style={{ width: "100%" }} min={0} />
          </Form.Item>
          <Form.Item name="status" label="状态" style={{ flex: 1, minWidth: 140 }}>
            <Select>
              <Select.Option value="pending">待规划</Select.Option>
              <Select.Option value="booked">已预订</Select.Option>
              <Select.Option value="confirmed">已确认</Select.Option>
            </Select>
          </Form.Item>
        </div>
        <Form.Item name="bookingInfo" label="预订信息">
          <Input placeholder="订单号/确认码" />
        </Form.Item>
        <Form.Item name="notes" label="备注">
          <TextArea rows={2} />
        </Form.Item>
      </Form>

      <MapPicker
        open={open}
        initialLat={initial.lat}
        initialLng={initial.lng}
        onConfirm={pickMapPoint}
        onCancel={close}
      />
    </>
  );
}
