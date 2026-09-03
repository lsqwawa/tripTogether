import { Form, Input, Select, InputNumber } from "antd";
import type { FormInstance } from "antd";
import {
  TRANSPORT_LABELS,
  TRANSPORT_ICONS,
} from "../../../types";
import ResponsiveDatePicker from "../../../components/ResponsiveDatePicker";
import TransportLookupPreview from "./TransportLookupPreview";
import type { TransportLookupState } from "./useTransportLookup";

const { TextArea } = Input;

interface TransportFormProps {
  form: FormInstance;
  lookup: TransportLookupState | null;
  lookupLoading: boolean;
  lookupError: string | null;
  onBackfill: () => void;
}

/** 交通「添加/编辑」表单内容 */
export default function TransportForm({
  form,
  lookup,
  lookupLoading,
  lookupError,
  onBackfill,
}: TransportFormProps) {
  return (
    <Form form={form} layout="vertical">
      <Form.Item name="type" hidden>
        <Input />
      </Form.Item>
      <Form.Item name="transportType" label="交通方式" rules={[{ required: true }]}>
        <Select>
          {Object.entries(TRANSPORT_LABELS).map(([k, v]) => (
            <Select.Option key={k} value={k}>
              {TRANSPORT_ICONS[k]} {v}
            </Select.Option>
          ))}
        </Select>
      </Form.Item>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Form.Item name="departurePlace" label="出发地" style={{ flex: 1, minWidth: 160 }}>
          <Input
            placeholder="例如：北京首都机场"
            onChange={() => form.setFieldsValue({ depLat: undefined, depLng: undefined })}
          />
        </Form.Item>
        <Form.Item name="arrivalPlace" label="到达地" style={{ flex: 1, minWidth: 160 }}>
          <Input
            placeholder="例如：大阪关西机场"
            onChange={() => form.setFieldsValue({ arrLat: undefined, arrLng: undefined })}
          />
        </Form.Item>
      </div>
      <Form.Item name="depLat" hidden>
        <Input />
      </Form.Item>
      <Form.Item name="depLng" hidden>
        <Input />
      </Form.Item>
      <Form.Item name="arrLat" hidden>
        <Input />
      </Form.Item>
      <Form.Item name="arrLng" hidden>
        <Input />
      </Form.Item>
      <div style={{ fontSize: 12, color: "#9ca3af", marginTop: -12, marginBottom: 12 }}>
        手填地名后，保存会自动尝试地理编码以在地图画出跨城连线。
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Form.Item name="departureTime" label="出发时间" style={{ flex: 1, minWidth: 140 }}>
          <ResponsiveDatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item name="arrivalTime" label="到达时间" style={{ flex: 1, minWidth: 140 }}>
          <ResponsiveDatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: "100%" }} />
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
            <Select.Option value="completed">已完成</Select.Option>
          </Select>
        </Form.Item>
      </div>
      <Form.Item name="bookingInfo" label="预订信息">
        <Input placeholder="航班号/车次号/订单号" />
      </Form.Item>

      {/* 班次实时查询预览 */}
      <TransportLookupPreview
        lookup={lookup}
        loading={lookupLoading}
        error={lookupError}
        onBackfill={onBackfill}
      />

      <Form.Item name="notes" label="备注">
        <TextArea rows={2} />
      </Form.Item>
    </Form>
  );
}
