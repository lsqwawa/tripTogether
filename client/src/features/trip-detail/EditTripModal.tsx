import { Button, Form, Input, InputNumber, Select, Modal } from "antd";
import { useEffect } from "react";
import { App as AntApp } from "antd";
import dayjs from "dayjs";
import type { Trip } from "../../types";
import { tripApi } from "../../api";
import { getErrorMessage } from "../../utils/error";
import ResponsiveRangePicker from "../../components/ResponsiveRangePicker";

const { TextArea } = Input;

interface EditTripModalProps {
  trip: Trip;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditTripModal({ trip, open, onClose, onSaved }: EditTripModalProps) {
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();

  // 打开时回填当前值
  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({
      title: trip.title,
      destination: trip.destination,
      dateRange: [dayjs(trip.startDate), dayjs(trip.endDate)],
      description: trip.description,
      status: trip.status,
      budgetTotal: trip.budgetTotal,
    });
  }, [open, trip, form]);

  const handleSave = async () => {
    let values: Record<string, any>;
    try {
      values = await form.validateFields();
    } catch {
      return; // 校验失败由表单自身高亮
    }
    try {
      const [start, end] = values.dateRange;
      await tripApi.update(trip.id, {
        title: values.title,
        destination: values.destination,
        startDate: start.format("YYYY-MM-DD"),
        endDate: end.format("YYYY-MM-DD"),
        description: values.description,
        status: values.status,
        budgetTotal: values.budgetTotal,
      });
      message.success("计划已更新");
      onClose();
      onSaved();
    } catch (e) {
      message.error(getErrorMessage(e, "保存失败"));
    }
  };

  return (
    <Modal
      title="编辑旅行计划"
      open={open}
      onOk={handleSave}
      onCancel={onClose}
      width={520}
      okText="保存"
      cancelText="取消"
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="title"
          label="计划名称"
          rules={[{ required: true, message: "请输入计划名称" }]}
        >
          <Input />
        </Form.Item>
        <Form.Item name="destination" label="目的地">
          <Input placeholder="例如：大阪、京都、奈良" />
        </Form.Item>
        <Form.Item
          name="dateRange"
          label="旅行日期"
          rules={[{ required: true, message: "请选择日期" }]}
        >
          <ResponsiveRangePicker style={{ width: "100%" }} format="YYYY-MM-DD" />
        </Form.Item>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Form.Item name="status" label="状态" style={{ flex: 1, minWidth: 140 }}>
            <Select>
              <Select.Option value="planning">规划中</Select.Option>
              <Select.Option value="ongoing">进行中</Select.Option>
              <Select.Option value="completed">已完成</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="budgetTotal" label="总预算 (¥)" style={{ flex: 1, minWidth: 140 }}>
            <InputNumber style={{ width: "100%" }} min={0} placeholder="0" />
          </Form.Item>
        </div>
        <Form.Item name="description" label="计划描述">
          <TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
