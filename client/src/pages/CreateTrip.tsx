import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  Form,
  Input,
  DatePicker,
  Button,
  message,
  InputNumber,
} from "antd";
import dayjs from "dayjs";
import { tripApi } from "../api";

const { TextArea } = Input;
const { RangePicker } = DatePicker;

export default function CreateTrip() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (values: any) => {
    const [start, end] = values.dateRange;
    setSubmitting(true);
    try {
      const trip = await tripApi.create({
        title: values.title,
        description: values.description,
        startDate: start.format("YYYY-MM-DD"),
        endDate: end.format("YYYY-MM-DD"),
        destination: values.destination,
      });
      message.success("旅行计划创建成功！");
      navigate(`/trips/${trip.id}`);
    } catch (e) {
      message.error("创建失败，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <h2 style={{ marginBottom: 24 }}>创建旅行计划 ✨</h2>
      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          requiredMark
        >
          <Form.Item
            name="title"
            label="计划名称"
            rules={[{ required: true, message: "请输入计划名称" }]}
          >
            <Input placeholder="例如：五一游" />
          </Form.Item>

          <Form.Item name="destination" label="目的地">
            <Input placeholder="例如：北京" />
          </Form.Item>

          <Form.Item
            name="dateRange"
            label="旅行日期"
            rules={[{ required: true, message: "请选择日期范围" }]}
          >
            <RangePicker
              style={{ width: "100%" }}
              format="YYYY-MM-DD"
              disabledDate={(current) =>
                current && current < dayjs().startOf("day")
              }
            />
          </Form.Item>

          <Form.Item name="description" label="计划描述（选填）">
            <TextArea
              rows={3}
              placeholder="简单描述一下这次旅行的目标和期待..."
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={submitting}
              block
              size="large"
            >
              创建计划
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <div style={{ marginTop: 16, color: "#999", fontSize: 13 }}>
        💡 创建后可以自动生成每日日程骨架，并通过邀请码邀请旅伴加入
      </div>
    </div>
  );
}
