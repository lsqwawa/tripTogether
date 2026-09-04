import { useEffect, useMemo, useState } from "react";
import { Button, Form, Modal } from "antd";
import { App as AntApp } from "antd";
import { PlusOutlined, ThunderboltOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import type { Trip, ScheduleItem, WeatherDay } from "../../../types";
import { scheduleApi, uploadApi, transportMatchApi } from "../../../api";
import { getErrorMessage, isHandledStatus } from "../../../utils/error";
import ScheduleItemCard from "./ScheduleItemCard";
import ScheduleItemForm from "./ScheduleItemForm";
import LegEditModal from "./LegEditModal";
import ConflictModal from "./ConflictModal";

interface ScheduleTabProps {
  trip: Trip;
  onUpdate: () => void;
  readOnly: boolean;
  weather?: Record<string, WeatherDay>;
}

export default function ScheduleTab({ trip, onUpdate, readOnly, weather }: ScheduleTabProps) {
  const { message } = AntApp.useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  const [currentScheduleId, setCurrentScheduleId] = useState<string>("");
  const [form] = Form.useForm();
  const [conflictLatest, setConflictLatest] = useState<ScheduleItem | null>(null);
  const [uploading, setUploading] = useState(false);
  const imageUrlValue = Form.useWatch("imageUrl", form) as string | undefined;
  const [matching, setMatching] = useState(false);
  // 接驳编辑对象；null 即关闭。单例 Modal，卡片不再各自持有
  const [editingLegItem, setEditingLegItem] = useState<ScheduleItem | null>(null);

  // 仅记录被拖拽过的天，覆盖顺序；其余直接读服务端顺序（P1-05）
  const [pendingOrder, setPendingOrder] = useState<Record<string, string[]>>({});

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    // 触摸长按 250ms 才进入拖拽，避免与页面滚动冲突（移动端专项）
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } })
  );

  const itemsByScheduleId = useMemo(() => {
    const map: Record<string, ScheduleItem[]> = {};
    trip.schedules?.forEach((s) => {
      const order = pendingOrder[s.id];
      const base = s.items ?? [];
      map[s.id] = order
        ? [...base].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
        : base;
    });
    return map;
  }, [trip.schedules, pendingOrder]);

  const handleUploadImage = async (file: File) => {
    setUploading(true);
    try {
      const { url } = await uploadApi.image(file);
      form.setFieldsValue({ imageUrl: url });
      message.success("图片已上传");
    } catch (e) {
      message.error(getErrorMessage(e, "上传失败，请稍后重试"));
    } finally {
      setUploading(false);
    }
    return false;
  };

  const openAddModal = (scheduleId: string) => {
    setCurrentScheduleId(scheduleId);
    setEditingItem(null);
    form.resetFields();
    form.setFieldsValue({ type: "attraction", status: "pending" });
    setModalOpen(true);
  };

  const openEditModal = (item: ScheduleItem) => {
    setEditingItem(item);
    setCurrentScheduleId(item.scheduleId);
    form.setFieldsValue({
      ...item,
      startTime: item.startTime ? dayjs(item.startTime, "HH:mm:ss") : undefined,
      endTime: item.endTime ? dayjs(item.endTime, "HH:mm:ss") : undefined,
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
        startTime: values.startTime?.format("HH:mm:ss"),
        endTime: values.endTime?.format("HH:mm:ss"),
        version: editingItem?.version,
      };
      if (editingItem) {
        await scheduleApi.updateItem(trip.id, currentScheduleId, editingItem.id, data);
        message.success("已更新");
      } else {
        await scheduleApi.addItem(trip.id, currentScheduleId, data);
        message.success("已添加");
      }
      setModalOpen(false);
      onUpdate();
    } catch (e) {
      if (isHandledStatus(e, 409)) {
        setConflictLatest((e as { response?: { data?: { latest?: ScheduleItem } } }).response?.data?.latest ?? null);
        return;
      }
      message.error(getErrorMessage(e, "保存失败"));
    }
  };

  const handleDelete = async (item: ScheduleItem) => {
    try {
      await scheduleApi.deleteItem(trip.id, item.scheduleId, item.id);
      message.success("已删除");
      onUpdate();
    } catch (e) {
      message.error(getErrorMessage(e, "删除失败"));
    }
  };

  const toggleStatus = async (item: ScheduleItem) => {
    const nextStatus = item.status === "done" || item.status === "completed" ? "pending" : "done";
    try {
      await scheduleApi.updateItem(trip.id, item.scheduleId, item.id, { status: nextStatus });
      onUpdate();
    } catch (e) {
      message.error(getErrorMessage(e, "更新状态失败"));
    }
  };

  const handleDragEnd = async (scheduleId: string, event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const items = itemsByScheduleId[scheduleId] || [];
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newItems = arrayMove(items, oldIndex, newIndex);
    // 乐观覆盖顺序：UI 立即移动
    setPendingOrder((p) => ({ ...p, [scheduleId]: newItems.map((i) => i.id) }));

    try {
      await scheduleApi.reorderItems(trip.id, scheduleId, newItems.map((i) => i.id));
      // 成功：刷新数据。服务端已按 sortOrder 持久化，onUpdate 返回后 trip.schedules
      // 更新为新顺序，此时再清空 pendingOrder 才安全，避免回弹。
      await onUpdate();
    } catch {
      message.error("排序失败，刷新重试");
      await onUpdate();
    } finally {
      setPendingOrder((p) => {
        const n = { ...p };
        delete n[scheduleId];
        return n;
      });
    }
  };

  const handleMatchTransport = async () => {
    setMatching(true);
    try {
      const res = await transportMatchApi.match(trip.id);
      const parts = [`已匹配 ${res.legsApplied} 段接驳`];
      if (res.skippedNoCoord > 0) parts.push(`跳过 ${res.skippedNoCoord} 段（缺坐标）`);
      if (res.intercityDrafts?.length) parts.push(`生成 ${res.intercityDrafts.length} 条城际草稿待确认`);
      message.success(parts.join("，"));
      onUpdate();
    } catch (e) {
      message.error(getErrorMessage(e, "匹配失败，请稍后重试"));
    } finally {
      setMatching(false);
    }
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <span style={{ color: "#6b7280", fontSize: 13 }}>
          🚗 系统可基于日程项坐标，自动推算相邻景点的接驳方式与城际交通草稿
        </span>
        {!readOnly && (
          <Button
            type="primary"
            size="small"
            icon={<ThunderboltOutlined />}
            loading={matching}
            onClick={handleMatchTransport}
          >
            一键匹配接驳
          </Button>
        )}
      </div>
      {trip.schedules?.map((schedule) => {
        const items = itemsByScheduleId[schedule.id] || [];
        return (
          <div key={schedule.id} className="day-card">
            <div className="day-card-header">
              <div>
                <span className="day-card-title">
                  {schedule.title && schedule.title !== `第${schedule.dayIndex}天`
                    ? `${schedule.title}`
                    : `第${schedule.dayIndex}天`}
                </span>
                <span className="day-card-date">
                  {dayjs(schedule.date).format("MM月DD日 ddd")}
                  {weather?.[schedule.date] && (
                    <span style={{ marginLeft: 8, color: "#6b7280" }}>
                      {weather[schedule.date].icon} {weather[schedule.date].tmax}°/
                      {weather[schedule.date].tmin}°
                    </span>
                  )}
                </span>
              </div>
              {!readOnly && (
                <Button
                  size="small"
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() => openAddModal(schedule.id)}
                >
                  添加
                </Button>
              )}
            </div>
            {items.length > 0 ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(e) => handleDragEnd(schedule.id, e)}
              >
                <SortableContext
                  items={items.map((i) => i.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {items.map((item) => (
                    <ScheduleItemCard
                      key={item.id}
                      item={item}
                      onEdit={() => openEditModal(item)}
                      onDelete={() => handleDelete(item)}
                      onToggle={() => toggleStatus(item)}
                      onEditLeg={() => setEditingLegItem(item)}
                      readOnly={readOnly}
                      tripId={trip.id}
                      onLegUpdated={onUpdate}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            ) : (
              <div
                style={{ padding: 24, textAlign: "center", color: "#d1d5db" }}
              >
                {readOnly ? "这一天还没有安排" : "还没有安排，点击右上角\"添加\"开始规划"}
              </div>
            )}
          </div>
        );
      })}

      {/* 添加/编辑日程项 Modal */}
      <Modal
        title={editingItem ? "编辑安排" : "添加安排"}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        width={520}
        okText="保存"
        cancelText="取消"
        forceRender
        destroyOnHidden
      >
        <ScheduleItemForm
          form={form}
          uploading={uploading}
          imageUrlValue={imageUrlValue}
          onUploadImage={handleUploadImage}
          onRemoveImage={() => form.setFieldsValue({ imageUrl: undefined })}
        />
      </Modal>

      <ConflictModal
        latest={conflictLatest}
        tripId={trip.id}
        scheduleId={currentScheduleId}
        editingItem={editingItem}
        form={form}
        onClose={() => {
          setConflictLatest(null);
          setModalOpen(false);
          onUpdate();
        }}
        onResolved={() => {
          setConflictLatest(null);
          setModalOpen(false);
          onUpdate();
        }}
      />

      <LegEditModal
        item={editingLegItem}
        tripId={trip.id}
        onClose={() => setEditingLegItem(null)}
        onUpdated={onUpdate}
      />
    </div>
  );
}
