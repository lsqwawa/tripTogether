import { Form, Input, Select, InputNumber } from "antd";
import type { FormInstance } from "antd";
import type { Trip } from "../../../types";
import ResponsiveDatePicker from "../../../components/ResponsiveDatePicker";
import LocationPicker from "../../../components/LocationPicker";
import GeoLocationButton from "../../../components/GeoLocationButton";
import MapPicker from "../../../components/MapPicker";
import { useFormMapPicker } from "../../../hooks/useFormMapPicker";

const { TextArea } = Input;

interface AccommodationFormProps {
  trip: Trip;
  form: FormInstance;
}

/** 住宿「添加/编辑」表单内容（不含 locationName 回填） */
export default function AccommodationForm({ trip, form }: AccommodationFormProps) {
  const { open, initial, openPicker, pickLocation, pickMapPoint, close } =
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
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <LocationPicker city={trip.destination} onPick={pickLocation} />
            </div>
            <GeoLocationButton onClick={openPicker} />
          </div>
        </Form.Item>

        <Form.Item name="address" label="地址">
          <Input placeholder="选点后自动回填，可补充门牌号" />
        </Form.Item>

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
        <Form.Item name="lat" hidden>
          <Input />
        </Form.Item>
        <Form.Item name="lng" hidden>
          <Input />
        </Form.Item>
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
