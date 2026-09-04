import { Form, Input, Select, TimePicker, InputNumber, Upload, Button } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import type { FormInstance } from "antd";
import {
  ITEM_TYPE_LABELS,
  ITEM_TYPE_ICONS,
} from "../../../types";
import GeoLocationButton from "../../../components/GeoLocationButton";
import MapPicker from "../../../components/MapPicker";
import { useFormMapPicker } from "../../../hooks/useFormMapPicker";

const { TextArea } = Input;

interface ScheduleItemFormProps {
  form: FormInstance;
  uploading: boolean;
  imageUrlValue: string | undefined;
  onUploadImage: (file: File) => void;
  onRemoveImage: () => void;
}

/** 日程项「添加/编辑」表单内容（Modal 由父级控制，以支持 409 冲突处理读取 form） */
export default function ScheduleItemForm({
  form,
  uploading,
  imageUrlValue,
  onUploadImage,
  onRemoveImage,
}: ScheduleItemFormProps) {
  const { open, initial, openPicker, pickMapPoint, close } =
    useFormMapPicker(form);

  return (
    <>
      <Form form={form} layout="vertical">
        <Form.Item name="type" label="类型" rules={[{ required: true }]}>
          <Select>
            {Object.entries(ITEM_TYPE_LABELS).map(([k, v]) => (
              <Select.Option key={k} value={k}>
                {ITEM_TYPE_ICONS[k]} {v}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name="title"
          label="名称"
          rules={[{ required: true, message: "请输入名称" }]}
        >
          <Input placeholder="例如：故宫博物院" />
        </Form.Item>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Form.Item name="startTime" label="开始时间" style={{ flex: 1, minWidth: 140 }}>
            <TimePicker format="HH:mm" style={{ width: "100%" }} minuteStep={15} inputReadOnly />
          </Form.Item>
          <Form.Item name="endTime" label="结束时间" style={{ flex: 1, minWidth: 140 }}>
            <TimePicker format="HH:mm" style={{ width: "100%" }} minuteStep={15} inputReadOnly />
          </Form.Item>
        </div>

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

        <Form.Item label="项目图片">
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
              marginBottom: 8,
            }}
          >
            <Upload
              accept="image/jpeg,image/png,image/gif,image/webp"
              showUploadList={false}
              beforeUpload={(file) => {
                onUploadImage(file);
                return false;
              }}
            >
              <Button icon={<UploadOutlined />} loading={uploading}>
                本地上传
              </Button>
            </Upload>
            {imageUrlValue && (
              <>
                <img
                  src={String(imageUrlValue)}
                  alt="预览"
                  style={{
                    width: 56,
                    height: 56,
                    objectFit: "cover",
                    borderRadius: 6,
                    border: "1px solid #f0f0f0",
                  }}
                />
                <Button size="small" type="link" danger onClick={onRemoveImage}>
                  移除
                </Button>
              </>
            )}
          </div>
          <Form.Item name="imageUrl" noStyle>
            <Input placeholder="或直接粘贴图片 URL（选填）" />
          </Form.Item>
        </Form.Item>

        <Form.Item name="transportToNext" label="到下一站交通">
          <Input placeholder="例如：地铁2号线 / 步行10分钟" />
        </Form.Item>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Form.Item name="cost" label="预计花费 (¥)" style={{ flex: 1, minWidth: 140 }}>
            <InputNumber style={{ width: "100%" }} min={0} placeholder="0" />
          </Form.Item>
          <Form.Item name="status" label="状态" style={{ flex: 1, minWidth: 140 }}>
            <Select>
              <Select.Option value="pending">待规划</Select.Option>
              <Select.Option value="confirmed">已确认</Select.Option>
              <Select.Option value="done">已完成</Select.Option>
            </Select>
          </Form.Item>
        </div>

        <Form.Item name="description" label="备注">
          <TextArea rows={2} placeholder="补充说明..." />
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

export type { ScheduleItemFormProps };
