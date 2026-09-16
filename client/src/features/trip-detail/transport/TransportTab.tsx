import { useState } from "react";
import { Form, Modal, Divider } from "antd";
import { App as AntApp } from "antd";
import dayjs from "dayjs";
import type { Trip, Transportation } from "../../../types";
import { transportApi } from "../../../api";
import { getErrorMessage } from "../../../utils/error";
import { getLatLngbyAddress } from "../../../utils/tencentMap";
import TransportForm from "./TransportForm";
import TransportSectionList from "./TransportSectionList";

interface TransportTabProps {
  trip: Trip;
  onUpdate: () => void;
  readOnly: boolean;
}

export default function TransportTab({ trip, onUpdate, readOnly }: TransportTabProps) {
  const { message } = AntApp.useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Transportation | null>(null);
  const [form] = Form.useForm();

  const openAdd = (type: "departure" | "return" | "intercity") => {
    setEditingItem(null);
    form.resetFields();
    form.setFieldsValue({ type, transportType: "flight", status: "pending" });
    setModalOpen(true);
  };

  const openEdit = (item: Transportation) => {
    setEditingItem(item);
    form.setFieldsValue({
      ...item,
      departureTime: item.departureTime ? dayjs(item.departureTime) : undefined,
      arrivalTime: item.arrivalTime ? dayjs(item.arrivalTime) : undefined,
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
      // 兜底：仅手填地名未选 POI 时，提交前尝试地理编码
      let { depLat, depLng, arrLat, arrLng } = values;
      let geoFilled = false;
      if (depLat == null && depLng == null && values.departurePlace) {
        const g = await getLatLngbyAddress(values.departurePlace);
        if (g) {
          depLat = g.lat;
          depLng = g.lng;
          geoFilled = true;
        }
      }
      if (arrLat == null && arrLng == null && values.arrivalPlace) {
        const g = await getLatLngbyAddress(values.arrivalPlace);
        if (g) {
          arrLat = g.lat;
          arrLng = g.lng;
          geoFilled = true;
        }
      }
      const data = {
        ...values,
        depLat,
        depLng,
        arrLat,
        arrLng,
        departureTime: values.departureTime?.toISOString(),
        arrivalTime: values.arrivalTime?.toISOString(),
      };
      if (editingItem) {
        await transportApi.update(trip.id, editingItem.id, data);
        message.success(geoFilled ? "已更新（地点坐标已自动补齐）" : "已更新");
      } else {
        await transportApi.create(trip.id, data);
        message.success(geoFilled ? "已添加（地点坐标已自动补齐）" : "已添加");
      }
      setModalOpen(false);
      onUpdate();
    } catch (e) {
      message.error(getErrorMessage(e, "保存失败"));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await transportApi.delete(trip.id, id);
      message.success("已删除");
      onUpdate();
    } catch (e) {
      message.error(getErrorMessage(e, "删除失败"));
    }
  };

  const sectionItems = (type: "departure" | "return" | "intercity") =>
    trip.transportations?.filter((t) => t.type === type) || [];

  return (
    <div>
      <TransportSectionList
        type="departure"
        label="出发交通"
        icon="🚀"
        items={sectionItems("departure")}
        readOnly={readOnly}
        onAdd={openAdd}
        onEdit={openEdit}
        onDelete={handleDelete}
      />
      <Divider />
      <TransportSectionList
        type="intercity"
        label="城际交通"
        icon="🚃"
        items={sectionItems("intercity")}
        readOnly={readOnly}
        onAdd={openAdd}
        onEdit={openEdit}
        onDelete={handleDelete}
      />
      <Divider />
      <TransportSectionList
        type="return"
        label="返程交通"
        icon="🏠"
        items={sectionItems("return")}
        readOnly={readOnly}
        onAdd={openAdd}
        onEdit={openEdit}
        onDelete={handleDelete}
      />

      <Modal
        title={editingItem ? "编辑交通" : "添加交通"}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        width={520}
        okText="保存"
        cancelText="取消"
        forceRender
        destroyOnHidden
      >
        <TransportForm form={form} />
      </Modal>
    </div>
  );
}
