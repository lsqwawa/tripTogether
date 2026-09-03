import { Button, Tag, Popconfirm, Tooltip } from "antd";
import { App as AntApp } from "antd";
import {
  HolderOutlined,
  DeleteOutlined,
  EditOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ScheduleItem } from "../../../types";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  ITEM_TYPE_ICONS,
} from "../../../types";
import { transportMatchApi } from "../../../api";
import { getErrorMessage, isHandledStatus } from "../../../utils/error";
import { LEG_MODE_ICON } from "./LegEditModal";

interface ScheduleItemCardProps {
  item: ScheduleItem;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onEditLeg: () => void;
  readOnly: boolean;
  tripId: string;
  onLegUpdated: () => void;
}

export default function ScheduleItemCard({
  item,
  onEdit,
  onDelete,
  onToggle,
  onEditLeg,
  readOnly,
  tripId,
  onLegUpdated,
}: ScheduleItemCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id, disabled: readOnly });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const { message } = AntApp.useApp();

  const isDone = item.status === "done" || item.status === "completed";

  const handleLegDelete = async () => {
    try {
      await transportMatchApi.clearLeg(tripId, item.id);
      message.success("已删除该接驳");
      onLegUpdated();
    } catch (e) {
      if (!isHandledStatus(e, 400)) {
        message.error(getErrorMessage(e, "删除失败"));
      }
    }
  };

  return (
    <div ref={setNodeRef} style={style} className="schedule-item">
      {!readOnly && (
        <span
          {...attributes}
          {...listeners}
          style={{
            cursor: "grab",
            flexShrink: 0,
            marginTop: 2,
            color: "#ccc",
            touchAction: "none",
          }}
        >
          <HolderOutlined />
        </span>
      )}
      <span className="schedule-item-icon">{ITEM_TYPE_ICONS[item.type]}</span>
      <div className="schedule-item-content">
        <div className="schedule-item-title">
          <span
            style={{
              textDecoration: isDone ? "line-through" : "none",
              opacity: isDone ? 0.6 : 1,
            }}
          >
            {item.title}
          </span>
          <Tag color={STATUS_COLORS[item.status]} style={{ fontSize: 11 }}>
            {STATUS_LABELS[item.status]}
          </Tag>
        </div>
        <div className="schedule-item-meta">
          {item.startTime && <span>⏰ {item.startTime.slice(0, 5)}</span>}
          {item.locationName && <span>📍 {item.locationName}</span>}
          {item.cost != null && item.cost > 0 && <span>💰 ¥{item.cost}</span>}
          {item.transportToNext && <span>🚗 到下一站: {item.transportToNext}</span>}
        </div>
        {item.imageUrl && (
          <img
            src={item.imageUrl}
            alt={item.title}
            style={{
              maxWidth: "100%",
              maxHeight: 160,
              borderRadius: 8,
              marginTop: 6,
              objectFit: "cover",
            }}
          />
        )}
        {item.description && (
          <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
            {item.description}
          </div>
        )}
        {item.legMode && (
          <div
            style={{
              marginTop: 6,
              padding: "6px 8px",
              background: "#f5f7ff",
              border: "1px solid #e6ebff",
              borderRadius: 8,
              fontSize: 12,
              color: "#475569",
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            {/* 平级结构：点击区与删除按钮分离，避免 Portal 冒泡 hack */}
            <div
              onClick={readOnly ? undefined : onEditLeg}
              style={{
                flex: 1,
                minWidth: 0,
                cursor: readOnly ? "default" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                flexWrap: "wrap",
              }}
            >
              <span>{LEG_MODE_ICON[item.legMode] || "🚗"}</span>
              <span>{item.legSummary || "接驳段"}</span>
              {item.legAutoMatched === false ? (
                <Tag style={{ marginLeft: "auto", fontSize: 10 }} color="gold">
                  人工
                </Tag>
              ) : (
                !readOnly && (
                  <Tag style={{ marginLeft: "auto", fontSize: 10 }} color="blue">
                    自动
                  </Tag>
                )
              )}
            </div>
            {!readOnly && (
              <Popconfirm title="删除该接驳？" onConfirm={handleLegDelete}>
                <Button
                  size="small"
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                />
              </Popconfirm>
            )}
          </div>
        )}
      </div>
      {!readOnly && (
        <div className="schedule-item-actions">
          <Tooltip title={isDone ? "取消完成" : "标记完成"}>
            <Button
              size="small"
              type="text"
              icon={<CheckCircleOutlined />}
              onClick={onToggle}
              style={{ color: isDone ? "#52c41a" : "#ccc" }}
            />
          </Tooltip>
          <Button size="small" type="text" icon={<EditOutlined />} onClick={onEdit} />
          <Popconfirm title="确认删除？" onConfirm={onDelete}>
            <Button size="small" type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </div>
      )}
    </div>
  );
}
