import { useState } from "react";
import { Button, Card, Tag, Popconfirm, Modal, Form } from "antd";
import { App as AntApp } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import type { Trip, Accommodation } from "../../../types";
import { accommodationApi } from "../../../api";
import { STATUS_LABELS, STATUS_COLORS } from "../../../types";
import { getErrorMessage } from "../../../utils/error";
import AccommodationForm from "./AccommodationForm";

interface AccommodationTabProps {
  trip: Trip;
  onUpdate: () => void;
  readOnly: boolean;
}

export default function AccommodationTab({ trip, onUpdate, readOnly }: AccommodationTabProps) {
  const { message } = AntApp.useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Accommodation | null>(null);
  const [form] = Form.useForm();

  const openAdd = () => {
    setEditingItem(null);
    form.resetFields();
    form.setFieldsValue({ status: "pending" });
    setModalOpen(true);
  };

  const openEdit = (item: Accommodation) => {
    setEditingItem(item);
    form.setFieldsValue({
      ...item,
      checkInDate: item.checkInDate ? dayjs(item.checkInDate) : undefined,
      checkOutDate: item.checkOutDate ? dayjs(item.checkOutDate) : undefined,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    let values: Record<string, any>;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    try {
      const data = {
        ...values,
        checkInDate: values.checkInDate?.format("YYYY-MM-DD"),
        checkOutDate: values.checkOutDate?.format("YYYY-MM-DD"),
      };
      if (editingItem) {
        await accommodationApi.update(trip.id, editingItem.id, data);
        message.success("已更新");
      } else {
        await accommodationApi.create(trip.id, data);
        message.success("已添加");
      }
      setModalOpen(false);
      onUpdate();
    } catch (e) {
      message.error(getErrorMessage(e, "保存失败"));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await accommodationApi.delete(trip.id, id);
      message.success("已删除");
      onUpdate();
    } catch (e) {
      message.error(getErrorMessage(e, "删除失败"));
    }
  };

  return (
    <div>
      <div className="flex-between mb-12" style={{ flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ margin: 0 }}>🏨 住宿安排</h3>
        {!readOnly && (
          <Button type="dashed" icon={<PlusOutlined />} onClick={openAdd}>
            添加住宿
          </Button>
        )}
      </div>
      {!trip.accommodations || trip.accommodations.length === 0 ? (
        <div
          style={{
            padding: 20,
            textAlign: "center",
            color: "#d1d5db",
            background: "#fafafa",
            borderRadius: 8,
          }}
        >
          尚未添加住宿
        </div>
      ) : (
        trip.accommodations.map((item) => (
          <Card
            key={item.id}
            size="small"
            style={{ marginBottom: 8 }}
            actions={
              readOnly
                ? undefined
                : [
                    <Popconfirm
                      key="delete"
                      title="确认删除？"
                      onConfirm={() => handleDelete(item.id)}
                    >
                      <DeleteOutlined key="del" />
                    </Popconfirm>,
                    <EditOutlined key="edit" onClick={() => openEdit(item)} />,
                  ]
            }
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: 28, flexShrink: 0 }}>🏨</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500 }}>{item.name}</div>
                <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
                  {dayjs(item.checkInDate).format("MM-DD")} ~{" "}
                  {dayjs(item.checkOutDate).format("MM-DD")}
                  {item.address && ` · 📍 ${item.address}`}
                  {item.cost ? ` · ¥${item.cost}` : ""}
                </div>
                {item.notes && (
                  <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
                    {item.notes}
                  </div>
                )}
              </div>
              <Tag color={STATUS_COLORS[item.status]}>{STATUS_LABELS[item.status]}</Tag>
            </div>
          </Card>
        ))
      )}

      <Modal
        title={editingItem ? "编辑住宿" : "添加住宿"}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        width={520}
        okText="保存"
        cancelText="取消"
        forceRender
        destroyOnHidden
      >
        <AccommodationForm form={form} />
      </Modal>
    </div>
  );
}
