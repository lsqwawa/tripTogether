import { Button, Card, Tag, Popconfirm } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import type { Transportation } from "../../../types";
import {
  TRANSPORT_LABELS,
  TRANSPORT_ICONS,
  STATUS_LABELS,
  STATUS_COLORS,
} from "../../../types";

interface TransportSectionListProps {
  type: "departure" | "return" | "intercity";
  label: string;
  icon: string;
  items: Transportation[];
  readOnly: boolean;
  onAdd: (type: "departure" | "return" | "intercity") => void;
  onEdit: (item: Transportation) => void;
  onDelete: (id: string) => void;
}

export default function TransportSectionList({
  type,
  label,
  icon,
  items,
  readOnly,
  onAdd,
  onEdit,
  onDelete,
}: TransportSectionListProps) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div className="flex-between mb-12" style={{ flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ margin: 0 }}>
          {icon} {label}
        </h3>
        {!readOnly && (
          <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={() => onAdd(type)}>
            添加
          </Button>
        )}
      </div>
      {items.length === 0 ? (
        <div
          style={{
            padding: 20,
            textAlign: "center",
            color: "#d1d5db",
            background: "#fafafa",
            borderRadius: 8,
          }}
        >
          尚未添加{label}
        </div>
      ) : (
        items.map((item) => (
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
                      onConfirm={() => onDelete(item.id)}
                    >
                      <DeleteOutlined key="del" />
                    </Popconfirm>,
                    <EditOutlined key="edit" onClick={() => onEdit(item)} />,
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
              <span style={{ fontSize: 28, flexShrink: 0 }}>
                {TRANSPORT_ICONS[item.transportType]}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500 }}>
                  {TRANSPORT_LABELS[item.transportType]}
                  {item.departurePlace && item.arrivalPlace && (
                    <span style={{ color: "#6b7280", fontWeight: 400 }}>
                      {" "}
                      · {item.departurePlace} → {item.arrivalPlace}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
                  {item.departureTime && dayjs(item.departureTime).format("MM-DD HH:mm")}
                  {item.arrivalTime && ` ~ ${dayjs(item.arrivalTime).format("HH:mm")}`}
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
    </div>
  );
}
