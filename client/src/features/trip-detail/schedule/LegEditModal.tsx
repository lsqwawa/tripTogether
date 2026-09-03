import { useEffect, useState } from "react";
import { Modal, Form, Input, Select, InputNumber } from "antd";
import { App as AntApp } from "antd";
import type { ScheduleItem } from "../../../types";
import { transportMatchApi } from "../../../api";
import { getErrorMessage, isHandledStatus } from "../../../utils/error";

export const LEG_MODE_OPTIONS: { value: string; label: string }[] = [
  { value: "walking", label: "🚶 步行" },
  { value: "driving", label: "🚗 驾车" },
  { value: "transit", label: "🚌 公交/地铁" },
  { value: "intercity", label: "🚄 城际" },
  { value: "none", label: "➖ 不接驳" },
];

export const LEG_MODE_ICON: Record<string, string> = {
  walking: "🚶",
  driving: "🚗",
  transit: "🚌",
  intercity: "🚄",
  none: "➖",
};

interface LegEditModalProps {
  item: ScheduleItem | null;
  tripId: string;
  onClose: () => void;
  onUpdated: () => void;
}

export default function LegEditModal({ item, tripId, onClose, onUpdated }: LegEditModalProps) {
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  // 打开时回填当前值（item 从 null 变为目标项即「打开」）
  useEffect(() => {
    if (!item) return;
    form.setFieldsValue({
      legMode: item.legMode || "driving",
      legSummary: item.legSummary || "",
      legDistanceM: item.legDistanceM ?? undefined,
      legDurationMin: item.legDurationMin ?? undefined,
    });
  }, [item, form]);

  const handleSave = async () => {
    if (!item) return;
    let values: {
      legMode: string;
      legSummary?: string;
      legDistanceM?: number;
      legDurationMin?: number;
    };
    try {
      values = await form.validateFields();
    } catch {
      return; // 校验失败由表单自身高亮
    }
    try {
      setSaving(true);
      await transportMatchApi.updateLeg(tripId, item.id, {
        legMode: values.legMode,
        legSummary: values.legSummary || undefined,
        legDistanceM: values.legDistanceM ?? undefined,
        legDurationMin: values.legDurationMin ?? undefined,
      });
      message.success("接驳方式已更新");
      onClose();
      onUpdated();
    } catch (e) {
      if (!isHandledStatus(e, 400)) {
        message.error(getErrorMessage(e, "保存失败"));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="编辑接驳方式"
      open={!!item}
      onOk={handleSave}
      onCancel={onClose}
      okText="保存"
      cancelText="取消"
      confirmLoading={saving}
      forceRender
      destroyOnHidden
    >
      <Form form={form} layout="vertical">
        <Form.Item name="legMode" label="接驳方式" rules={[{ required: true }]}>
          <Select>
            {LEG_MODE_OPTIONS.map((o) => (
              <Select.Option key={o.value} value={o.value}>
                {o.label}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item name="legSummary" label="展示文案">
          <Input placeholder="如：驾车约 12 分钟 · 3.2 km" />
        </Form.Item>
        <Form.Item name="legDistanceM" label="距离（米）">
          <InputNumber min={0} style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item name="legDurationMin" label="时长（分钟）">
          <InputNumber min={0} style={{ width: "100%" }} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
