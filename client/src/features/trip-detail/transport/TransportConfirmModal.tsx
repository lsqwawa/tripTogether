import { useEffect } from "react";
import { Form, Input, Select, InputNumber, Modal } from "antd";
import { App as AntApp } from "antd";
import dayjs from "dayjs";
import type { Transportation } from "../../../types";
import { transportMatchApi } from "../../../api";
import { TRANSPORT_LABELS, TRANSPORT_ICONS } from "../../../types";
import { getErrorMessage, isHandledStatus } from "../../../utils/error";
import ResponsiveDatePicker from "../../../components/ResponsiveDatePicker";

const { TextArea } = Input;

interface TransportConfirmModalProps {
  tripId: string;
  item: Transportation | null;
  onClose: () => void;
  onConfirmed: () => void;
}

/** 确认采纳系统生成的城际草稿：可一并修正方式/时间/费用等 */
export default function TransportConfirmModal({
  tripId,
  item,
  onClose,
  onConfirmed,
}: TransportConfirmModalProps) {
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();

  useEffect(() => {
    if (!item) return;
    form.setFieldsValue({
      ...item,
      status: item.status || "confirmed",
      departureTime: item.departureTime ? dayjs(item.departureTime) : undefined,
      arrivalTime: item.arrivalTime ? dayjs(item.arrivalTime) : undefined,
    });
  }, [item, form]);

  const handleConfirm = async () => {
    if (!item) return;
    let values: Record<string, any>;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    try {
      await transportMatchApi.confirm(tripId, item.id, {
        status: values.status,
        transportType: values.transportType,
        bookingInfo: values.bookingInfo || undefined,
        notes: values.notes || undefined,
        cost: values.cost ?? undefined,
        departureTime: values.departureTime?.toISOString(),
        arrivalTime: values.arrivalTime?.toISOString(),
      });
      message.success("已确认采纳城际交通");
      onClose();
      onConfirmed();
    } catch (e) {
      if (!isHandledStatus(e, 400)) {
        message.error(getErrorMessage(e, "确认失败"));
      }
    }
  };

  return (
    <Modal
      title="确认采纳城际交通"
      open={!!item}
      onOk={handleConfirm}
      onCancel={onClose}
      okText="确认采纳"
      cancelText="取消"
      forceRender
      destroyOnHidden
    >
      <Form form={form} layout="vertical">
        <Form.Item name="transportType" label="交通方式" rules={[{ required: true }]}>
          <Select>
            {Object.entries(TRANSPORT_LABELS).map(([k, v]) => (
              <Select.Option key={k} value={k}>
                {TRANSPORT_ICONS[k]} {v}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item name="bookingInfo" label="预订信息">
          <Input placeholder="航班号/车次号/订单号" />
        </Form.Item>
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
            <InputNumber min={0} style={{ width: "100%" }} />
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
        <Form.Item name="notes" label="备注">
          <TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
