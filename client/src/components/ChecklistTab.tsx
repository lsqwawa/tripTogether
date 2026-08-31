import { useEffect, useState } from "react";
import {
  Button,
  Checkbox,
  Empty,
  Input,
  Popconfirm,
  Progress,
  Select,
  App as AntApp,
} from "antd";
import { PlusOutlined, DeleteOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { checklistApi } from "../api";
import type { Trip, ChecklistItem } from "../types";
import {
  CHECKLIST_CATEGORY_LABELS,
  CHECKLIST_CATEGORY_ICONS,
} from "../types";

interface Props {
  trip: Trip;
  readOnly: boolean;
}

const CATEGORY_ORDER = [
  "documents",
  "clothing",
  "electronics",
  "toiletries",
  "medicine",
  "other",
];

export default function ChecklistTab({ trip, readOnly }: Props) {
  const { message } = AntApp.useApp();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("other");
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setItems(await checklistApi.list(trip.id));
    } catch {
      message.error("加载清单失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.id]);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    try {
      await checklistApi.create(trip.id, { name, category: newCategory });
      setNewName("");
      await load();
    } catch (e: any) {
      message.error(e?.response?.data?.error || "添加失败");
    } finally {
      setAdding(false);
    }
  };

  const handleTemplate = async () => {
    setAdding(true);
    try {
      const { added } = await checklistApi.addTemplate(trip.id);
      message.success(added > 0 ? `已添加 ${added} 项常用行李` : "常用物品都已在清单中");
      await load();
    } catch {
      message.error("添加失败");
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (item: ChecklistItem) => {
    // 乐观更新，失败回滚
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, checked: !i.checked } : i))
    );
    try {
      await checklistApi.update(trip.id, item.id, { checked: !item.checked });
    } catch {
      message.error("更新失败");
      load();
    }
  };

  const handleDelete = async (item: ChecklistItem) => {
    try {
      await checklistApi.delete(trip.id, item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch {
      message.error("删除失败");
    }
  };

  const checkedCount = items.filter((i) => i.checked).length;
  const percent =
    items.length === 0 ? 0 : Math.round((checkedCount / items.length) * 100);

  if (loading) {
    return <div style={{ textAlign: "center", padding: 40 }}>加载中...</div>;
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      {/* 进度 */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 13,
            color: "#6b7280",
            marginBottom: 4,
          }}
        >
          <span>🧳 收拾进度</span>
          <span>
            {checkedCount} / {items.length} 项
          </span>
        </div>
        <Progress
          percent={percent}
          size="small"
          status={percent === 100 && items.length > 0 ? "success" : "active"}
        />
      </div>

      {/* 添加区 */}
      {!readOnly && (
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 16,
          }}
        >
          <Input
            placeholder="添加物品，如：转换插头"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onPressEnter={handleAdd}
            maxLength={60}
            style={{ flex: 2, minWidth: 160 }}
          />
          <Select
            value={newCategory}
            onChange={setNewCategory}
            style={{ flex: 1, minWidth: 110 }}
          >
            {CATEGORY_ORDER.map((c) => (
              <Select.Option key={c} value={c}>
                {CHECKLIST_CATEGORY_ICONS[c]} {CHECKLIST_CATEGORY_LABELS[c]}
              </Select.Option>
            ))}
          </Select>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAdd}
            loading={adding}
            disabled={!newName.trim()}
          >
            添加
          </Button>
          <Button icon={<ThunderboltOutlined />} onClick={handleTemplate}>
            一键添加常用
          </Button>
        </div>
      )}

      {/* 清单内容 */}
      {items.length === 0 ? (
        <Empty
          description={
            readOnly ? "还没有准备清单" : "清单为空，点「一键添加常用」快速开始"
          }
          style={{ padding: 40 }}
        />
      ) : (
        CATEGORY_ORDER.filter((c) => items.some((i) => i.category === c)).map(
          (category) => {
            const group = items.filter((i) => i.category === category);
            return (
              <div key={category} style={{ marginBottom: 16 }}>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 14,
                    marginBottom: 8,
                    color: "#374151",
                  }}
                >
                  {CHECKLIST_CATEGORY_ICONS[category]}{" "}
                  {CHECKLIST_CATEGORY_LABELS[category]}
                  <span
                    style={{
                      fontSize: 12,
                      color: "#9ca3af",
                      fontWeight: 400,
                      marginLeft: 8,
                    }}
                  >
                    {group.filter((i) => i.checked).length}/{group.length}
                  </span>
                </div>
                <div
                  style={{
                    background: "#fff",
                    border: "1px solid #f0f0f0",
                    borderRadius: 8,
                    overflow: "hidden",
                  }}
                >
                  {group.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 12px",
                        borderBottom: "1px solid #f7f7f7",
                      }}
                    >
                      <Checkbox
                        checked={item.checked}
                        disabled={readOnly}
                        onChange={() => handleToggle(item)}
                      >
                        <span
                          style={{
                            textDecoration: item.checked ? "line-through" : "none",
                            opacity: item.checked ? 0.55 : 1,
                          }}
                        >
                          {item.name}
                        </span>
                      </Checkbox>
                      {!readOnly && (
                        <Popconfirm
                          title="从清单移除？"
                          onConfirm={() => handleDelete(item)}
                        >
                          <Button
                            size="small"
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            style={{ marginLeft: "auto" }}
                          />
                        </Popconfirm>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          }
        )
      )}
    </div>
  );
}
