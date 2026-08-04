import { useEffect, useState } from "react";
import {
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Empty,
  Tag,
  Avatar,
  Tooltip,
  Popconfirm,
  App as AntApp,
  Divider,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { expenseApi } from "../api";
import type { Trip, Expense, ExpenseStats } from "../types";
import {
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_CATEGORY_ICONS,
  EXPENSE_CATEGORY_COLORS,
} from "../types";

interface Props {
  trip: Trip;
  onUpdate: () => void;
}

function parseParticipants(json?: string): string[] {
  if (!json) return [];
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

export default function ExpensesTab({ trip, onUpdate }: Props) {
  const { message } = AntApp.useApp();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [stats, setStats] = useState<ExpenseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [form] = Form.useForm();

  const members = trip.members || [];

  const load = async () => {
    setLoading(true);
    try {
      const [list, s] = await Promise.all([
        expenseApi.list(trip.id),
        expenseApi.stats(trip.id),
      ]);
      setExpenses(list);
      setStats(s);
    } catch (e) {
      message.error("加载花费失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.id]);

  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      category: "food",
      expenseDate: dayjs(),
      participantIds: members.map((m) => m.userId),
      payerId: members[0]?.userId,
    });
    setModalOpen(true);
  };

  const openEdit = (e: Expense) => {
    setEditing(e);
    form.setFieldsValue({
      ...e,
      expenseDate: e.expenseDate ? dayjs(e.expenseDate) : undefined,
      participantIds: parseParticipants(e.participantIds),
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const data = {
        title: values.title,
        category: values.category,
        amount: values.amount,
        payerId: values.payerId,
        participantIds: values.participantIds,
        expenseDate: values.expenseDate
          ? values.expenseDate.format("YYYY-MM-DD")
          : undefined,
        notes: values.notes,
      };

      if (editing) {
        await expenseApi.update(trip.id, editing.id, data);
        message.success("已更新");
      } else {
        await expenseApi.create(trip.id, data);
        message.success("已添加");
      }
      setModalOpen(false);
      await load();
      onUpdate();
    } catch (e: any) {
      if (e?.errorFields) return; // 验证错误
      const msg = e?.response?.data?.error || "操作失败";
      message.error(msg);
    }
  };

  const handleDelete = async (e: Expense) => {
    try {
      await expenseApi.delete(trip.id, e.id);
      message.success("已删除");
      await load();
      onUpdate();
    } catch (err: any) {
      message.error(err?.response?.data?.error || "删除失败");
    }
  };

  const getMemberName = (userId: string) => {
    const m = members.find((mm) => mm.userId === userId);
    return m?.user?.nickname || "未知";
  };

  const getMemberInitial = (userId: string) => {
    return getMemberName(userId)[0] || "?";
  };

  return (
    <div>
      {/* 统计概览 */}
      <div className="expense-summary">
        <div
          className="expense-stat-card clickable"
          onClick={() => setDetailOpen(true)}
        >
          <div className="stat-label">总花费</div>
          <div className="stat-value">¥{(stats?.total || 0).toFixed(2)}</div>
        </div>
        <div
          className="expense-stat-card clickable"
          onClick={() => setDetailOpen(true)}
        >
          <div className="stat-label">人均</div>
          <div className="stat-value">¥{(stats?.perCapita || 0).toFixed(2)}</div>
        </div>
        <div className="expense-stat-card">
          <div className="stat-label">参与成员</div>
          <div className="stat-value" style={{ color: "#1677ff" }}>
            {stats?.memberCount || members.length || 0} 人
          </div>
        </div>
        <div className="expense-stat-card">
          <div className="stat-label">记录数</div>
          <div className="stat-value" style={{ color: "#1677ff" }}>
            {expenses.length} 笔
          </div>
        </div>
      </div>

      <div className="flex-between mb-12" style={{ flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ margin: 0 }}>💰 花费记录</h3>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={openAdd}
          disabled={members.length === 0}
        >
          添加花费
        </Button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40 }}>加载中...</div>
      ) : expenses.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">💸</div>
          <p>还没有任何花费记录</p>
          <p style={{ fontSize: 12, color: "#d1d5db" }}>
            点击右上角"添加花费"开始记账
          </p>
        </div>
      ) : (
        <div className="expense-list">
          {expenses.map((e) => {
            const participants = parseParticipants(e.participantIds);
            return (
              <div key={e.id} className="expense-card">
                <div
                  className="expense-icon"
                  style={{
                    background:
                      EXPENSE_CATEGORY_COLORS[e.category] === "orange"
                        ? "#fff7e6"
                        : EXPENSE_CATEGORY_COLORS[e.category] === "blue"
                        ? "#e6f4ff"
                        : EXPENSE_CATEGORY_COLORS[e.category] === "purple"
                        ? "#f9f0ff"
                        : EXPENSE_CATEGORY_COLORS[e.category] === "cyan"
                        ? "#e6fffb"
                        : EXPENSE_CATEGORY_COLORS[e.category] === "magenta"
                        ? "#fff0f6"
                        : "#f3f4f6",
                  }}
                >
                  {EXPENSE_CATEGORY_ICONS[e.category] || "💼"}
                </div>
                <div className="expense-content">
                  <div className="expense-title">
                    {e.title}
                    <Tag
                      color={EXPENSE_CATEGORY_COLORS[e.category]}
                      style={{ marginLeft: 8, fontSize: 11 }}
                    >
                      {EXPENSE_CATEGORY_LABELS[e.category]}
                    </Tag>
                  </div>
                  <div className="expense-meta">
                    {e.expenseDate && (
                      <span>📅 {dayjs(e.expenseDate).format("MM-DD")} · </span>
                    )}
                    <span>
                      {getMemberName(e.payerId)} 付 · {participants.length}{" "}
                      人分摊
                    </span>
                  </div>
                  {participants.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        gap: 4,
                        marginTop: 4,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          color: "#9ca3af",
                        }}
                      >
                        分摊给:
                      </span>
                      <Avatar.Group size="small" maxCount={5}>
                        {participants.map((pid) => (
                          <Tooltip
                            key={pid}
                            title={getMemberName(pid)}
                          >
                            <Avatar
                              size="small"
                              style={{ backgroundColor: "#87d068" }}
                            >
                              {getMemberInitial(pid)}
                            </Avatar>
                          </Tooltip>
                        ))}
                      </Avatar.Group>
                    </div>
                  )}
                  {e.notes && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "#9ca3af",
                        marginTop: 2,
                      }}
                    >
                      {e.notes}
                    </div>
                  )}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexShrink: 0,
                  }}
                >
                  <div className="expense-amount">¥{e.amount.toFixed(2)}</div>
                  <Button
                    size="small"
                    type="text"
                    icon={<EditOutlined />}
                    onClick={() => openEdit(e)}
                  />
                  <Popconfirm
                    title="确认删除？"
                    onConfirm={() => handleDelete(e)}
                  >
                    <Button
                      size="small"
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                    />
                  </Popconfirm>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 添加/编辑 Modal */}
      <Modal
        title={editing ? "编辑花费" : "添加花费"}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        okText="保存"
        cancelText="取消"
        width={520}
      >
        <Form form={form} layout="vertical" requiredMark>
          <Form.Item
            name="title"
            label="花费说明"
            rules={[{ required: true, message: "请输入说明" }]}
          >
            <Input placeholder="例如：晚餐、景点门票、打车" />
          </Form.Item>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Form.Item
              name="amount"
              label="金额 (¥)"
              rules={[{ required: true, message: "请输入金额" }]}
              style={{ flex: 1, minWidth: 140 }}
            >
              <InputNumber
                style={{ width: "100%" }}
                min={0}
                step={0.01}
                precision={2}
                placeholder="0.00"
              />
            </Form.Item>
            <Form.Item
              name="category"
              label="分类"
              rules={[{ required: true }]}
              style={{ flex: 1, minWidth: 140 }}
            >
              <Select>
                {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, v]) => (
                  <Select.Option key={k} value={k}>
                    {EXPENSE_CATEGORY_ICONS[k]} {v}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </div>

          <Form.Item
            name="expenseDate"
            label="日期"
            rules={[{ required: true, message: "请选择日期" }]}
          >
            <DatePicker
              style={{ width: "100%" }}
              format="YYYY-MM-DD"
            />
          </Form.Item>

          <Form.Item
            name="payerId"
            label="付款人"
            rules={[{ required: true, message: "请选择付款人" }]}
          >
            <Select placeholder="选择谁付的钱">
              {members.map((m) => (
                <Select.Option key={m.userId} value={m.userId}>
                  {m.user?.nickname || "未知"}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="participantIds"
            label={
              <span>
                参与分摊的成员{" "}
                <Button
                  type="link"
                  size="small"
                  style={{ padding: 0 }}
                  onClick={() =>
                    form.setFieldValue(
                      "participantIds",
                      members.map((m) => m.userId)
                    )
                  }
                >
                  全选
                </Button>
              </span>
            }
            rules={[{ required: true, message: "至少选一人" }]}
          >
            <Select
              mode="multiple"
              placeholder="选择参与分摊的人"
              optionLabelProp="label"
            >
              {members.map((m) => (
                <Select.Option
                  key={m.userId}
                  value={m.userId}
                  label={m.user?.nickname}
                >
                  <Avatar
                    size="small"
                    style={{
                      backgroundColor: "#87d068",
                      marginRight: 6,
                    }}
                  >
                    {m.user?.nickname?.[0] || "?"}
                  </Avatar>
                  {m.user?.nickname}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={2} placeholder="（选填）" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 按人明细 Modal */}
      <Modal
        title="💰 花费明细（按人）"
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={null}
        width={520}
      >
        <div className="expense-summary" style={{ marginBottom: 16 }}>
          <div className="expense-stat-card">
            <div className="stat-label">总花费</div>
            <div className="stat-value">
              ¥{(stats?.total || 0).toFixed(2)}
            </div>
          </div>
          <div className="expense-stat-card">
            <div className="stat-label">人均</div>
            <div className="stat-value">
              ¥{(stats?.perCapita || 0).toFixed(2)}
            </div>
          </div>
        </div>

        <Divider style={{ margin: "12px 0" }} />

        {stats?.items.length === 0 ? (
          <Empty description="还没有数据" />
        ) : (
          <div>
            {stats?.items.map((s) => (
              <div key={s.userId} className="expense-member-row">
                <div className="expense-member-info">
                  <Avatar
                    style={{ backgroundColor: "#1677ff" }}
                  >
                    {s.nickname?.[0] || "?"}
                  </Avatar>
                  <div>
                    <div className="expense-member-name">{s.nickname}</div>
                    <div className="expense-member-numbers">
                      <span className="expense-member-paid">
                        付款 ¥{s.paid.toFixed(2)}
                      </span>
                      <span className="expense-member-owed">
                        应摊 ¥{s.owed.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
                <div
                  className={`expense-member-net ${
                    s.net > 0.01
                      ? "positive"
                      : s.net < -0.01
                      ? "negative"
                      : "zero"
                  }`}
                >
                  {s.net > 0.01
                    ? `+¥${s.net.toFixed(2)}`
                    : s.net < -0.01
                    ? `-¥${Math.abs(s.net).toFixed(2)}`
                    : `¥0.00`}
                </div>
              </div>
            ))}
            <div
              style={{
                fontSize: 12,
                color: "#9ca3af",
                padding: "8px 16px 0",
                lineHeight: 1.6,
              }}
            >
              💡 净额为正（绿）表示别人欠你；为负（红）表示你欠别人
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
