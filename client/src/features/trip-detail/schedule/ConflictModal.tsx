import { Modal } from "antd";
import { App as AntApp } from "antd";
import type { ScheduleItem } from "../../../types";
import { scheduleApi } from "../../../api";
import { getErrorMessage } from "../../../utils/error";

interface ConflictModalProps {
  latest: ScheduleItem | null;
  tripId: string;
  scheduleId: string;
  editingItem: ScheduleItem | null;
  form: ReturnType<typeof import("antd").Form.useForm>[0];
  onClose: () => void;
  onResolved: () => void;
}

/** 8.2 编辑冲突：展示他人最新版本，允许覆盖或放弃 */
export default function ConflictModal({
  latest,
  tripId,
  scheduleId,
  editingItem,
  form,
  onClose,
  onResolved,
}: ConflictModalProps) {
  const { message } = AntApp.useApp();

  const handleForceSave = async () => {
    if (!editingItem) return;
    try {
      const values = form.getFieldsValue() as Record<string, any>;
      const data = {
        ...values,
        startTime: values.startTime?.format("HH:mm:ss"),
        endTime: values.endTime?.format("HH:mm:ss"),
        version: latest?.version,
        force: true,
      };
      await scheduleApi.updateItem(tripId, scheduleId, editingItem.id, data);
      message.success("已覆盖保存");
      onResolved();
    } catch (e) {
      message.error(getErrorMessage(e, "保存失败，请重试"));
    }
  };

  return (
    <Modal
      title="⚠️ 编辑冲突"
      open={!!latest}
      okText="用我的版本覆盖"
      cancelText="放弃修改"
      onCancel={onClose}
      onOk={handleForceSave}
    >
      <p>该行程项已被其他成员修改。你可以：</p>
      <ul style={{ paddingLeft: 20, lineHeight: 1.8 }}>
        <li>
          <b>用我的版本覆盖</b>：以你当前编辑的内容为准，覆盖他人的修改。
        </li>
        <li>
          <b>放弃修改</b>：保留他人的最新版本，并重新加载数据。
        </li>
      </ul>
      <p style={{ color: "#999", fontSize: 12, marginTop: 8 }}>
        建议先关闭查看对方改了什么，最新内容会在列表中显示。
      </p>
    </Modal>
  );
}
