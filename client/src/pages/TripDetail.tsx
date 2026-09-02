import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Spin,
  Tabs,
  Button,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  TimePicker,
  InputNumber,
  Tag,
  Popconfirm,
  Divider,
  Typography,
  Card,
  Avatar,
  Tooltip,
  App as AntApp,
  Space,
  Upload,
} from "antd";
import {
  ArrowLeftOutlined,
  CopyOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  CheckCircleOutlined,
  EnvironmentOutlined,
  ClockCircleOutlined,
  ShareAltOutlined,
  HolderOutlined,
  TeamOutlined,
  UploadOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { tripApi, scheduleApi, transportApi, accommodationApi, transportLookupApi, uploadApi, weatherApi, transportMatchApi } from "../api";
import type {
  Trip,
  ScheduleItem,
  Transportation,
  Accommodation,
  ScheduleItemType,
} from "../types";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  TRANSPORT_LABELS,
  TRANSPORT_ICONS,
  ITEM_TYPE_LABELS,
  ITEM_TYPE_ICONS,
  TRIP_STATUS_LABELS,
} from "../types";
import ProgressBoard from "../components/ProgressBoard";
import ExpensesTab from "../components/ExpensesTab";
import ChecklistTab from "../components/ChecklistTab";
import MapView, { DAY_COLORS, toIntercitySegments } from "../components/MapView";
import type { MapLocation } from "../components/MapView";
import LocationPicker from "../components/LocationPicker";
import MapPicker from "../components/MapPicker";
import MembersModal from "../components/MembersModal";
import ExportTripImage from "../components/ExportTripImage";
import { geocodePlace } from "../utils/tencentMap";
import { useUserStore } from "../stores/userStore";
import type { WeatherDay } from "../types";
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
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const { TextArea } = Input;
const { RangePicker } = DatePicker;

const LEG_MODE_OPTIONS: { value: string; label: string }[] = [
  { value: "walking", label: "🚶 步行" },
  { value: "driving", label: "🚗 驾车" },
  { value: "transit", label: "🚌 公交/地铁" },
  { value: "intercity", label: "🚄 城际" },
  { value: "none", label: "➖ 不接驳" },
];
const LEG_MODE_ICON: Record<string, string> = {
  walking: "🚶",
  driving: "🚗",
  transit: "🚌",
  intercity: "🚄",
  none: "➖",
};

export default function TripDetail() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [membersModalOpen, setMembersModalOpen] = useState(false);
  const [editForm] = Form.useForm();
  const currentUser = useUserStore((s) => s.user);
  const myMembership = trip?.members?.find((m) => m.userId === currentUser?.id);
  const isOwner = myMembership?.role === "owner";
  const canEdit = isOwner || myMembership?.role === "editor";

  const loadTrip = useCallback(async () => {
    if (!tripId) return;
    try {
      const data = await tripApi.get(tripId);
      setTrip(data);
    } catch (e) {
      message.error("加载失败");
    } finally {
      setLoading(false);
    }
  }, [tripId, message]);

  useEffect(() => {
    loadTrip();
  }, [loadTrip]);

  // 目的地逐日天气（展示在每日日程卡头）；任何失败静默降级
  const [weatherByDate, setWeatherByDate] = useState<Record<string, WeatherDay>>(
    {}
  );
  // 天气依赖坐标指纹而非 tripId：住宿 / 日程项补充了坐标后应重新拉取天气，
  // 否则会一直沿用 destination 地理编码结果而永不刷新
  const weatherCoordKey = (() => {
    if (!trip) return "";
    const acc = trip.accommodations?.find((a) => a.lat && a.lng);
    if (acc) return `acc:${acc.id}:${acc.lat}:${acc.lng}`;
    const item = trip.schedules
      ?.flatMap((s) => s.items || [])
      .find((i) => i.lat && i.lng);
    if (item) return `item:${item.id}:${item.lat}:${item.lng}`;
    if (trip.destination) return `dest:${trip.destination}`;
    return "";
  })();
  const weatherDateKey = `${trip?.startDate ?? ""}|${trip?.endDate ?? ""}`;
  useEffect(() => {
    if (!trip) return;
    let cancelled = false;
    (async () => {
      let lat: number | undefined;
      let lng: number | undefined;
      const acc = trip.accommodations?.find((a) => a.lat && a.lng);
      if (acc) {
        lat = acc.lat!;
        lng = acc.lng!;
      }
      if (lat == null) {
        const item = trip.schedules
          ?.flatMap((s) => s.items || [])
          .find((i) => i.lat && i.lng);
        if (item) {
          lat = item.lat!;
          lng = item.lng!;
        }
      }
      if (lat == null && trip.destination) {
        const g = await geocodePlace(trip.destination);
        if (g) {
          lat = g.lat;
          lng = g.lng;
        }
      }
      if (lat == null || lng == null) return;
      try {
        const days = await weatherApi.daily({
          lat,
          lng,
          start: trip.startDate,
          end: trip.endDate,
        });
        if (cancelled) return;
        const map: Record<string, WeatherDay> = {};
        days.forEach((d) => {
          map[d.date] = d;
        });
        setWeatherByDate(map);
      } catch {
        // 静默降级：不阻塞主流程
      }
    })();
    return () => {
      cancelled = true;
    };
    // 依赖坐标指纹 + 日期区间；补坐标或改行程区间时重新拉取天气
  }, [weatherCoordKey, weatherDateKey]);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="empty-state">
        <div className="empty-icon">😕</div>
        <p>旅行计划不存在或已被删除</p>
        <Button type="primary" onClick={() => navigate("/")}>
          返回首页
        </Button>
      </div>
    );
  }

  const copyInviteCode = () => {
    navigator.clipboard.writeText(trip.inviteCode);
    message.success("邀请码已复制！分享给旅伴吧");
  };

  const copyShareLink = () => {
    // 分享页挂在子路径前缀下（如 /trip/share/xxx），须拼 BASE_URL
    const link = `${window.location.origin}${import.meta.env.BASE_URL}share/${trip.inviteCode}`;
    navigator.clipboard.writeText(link);
    message.success("分享链接已复制！发给朋友即可查看行程");
  };

  const openEditModal = () => {
    editForm.setFieldsValue({
      title: trip.title,
      destination: trip.destination,
      dateRange: [dayjs(trip.startDate), dayjs(trip.endDate)],
      description: trip.description,
      status: trip.status,
      budgetTotal: trip.budgetTotal,
    });
    setEditModalOpen(true);
  };

  const handleEditSave = async () => {
    try {
      const values = await editForm.validateFields();
      const [start, end] = values.dateRange;
      await tripApi.update(trip.id, {
        title: values.title,
        destination: values.destination,
        startDate: start.format("YYYY-MM-DD"),
        endDate: end.format("YYYY-MM-DD"),
        description: values.description,
        status: values.status,
        budgetTotal: values.budgetTotal,
      });
      message.success("计划已更新");
      setEditModalOpen(false);
      loadTrip();
    } catch (e) {
      // validation error
    }
  };

  const handleDelete = async () => {
    try {
      await tripApi.delete(trip.id);
      message.success("计划已删除");
      navigate("/");
    } catch (e) {
      message.error("删除失败");
    }
  };

  return (
    <div>
      {/* 顶部信息栏 */}
      <div style={{ marginBottom: 16 }}>
        <div className="flex-between" style={{ flexWrap: "wrap", gap: 8 }}>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/")}
            style={{ paddingLeft: 0 }}
          >
            返回
          </Button>
          <Space>
            <Button
              size="small"
              icon={<ShareAltOutlined />}
              onClick={copyShareLink}
            >
              分享链接
            </Button>
            <ExportTripImage trip={trip} weather={weatherByDate} />
            {isOwner && (
              <>
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  onClick={openEditModal}
                >
                  编辑
                </Button>
                <Popconfirm
                  title="确认删除这个旅行计划？"
                  description="所有日程、交通、住宿、花费数据将一并删除，此操作不可撤销。"
                  onConfirm={handleDelete}
                  okText="确认删除"
                  cancelText="取消"
                  okButtonProps={{ danger: true }}
                >
                  <Button size="small" danger icon={<DeleteOutlined />}>
                    删除
                  </Button>
                </Popconfirm>
              </>
            )}
          </Space>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: 12,
            marginTop: 8,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 22, wordBreak: "break-word" }}>
              {trip.title}{" "}
              <Tag
                color={
                  trip.status === "planning"
                    ? "blue"
                    : trip.status === "ongoing"
                      ? "green"
                      : "default"
                }
                style={{ verticalAlign: "middle" }}
              >
                {TRIP_STATUS_LABELS[trip.status]}
              </Tag>
            </h1>
            <div
              style={{
                color: "#6b7280",
                marginTop: 6,
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                fontSize: 13,
              }}
            >
              <span>
                <ClockCircleOutlined />{" "}
                {dayjs(trip.startDate).format("YYYY-MM-DD")} ~{" "}
                {dayjs(trip.endDate).format("YYYY-MM-DD")}
              </span>
              {trip.destination && (
                <span>
                  <EnvironmentOutlined /> {trip.destination}
                </span>
              )}
              {trip.budgetTotal != null && trip.budgetTotal > 0 && (
                <span>💰 预算 ¥{trip.budgetTotal}</span>
              )}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 4 }}>
              邀请码
            </div>
            <div
              className="invite-code-box"
              onClick={copyInviteCode}
              style={{ cursor: "pointer" }}
            >
              <span className="invite-code-text">{trip.inviteCode}</span>
              <Tooltip title="点击复制">
                <CopyOutlined style={{ color: "#1677ff" }} />
              </Tooltip>
            </div>
          </div>
        </div>

        {/* 成员展示 */}
        {trip.members && trip.members.length > 0 && (
          <div
            style={{
              marginTop: 12,
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <Avatar.Group max={{ count: 8 }} size="default">
              {trip.members.map((m) => (
                <Tooltip
                  key={m.id}
                  title={`${m.user?.nickname || "未知"} (${m.role === "owner"
                      ? "创建者"
                      : m.role === "editor"
                        ? "编辑者"
                        : "查看者"
                    })`}
                >
                  <Avatar
                    style={{
                      backgroundColor:
                        m.role === "owner" ? "#1677ff" : "#87d068",
                    }}
                  >
                    {m.user?.nickname?.[0] || "?"}
                  </Avatar>
                </Tooltip>
              ))}
            </Avatar.Group>
            {isOwner && (
              <Button
                size="small"
                icon={<TeamOutlined />}
                onClick={() => setMembersModalOpen(true)}
              >
                管理成员
              </Button>
            )}
          </div>
        )}
      </div>

      {/* 查看者只读提示 */}
      {!canEdit && (
        <div
          style={{
            marginBottom: 12,
            padding: "8px 12px",
            background: "#fffbe6",
            border: "1px solid #ffe58f",
            borderRadius: 8,
            fontSize: 13,
            color: "#874d00",
          }}
        >
          你当前是查看者，仅可浏览行程内容，无法编辑；如需修改请联系创建者调整角色。
        </div>
      )}

      {/* 进度看板 */}
      <ProgressBoard trip={trip} />

      {/* Tab 内容区 */}
      <Tabs
        defaultActiveKey="summary"
        items={[
          {
            key: "summary",
            label: "📋 行程总览",
            children: <SummaryTab trip={trip} />,
          },
          {
            key: "schedule",
            label: "📅 每日日程",
            children: (
              <ScheduleTab
                trip={trip}
                onUpdate={loadTrip}
                readOnly={!canEdit}
                weather={weatherByDate}
              />
            ),
          },
          {
            key: "transport",
            label: "🚗 交通",
            children: (
              <TransportTab trip={trip} onUpdate={loadTrip} readOnly={!canEdit} />
            ),
          },
          {
            key: "accommodation",
            label: "🏨 住宿",
            children: (
              <AccommodationTab
                trip={trip}
                onUpdate={loadTrip}
                readOnly={!canEdit}
              />
            ),
          },
          {
            key: "expense",
            label: "💰 花费",
            children: (
              <ExpensesTab trip={trip} onUpdate={loadTrip} readOnly={!canEdit} />
            ),
          },
          {
            key: "checklist",
            label: "🧳 行李清单",
            children: <ChecklistTab trip={trip} readOnly={!canEdit} />,
          },
          {
            key: "map",
            label: "🗺️ 地图",
            children: <MapTab trip={trip} />,
          }
        ]}
      />

      {/* 编辑计划 Modal */}
      <Modal
        title="编辑旅行计划"
        open={editModalOpen}
        onOk={handleEditSave}
        onCancel={() => setEditModalOpen(false)}
        width={520}
        okText="保存"
        cancelText="取消"
      >
        <Form form={editForm} layout="vertical">
          <Form.Item
            name="title"
            label="计划名称"
            rules={[{ required: true, message: "请输入计划名称" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="destination" label="目的地">
            <Input placeholder="例如：大阪、京都、奈良" />
          </Form.Item>
          <Form.Item
            name="dateRange"
            label="旅行日期"
            rules={[{ required: true, message: "请选择日期" }]}
          >
            <RangePicker style={{ width: "100%" }} format="YYYY-MM-DD" />
          </Form.Item>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Form.Item
              name="status"
              label="状态"
              style={{ flex: 1, minWidth: 140 }}
            >
              <Select>
                <Select.Option value="planning">规划中</Select.Option>
                <Select.Option value="ongoing">进行中</Select.Option>
                <Select.Option value="completed">已完成</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item
              name="budgetTotal"
              label="总预算 (¥)"
              style={{ flex: 1, minWidth: 140 }}
            >
              <InputNumber style={{ width: "100%" }} min={0} placeholder="0" />
            </Form.Item>
          </div>
          <Form.Item name="description" label="计划描述">
            <TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 成员管理 Modal（1.5） */}
      <MembersModal
        trip={trip}
        open={membersModalOpen}
        onClose={() => setMembersModalOpen(false)}
        onUpdated={loadTrip}
      />
    </div>
  );
}

// ==================== 可排序的日程项 ====================

function SortableScheduleItem({
  item,
  onEdit,
  onDelete,
  onToggle,
  readOnly,
  tripId,
  onLegUpdated,
}: {
  item: ScheduleItem;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  readOnly: boolean;
  tripId: string;
  onLegUpdated: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id, disabled: readOnly });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const { message } = AntApp.useApp();
  const [legModalOpen, setLegModalOpen] = useState(false);
  const [legForm] = Form.useForm();

  const openLegEdit = () => {
    legForm.setFieldsValue({
      legMode: item.legMode || "driving",
      legSummary: item.legSummary || "",
      legDistanceM: item.legDistanceM ?? undefined,
      legDurationMin: item.legDurationMin ?? undefined,
    });
    setLegModalOpen(true);
  };

  const handleLegSave = async () => {
    const values = await legForm.validateFields();
    try {
      await transportMatchApi.updateLeg(tripId, item.id, {
        legMode: values.legMode,
        legSummary: values.legSummary || undefined,
        legDistanceM: values.legDistanceM ?? undefined,
        legDurationMin: values.legDurationMin ?? undefined,
      });
      message.success("接驳方式已更新");
      setLegModalOpen(false);
      onLegUpdated();
    } catch (e: any) {
      // 400 等已在后端拦截，仅提示其它业务错误
      if (e?.response?.status !== 400) {
        message.error(e?.response?.data?.error || "保存失败");
      }
    }
  };

  // 删除接驳：匹配错了可清除重来
  const handleLegDelete = async () => {
    try {
      await transportMatchApi.clearLeg(tripId, item.id);
      message.success("已删除该接驳");
      onLegUpdated();
    } catch (e: any) {
      if (e?.response?.status !== 400) {
        message.error(e?.response?.data?.error || "删除失败");
      }
    }
  };

  return (
    <>
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
      <span className="schedule-item-icon">
        {ITEM_TYPE_ICONS[item.type]}
      </span>
      <div className="schedule-item-content">
        <div className="schedule-item-title">
          <span
            style={{
              textDecoration:
                item.status === "done" || item.status === "completed"
                  ? "line-through"
                  : "none",
              opacity:
                item.status === "done" || item.status === "completed"
                  ? 0.6
                  : 1,
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
          {item.transportToNext && (
            <span>🚗 到下一站: {item.transportToNext}</span>
          )}
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
            onClick={(e) => {
              if (readOnly) return;
              const el = e.target as HTMLElement | null;
              if (!el) return;
              // Popconfirm 弹层走 Portal 挂到 body，DOM 上不是卡片子节点，
              // 但 React 合成事件仍沿组件树冒泡上来 → 用 contains 过滤掉
              if (!e.currentTarget.contains(el)) return;
              // 删除按钮所在区域不触发编辑
              if (el.closest("[data-leg-noclick]")) return;
              openLegEdit();
            }}
            style={{
              marginTop: 6,
              padding: "6px 8px",
              background: "#f5f7ff",
              border: "1px solid #e6ebff",
              borderRadius: 8,
              fontSize: 12,
              color: "#475569",
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
            {!readOnly && (
              <Popconfirm title="删除该接驳？" onConfirm={handleLegDelete}>
                <span data-leg-noclick style={{ display: "inline-flex" }}>
                  <Button
                    size="small"
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    style={{ marginLeft: 4 }}
                  />
                </span>
              </Popconfirm>
            )}
          </div>
        )}
      </div>
      {!readOnly && (
        <div className="schedule-item-actions">
          <Tooltip title={item.status === "done" ? "取消完成" : "标记完成"}>
            <Button
              size="small"
              type="text"
              icon={<CheckCircleOutlined />}
              onClick={onToggle}
              style={{ color: item.status === "done" ? "#52c41a" : "#ccc" }}
            />
          </Tooltip>
          <Button
            size="small"
            type="text"
            icon={<EditOutlined />}
            onClick={onEdit}
          />
          <Popconfirm title="确认删除？" onConfirm={onDelete}>
            <Button size="small" type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </div>
      )}
    </div>

    <Modal
      title="编辑接驳方式"
      open={legModalOpen}
      onOk={handleLegSave}
      onCancel={() => setLegModalOpen(false)}
      okText="保存"
      cancelText="取消"
    >
      <Form form={legForm} layout="vertical">
        <Form.Item name="legMode" label="接驳方式" rules={[{ required: true }]}>
          <Select>
            {LEG_MODE_OPTIONS.map((o) => (
              <Select.Option key={o.value} value={o.value}>
                {o.label}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item name="legSummary" label="展示文案">
          <Input placeholder="如：驾车约 12 分钟 · 3.2 km" />
        </Form.Item>
        <Form.Item name="legDistanceM" label="距离（米）">
          <InputNumber min={0} style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item name="legDurationMin" label="时长（分钟）">
          <InputNumber min={0} style={{ width: "100%" }} />
        </Form.Item>
      </Form>
    </Modal>
    </>
  );
}

// ==================== 每日日程 Tab ====================

function ScheduleTab({
  trip,
  onUpdate,
  readOnly,
  weather,
}: {
  trip: Trip;
  onUpdate: () => void;
  readOnly: boolean;
  weather?: Record<string, WeatherDay>;
}) {
  const { message } = AntApp.useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  const [currentScheduleId, setCurrentScheduleId] = useState<string>("");
  const [form] = Form.useForm();
  const [localItems, setLocalItems] = useState<Record<string, ScheduleItem[]>>({});
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [conflictLatest, setConflictLatest] = useState<ScheduleItem | null>(
    null
  );
  const [uploading, setUploading] = useState(false);
  const imageUrlValue = Form.useWatch("imageUrl", form);
  const [matching, setMatching] = useState(false);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    // 触摸长按 250ms 才进入拖拽，避免与页面滚动冲突（移动端专项）
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } })
  );

  // 同步 trip 数据到 local state
  useEffect(() => {
    const map: Record<string, ScheduleItem[]> = {};
    trip.schedules?.forEach((s) => {
      map[s.id] = s.items ? [...s.items] : [];
    });
    setLocalItems(map);
  }, [trip]);

  const onPickLocation = (loc: {
    lat: number;
    lng: number;
    name: string;
    address?: string;
  }) => {
    const cur = form.getFieldsValue();
    form.setFieldsValue({
      ...cur,
      locationName: cur.locationName || loc.name,
      address: cur.address || loc.address || "",
      lat: loc.lat,
      lng: loc.lng,
    });
  };

  const onPickMapPoint = (p: { lat: number; lng: number; address?: string }) => {
    const cur = form.getFieldsValue();
    form.setFieldsValue({
      ...cur,
      address: cur.address || p.address || "",
      lat: p.lat,
      lng: p.lng,
    });
    setMapPickerOpen(false);
  };

  // 图片上传：调用后端 /api/upload，成功后回填 imageUrl 字段
  const handleUploadImage = async (file: File) => {
    setUploading(true);
    try {
      const { url } = await uploadApi.image(file);
      form.setFieldsValue({ imageUrl: url });
      message.success("图片已上传");
    } catch (e: any) {
      message.error(e?.response?.data?.error || "上传失败，请稍后重试");
    } finally {
      setUploading(false);
    }
    // 返回 false 阻止 antd 默认上传行为（已由 uploadApi 手动处理）
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
    try {
      const values = await form.validateFields();
      const data = {
        ...values,
        startTime: values.startTime?.format("HH:mm:ss"),
        endTime: values.endTime?.format("HH:mm:ss"),
        version: editingItem?.version,
      };

      if (editingItem) {
        await scheduleApi.updateItem(
          trip.id,
          currentScheduleId,
          editingItem.id,
          data
        );
        message.success("已更新");
      } else {
        await scheduleApi.addItem(trip.id, currentScheduleId, data);
        message.success("已添加");
      }
      setModalOpen(false);
      onUpdate();
    } catch (e: any) {
      if (e?.response?.status === 409) {
        // 编辑冲突：保留编辑弹窗，展示冲突提示
        setConflictLatest(e.response.data.latest);
        return;
      }
      // 其他错误（如表单校验失败）忽略
    }
  };

  const handleDelete = async (item: ScheduleItem) => {
    await scheduleApi.deleteItem(trip.id, item.scheduleId, item.id);
    message.success("已删除");
    onUpdate();
  };

  const toggleStatus = async (item: ScheduleItem) => {
    const nextStatus =
      item.status === "done" || item.status === "completed"
        ? "pending"
        : "done";
    await scheduleApi.updateItem(trip.id, item.scheduleId, item.id, {
      status: nextStatus,
    });
    onUpdate();
  };

  const handleDragEnd = async (scheduleId: string, event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const items = localItems[scheduleId] || [];
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newItems = arrayMove(items, oldIndex, newIndex);
    setLocalItems({ ...localItems, [scheduleId]: newItems });

    // 调用后端 reorder
    try {
      await scheduleApi.reorderItems(
        trip.id,
        scheduleId,
        newItems.map((i) => i.id)
      );
    } catch (e) {
      message.error("排序失败，刷新重试");
      onUpdate();
    }
  };

  const handleMatchTransport = async () => {
    setMatching(true);
    try {
      const res = await transportMatchApi.match(trip.id);
      const parts = [`已匹配 ${res.legsApplied} 段接驳`];
      if (res.skippedNoCoord > 0)
        parts.push(`跳过 ${res.skippedNoCoord} 段（缺坐标）`);
      if (res.intercityDrafts?.length)
        parts.push(`生成 ${res.intercityDrafts.length} 条城际草稿待确认`);
      message.success(parts.join("，"));
      onUpdate();
    } catch (e: any) {
      message.error(e?.response?.data?.error || "匹配失败，请稍后重试");
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
        const items = localItems[schedule.id] || schedule.items || [];
        return (
          <div key={schedule.id} className="day-card">
            <div className="day-card-header">
              <div>
                <span className="day-card-title">
                  第{schedule.dayIndex}天
                  {schedule.title && schedule.title !== `第${schedule.dayIndex}天`
                    ? ` · ${schedule.title}`
                    : ""}
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
                    <SortableScheduleItem
                      key={item.id}
                      item={item}
                      onEdit={() => openEditModal(item)}
                      onDelete={() => handleDelete(item)}
                      onToggle={() => toggleStatus(item)}
                      readOnly={readOnly}
                      tripId={trip.id}
                      onLegUpdated={onUpdate}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            ) : (
              <div
                style={{
                  padding: 24,
                  textAlign: "center",
                  color: "#d1d5db",
                }}
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
      >
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
            <Form.Item
              name="startTime"
              label="开始时间"
              style={{ flex: 1, minWidth: 140 }}
            >
              <TimePicker format="HH:mm" style={{ width: "100%" }} minuteStep={15} />
            </Form.Item>
            <Form.Item
              name="endTime"
              label="结束时间"
              style={{ flex: 1, minWidth: 140 }}
            >
              <TimePicker format="HH:mm" style={{ width: "100%" }} minuteStep={15} />
            </Form.Item>
          </div>

          <Form.Item name="locationName" label="地点名称">
            <Input placeholder="例如：北京市东城区景山前街4号" />
          </Form.Item>

          <Form.Item label="地点定位">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <LocationPicker city={trip.destination} onPick={onPickLocation} />
              </div>
              <Button icon={<EnvironmentOutlined />} onClick={() => setMapPickerOpen(true)}>
                地图选点
              </Button>
            </div>
          </Form.Item>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Form.Item name="lat" label="纬度" style={{ flex: 1, minWidth: 140 }}>
              <InputNumber style={{ width: "100%" }} step={0.000001} placeholder="选填" />
            </Form.Item>
            <Form.Item name="lng" label="经度" style={{ flex: 1, minWidth: 140 }}>
              <InputNumber style={{ width: "100%" }} step={0.000001} placeholder="选填" />
            </Form.Item>
          </div>

          <Form.Item name="address" label="详细地址">
            <Input placeholder="详细地址（选填）" />
          </Form.Item>

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
                  handleUploadImage(file);
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
                    src={imageUrlValue}
                    alt="预览"
                    style={{
                      width: 56,
                      height: 56,
                      objectFit: "cover",
                      borderRadius: 6,
                      border: "1px solid #f0f0f0",
                    }}
                  />
                  <Button
                    size="small"
                    type="link"
                    danger
                    onClick={() => form.setFieldsValue({ imageUrl: undefined })}
                  >
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
            <Form.Item
              name="cost"
              label="预计花费 (¥)"
              style={{ flex: 1, minWidth: 140 }}
            >
              <InputNumber style={{ width: "100%" }} min={0} placeholder="0" />
            </Form.Item>
            <Form.Item
              name="status"
              label="状态"
              style={{ flex: 1, minWidth: 140 }}
            >
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
      </Modal>

      <MapPicker
        open={mapPickerOpen}
        initialLat={form.getFieldValue("lat")}
        initialLng={form.getFieldValue("lng")}
        onConfirm={onPickMapPoint}
        onCancel={() => setMapPickerOpen(false)}
      />

      {/* 8.2 编辑冲突提示 */}
      <Modal
        title="⚠️ 编辑冲突"
        open={!!conflictLatest}
        okText="用我的版本覆盖"
        cancelText="放弃修改"
        onCancel={() => {
          setConflictLatest(null);
          setModalOpen(false);
          onUpdate();
        }}
        onOk={async () => {
          if (!editingItem) return;
          try {
            const values = form.getFieldsValue();
            const data = {
              ...values,
              startTime: values.startTime?.format("HH:mm:ss"),
              endTime: values.endTime?.format("HH:mm:ss"),
              version: conflictLatest?.version,
              force: true,
            };
            await scheduleApi.updateItem(
              trip.id,
              currentScheduleId,
              editingItem.id,
              data
            );
            message.success("已覆盖保存");
            setConflictLatest(null);
            setModalOpen(false);
            onUpdate();
          } catch (err) {
            message.error("保存失败，请重试");
          }
        }}
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
    </div>
  );
}

// ==================== 交通 Tab ====================

function TransportTab({
  trip,
  onUpdate,
  readOnly,
}: {
  trip: Trip;
  onUpdate: () => void;
  readOnly: boolean;
}) {
  const { message } = AntApp.useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Transportation | null>(null);
  const [form] = Form.useForm();
  const [confirmingItem, setConfirmingItem] = useState<Transportation | null>(
    null
  );
  const [confirmForm] = Form.useForm();

  // 班次查询（航班/火车）状态
  const [lookup, setLookup] = useState<{
    type: "flight" | "train";
    data: any;
    source: string;
  } | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const resetLookup = () => {
    setLookup(null);
    setLookupError(null);
    setLookupLoading(false);
  };

  const openAdd = (type: "departure" | "return" | "intercity") => {
    setEditingItem(null);
    form.resetFields();
    form.setFieldsValue({
      type,
      transportType: "flight",
      status: "pending",
    });
    resetLookup();
    setModalOpen(true);
  };

  const openEdit = (item: Transportation) => {
    setEditingItem(item);
    form.setFieldsValue({
      ...item,
      departureTime: item.departureTime ? dayjs(item.departureTime) : undefined,
      arrivalTime: item.arrivalTime ? dayjs(item.arrivalTime) : undefined,
    });
    resetLookup();
    setModalOpen(true);
  };

  // 监听「交通方式 + 预订信息」，命中正则即防抖查询班次
  const lookupType = Form.useWatch("transportType", form);
  const lookupCode = Form.useWatch("bookingInfo", form);
  useEffect(() => {
    const code = (lookupCode || "").trim();
    const type = lookupType;
    if ((type === "flight" || type === "train") && code) {
      const re =
        type === "flight"
          ? /^[A-Za-z]{2}\d{1,4}$/
          : /^[GCDZKTL]\d{1,4}$/i;
      if (!re.test(code)) {
        resetLookup();
        return;
      }
      setLookupLoading(true);
      setLookupError(null);
      const timer = setTimeout(async () => {
        try {
          const res = await transportLookupApi.get(type, code);
          setLookup({ type, data: res.data, source: res.source });
        } catch (e: any) {
          setLookup(null);
          setLookupError(
            e?.response?.data?.error || e?.message || "查询失败，请稍后重试"
          );
        } finally {
          setLookupLoading(false);
        }
      }, 500);
      return () => {
        clearTimeout(timer);
        setLookupLoading(false);
      };
    }
    resetLookup();
  }, [lookupType, lookupCode]);

  // 把查询结果回填到表单
  const backfillFromLookup = () => {
    if (!lookup) return;
    const d = lookup.data;
    const set: Record<string, unknown> = {};
    if (lookup.type === "flight") {
      if (d.departure?.airport) set.departurePlace = d.departure.airport;
      if (d.arrival?.airport) set.arrivalPlace = d.arrival.airport;
      if (d.departure?.scheduled) set.departureTime = dayjs(d.departure.scheduled);
      if (d.arrival?.scheduled) set.arrivalTime = dayjs(d.arrival.scheduled);
      form.setFieldsValue(set);
      message.success("已回填航班起降信息");
    } else {
      if (d.fromStation) set.departurePlace = d.fromStation;
      if (d.toStation) set.arrivalPlace = d.toStation;
      form.setFieldsValue(set);
      message.success("已回填车次起终站信息");
    }
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    // 6.10 兜底：仅手填地名未选 POI 时，提交前尝试地理编码（全国范围，起讫地常不在目的地城市）
    let { depLat, depLng, arrLat, arrLng } = values;
    let geoFilled = false;
    if (depLat == null && depLng == null && values.departurePlace) {
      const g = await geocodePlace(values.departurePlace);
      if (g) {
        depLat = g.lat;
        depLng = g.lng;
        geoFilled = true;
      }
    }
    if (arrLat == null && arrLng == null && values.arrivalPlace) {
      const g = await geocodePlace(values.arrivalPlace);
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
  };

  const handleDelete = async (id: string) => {
    await transportApi.delete(trip.id, id);
    message.success("已删除");
    onUpdate();
  };

  // 确认采纳系统生成的城际草稿：可一并修正方式/时间/费用等
  const openConfirm = (item: Transportation) => {
    setConfirmingItem(item);
    confirmForm.setFieldsValue({
      ...item,
      status: item.status || "confirmed",
      departureTime: item.departureTime ? dayjs(item.departureTime) : undefined,
      arrivalTime: item.arrivalTime ? dayjs(item.arrivalTime) : undefined,
    });
  };

  const handleConfirm = async () => {
    if (!confirmingItem) return;
    const values = await confirmForm.validateFields();
    try {
      await transportMatchApi.confirm(trip.id, confirmingItem.id, {
        status: values.status,
        transportType: values.transportType,
        bookingInfo: values.bookingInfo || undefined,
        notes: values.notes || undefined,
        cost: values.cost ?? undefined,
        departureTime: values.departureTime?.toISOString(),
        arrivalTime: values.arrivalTime?.toISOString(),
      });
      message.success("已确认采纳城际交通");
      setConfirmingItem(null);
      onUpdate();
    } catch (e: any) {
      // 400 等已在后端拦截，仅提示其它业务错误
      if (e?.response?.status !== 400) {
        message.error(e?.response?.data?.error || "确认失败");
      }
    }
  };

  const renderSection = (
    type: "departure" | "return" | "intercity",
    label: string,
    icon: string
  ) => {
    const items = trip.transportations?.filter((t) => t.type === type) || [];
    return (
      <div style={{ marginBottom: 20 }}>
        <div
          className="flex-between mb-12"
          style={{ flexWrap: "wrap", gap: 8 }}
        >
          <h3 style={{ margin: 0 }}>
            {icon} {label}
          </h3>
          {!readOnly && (
            <Button
              size="small"
              type="dashed"
              icon={<PlusOutlined />}
              onClick={() => openAdd(type)}
            >
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
                      ...(type === "intercity" && item.matched
                        ? [
                            <Tooltip key="confirm" title="确认采纳草稿">
                              <CheckCircleOutlined
                                onClick={() => openConfirm(item)}
                              />
                            </Tooltip>,
                          ]
                        : []),
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
                    {item.departureTime &&
                      dayjs(item.departureTime).format("MM-DD HH:mm")}
                    {item.arrivalTime &&
                      ` ~ ${dayjs(item.arrivalTime).format("HH:mm")}`}
                    {item.cost ? ` · ¥${item.cost}` : ""}
                  </div>
                  {item.notes && (
                    <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
                      {item.notes}
                    </div>
                  )}
                </div>
                {item.matched ? (
                  <Tag color="gold">待确认草稿</Tag>
                ) : (
                  <Tag color={STATUS_COLORS[item.status]}>
                    {STATUS_LABELS[item.status]}
                  </Tag>
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    );
  };

  return (
    <div>
      {renderSection("departure", "出发交通", "🚀")}
      <Divider />
      {renderSection("intercity", "城际交通", "🚃")}
      <Divider />
      {renderSection("return", "返程交通", "🏠")}

      <Modal
        title={editingItem ? "编辑交通" : "添加交通"}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        width={520}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="type" hidden>
            <Input />
          </Form.Item>
          <Form.Item
            name="transportType"
            label="交通方式"
            rules={[{ required: true }]}
          >
            <Select>
              {Object.entries(TRANSPORT_LABELS).map(([k, v]) => (
                <Select.Option key={k} value={k}>
                  {TRANSPORT_ICONS[k]} {v}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Form.Item
              name="departurePlace"
              label="出发地"
              style={{ flex: 1, minWidth: 160 }}
              extra={
                <LocationPicker
                  placeholder="搜索出发地，自动带出坐标"
                  onPick={(loc) =>
                    form.setFieldsValue({
                      departurePlace: loc.name,
                      depLat: loc.lat,
                      depLng: loc.lng,
                    })
                  }
                />
              }
            >
              <Input
                placeholder="例如：北京首都机场"
                onChange={() =>
                  form.setFieldsValue({ depLat: undefined, depLng: undefined })
                }
              />
            </Form.Item>
            <Form.Item
              name="arrivalPlace"
              label="到达地"
              style={{ flex: 1, minWidth: 160 }}
              extra={
                <LocationPicker
                  placeholder="搜索到达地，自动带出坐标"
                  onPick={(loc) =>
                    form.setFieldsValue({
                      arrivalPlace: loc.name,
                      arrLat: loc.lat,
                      arrLng: loc.lng,
                    })
                  }
                />
              }
            >
              <Input
                placeholder="例如：大阪关西机场"
                onChange={() =>
                  form.setFieldsValue({ arrLat: undefined, arrLng: undefined })
                }
              />
            </Form.Item>
          </div>
          <Form.Item name="depLat" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="depLng" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="arrLat" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="arrLng" hidden>
            <Input />
          </Form.Item>
          <div style={{ fontSize: 12, color: "#9ca3af", marginTop: -12, marginBottom: 12 }}>
            搜索选中地点后即可在地图画出跨城连线；仅手填地名时，保存会自动尝试地理编码。
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Form.Item
              name="departureTime"
              label="出发时间"
              style={{ flex: 1, minWidth: 140 }}
            >
              <DatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item
              name="arrivalTime"
              label="到达时间"
              style={{ flex: 1, minWidth: 140 }}
            >
              <DatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: "100%" }} />
            </Form.Item>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Form.Item name="cost" label="花费 (¥)" style={{ flex: 1, minWidth: 140 }}>
              <InputNumber style={{ width: "100%" }} min={0} />
            </Form.Item>
            <Form.Item name="status" label="状态" style={{ flex: 1, minWidth: 140 }}>
              <Select>
                <Select.Option value="pending">待规划</Select.Option>
                <Select.Option value="booked">已预订</Select.Option>
                <Select.Option value="confirmed">已确认</Select.Option>
                <Select.Option value="completed">已完成</Select.Option>
              </Select>
            </Form.Item>
          </div>
          <Form.Item name="bookingInfo" label="预订信息">
            <Input placeholder="航班号/车次号/订单号" />
          </Form.Item>

          {/* 班次实时查询预览：选飞机输航班号 / 选火车输车次，自动查询并支持回填 */}
          {lookupLoading && (
            <div style={{ color: "#999", fontSize: 13, marginBottom: 8 }}>
              <Spin size="small" /> 查询中…
            </div>
          )}
          {lookupError && (
            <div style={{ color: "#e53e3e", fontSize: 12, marginBottom: 8 }}>
              {lookupError}
            </div>
          )}
          {lookup && (
            <div
              style={{
                background: "#f7f8fa",
                borderRadius: 8,
                padding: 12,
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <span style={{ fontWeight: 600 }}>
                  {lookup.type === "flight" ? "✈️ 航班信息" : "🚄 车次信息"}{" "}
                  {lookup.data.flightNumber || lookup.data.trainNumber}
                </span>
                {lookup.source === "mock" && (
                  <Tag color="orange">演示数据</Tag>
                )}
                {lookup.source === "12306" && <Tag color="green">12306</Tag>}
              </div>
              {lookup.type === "flight" ? (
                <div style={{ fontSize: 13, lineHeight: 1.9 }}>
                  {lookup.data.airline && (
                    <div>航司：{lookup.data.airline}</div>
                  )}
                  <div>
                    出发：{lookup.data.departure?.airport}（
                    {lookup.data.departure?.iata}）
                    {lookup.data.departure?.terminal
                      ? ` T${lookup.data.departure.terminal}`
                      : ""}
                    {lookup.data.departure?.gate
                      ? ` · 登机口 ${lookup.data.departure.gate}`
                      : ""}
                  </div>
                  <div>
                    到达：{lookup.data.arrival?.airport}（
                    {lookup.data.arrival?.iata}）
                  </div>
                  {lookup.data.status && (
                    <div>状态：{lookup.data.status}</div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: 13, lineHeight: 1.9 }}>
                  <div>
                    {lookup.data.fromStation} → {lookup.data.toStation}
                  </div>
                  <div>
                    日期：{lookup.data.date} · 停靠 {lookup.data.stopCount} 站
                  </div>
                  {lookup.data.timetable?.length > 0 && (
                    <div>
                      经停：
                      {lookup.data.timetable
                        .slice(0, 3)
                        .map((s: any) => s.station)
                        .join(" / ")}
                      {lookup.data.timetable.length > 3 ? " …" : ""}
                    </div>
                  )}
                </div>
              )}
              <Button
                size="small"
                type="link"
                onClick={backfillFromLookup}
                style={{ paddingLeft: 0, marginTop: 4 }}
              >
                回填到表单
              </Button>
            </div>
          )}

          <Form.Item name="notes" label="备注">
            <TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 确认采纳城际草稿 */}
      <Modal
        title="确认采纳城际交通"
        open={!!confirmingItem}
        onOk={handleConfirm}
        onCancel={() => setConfirmingItem(null)}
        okText="确认采纳"
        cancelText="取消"
      >
        <Form form={confirmForm} layout="vertical">
          <Form.Item name="transportType" label="交通方式" rules={[{ required: true }]}>
            <Select>
              {Object.entries(TRANSPORT_LABELS).map(([k, v]) => (
                <Select.Option key={k} value={k}>
                  {TRANSPORT_ICONS[k]} {v}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="bookingInfo" label="预订信息">
            <Input placeholder="航班号/车次号/订单号" />
          </Form.Item>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Form.Item
              name="departureTime"
              label="出发时间"
              style={{ flex: 1, minWidth: 140 }}
            >
              <DatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item
              name="arrivalTime"
              label="到达时间"
              style={{ flex: 1, minWidth: 140 }}
            >
              <DatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: "100%" }} />
            </Form.Item>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Form.Item name="cost" label="花费 (¥)" style={{ flex: 1, minWidth: 140 }}>
              <InputNumber min={0} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="status" label="状态" style={{ flex: 1, minWidth: 140 }}>
              <Select>
                <Select.Option value="pending">待规划</Select.Option>
                <Select.Option value="booked">已预订</Select.Option>
                <Select.Option value="confirmed">已确认</Select.Option>
                <Select.Option value="completed">已完成</Select.Option>
              </Select>
            </Form.Item>
          </div>
          <Form.Item name="notes" label="备注">
            <TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ==================== 住宿 Tab ====================

function AccommodationTab({
  trip,
  onUpdate,
  readOnly,
}: {
  trip: Trip;
  onUpdate: () => void;
  readOnly: boolean;
}) {
  const { message } = AntApp.useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Accommodation | null>(null);
  const [form] = Form.useForm();
  const [mapPickerOpen, setMapPickerOpen] = useState(false);

  const onPickLocation = (loc: {
    lat: number;
    lng: number;
    name: string;
    address?: string;
  }) => {
    const cur = form.getFieldsValue();
    form.setFieldsValue({
      ...cur,
      address: cur.address || loc.address || "",
      lat: loc.lat,
      lng: loc.lng,
    });
  };

  const onPickMapPoint = (p: { lat: number; lng: number; address?: string }) => {
    const cur = form.getFieldsValue();
    form.setFieldsValue({
      ...cur,
      address: cur.address || p.address || "",
      lat: p.lat,
      lng: p.lng,
    });
    setMapPickerOpen(false);
  };

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
    const values = await form.validateFields();
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
  };

  const handleDelete = async (id: string) => {
    await accommodationApi.delete(trip.id, id);
    message.success("已删除");
    onUpdate();
  };

  return (
    <div>
      <div
        className="flex-between mb-12"
        style={{ flexWrap: "wrap", gap: 8 }}
      >
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
              <Tag color={STATUS_COLORS[item.status]}>
                {STATUS_LABELS[item.status]}
              </Tag>
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
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="住宿名称"
            rules={[{ required: true, message: "请输入名称" }]}
          >
            <Input placeholder="例如：京都四条大酒店" />
          </Form.Item>
          <Form.Item name="address" label="地址">
            <Input placeholder="详细地址" />
          </Form.Item>

          <Form.Item label="地点定位">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <LocationPicker city={trip.destination} onPick={onPickLocation} />
              </div>
              <Button icon={<EnvironmentOutlined />} onClick={() => setMapPickerOpen(true)}>
                地图选点
              </Button>
            </div>
          </Form.Item>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Form.Item
              name="checkInDate"
              label="入住日期"
              rules={[{ required: true }]}
              style={{ flex: 1, minWidth: 140 }}
            >
              <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" />
            </Form.Item>
            <Form.Item
              name="checkOutDate"
              label="退房日期"
              rules={[{ required: true }]}
              style={{ flex: 1, minWidth: 140 }}
            >
              <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" />
            </Form.Item>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Form.Item name="lat" label="纬度" style={{ flex: 1, minWidth: 140 }}>
              <InputNumber style={{ width: "100%" }} step={0.000001} placeholder="选填" />
            </Form.Item>
            <Form.Item name="lng" label="经度" style={{ flex: 1, minWidth: 140 }}>
              <InputNumber style={{ width: "100%" }} step={0.000001} placeholder="选填" />
            </Form.Item>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Form.Item name="cost" label="花费 (¥)" style={{ flex: 1, minWidth: 140 }}>
              <InputNumber style={{ width: "100%" }} min={0} />
            </Form.Item>
            <Form.Item name="status" label="状态" style={{ flex: 1, minWidth: 140 }}>
              <Select>
                <Select.Option value="pending">待规划</Select.Option>
                <Select.Option value="booked">已预订</Select.Option>
                <Select.Option value="confirmed">已确认</Select.Option>
              </Select>
            </Form.Item>
          </div>
          <Form.Item name="bookingInfo" label="预订信息">
            <Input placeholder="订单号/确认码" />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <MapPicker
        open={mapPickerOpen}
        initialLat={form.getFieldValue("lat")}
        initialLng={form.getFieldValue("lng")}
        onConfirm={onPickMapPoint}
        onCancel={() => setMapPickerOpen(false)}
      />
    </div>
  );
}

// ==================== 行程总览 Tab ====================

function SummaryTab({ trip }: { trip: Trip }) {
  const costFromItems = [
    ...(trip.transportations || []),
    ...(trip.accommodations || []),
    ...(trip.schedules?.flatMap((s) => s.items || []) || []),
  ].reduce((acc, item: any) => acc + (item.cost || 0), 0);

  const expenses = trip.expenses || [];
  const totalExpense = expenses.reduce((acc, e) => acc + (e.amount || 0), 0);
  const memberCount = trip.members?.length || 1;
  const perCapita = totalExpense / memberCount;

  const totalDays = trip.schedules?.length || 0;
  const totalItems =
    trip.schedules?.reduce((acc, s) => acc + (s.items?.length || 0), 0) || 0;

  // 收集所有有坐标的地点
  const allLocations: Array<{
    lat: number;
    lng: number;
    title: string;
    dayIndex?: number;
    type: string;
    date?: string;
  }> = [];

  const dayDateMap = new Map<number, string>();
  trip.schedules?.forEach((s) => dayDateMap.set(s.dayIndex, s.date));

  trip.accommodations?.forEach((a) => {
    if (a.lat && a.lng) {
      allLocations.push({ lat: a.lat, lng: a.lng, title: a.name, type: "hotel" });
    }
  });

  trip.schedules?.forEach((s) => {
    s.items?.forEach((item) => {
      if (item.lat && item.lng) {
        allLocations.push({
          lat: item.lat,
          lng: item.lng,
          title: item.title,
          dayIndex: s.dayIndex,
          type: item.type,
          date: s.date,
        });
      }
    });
  });

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <Card>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <h2 style={{ marginBottom: 8, fontSize: 20 }}>🧳 {trip.title}</h2>
          <div style={{ color: "#6b7280", fontSize: 13 }}>
            {dayjs(trip.startDate).format("YYYY年MM月DD日")} ~{" "}
            {dayjs(trip.endDate).format("YYYY年MM月DD日")}
            {trip.destination && ` · ${trip.destination}`}
          </div>
        </div>

        {/* 统计概览 */}
        <div className="summary-stats">
          <div className="summary-stat">
            <div className="stat-num">{totalDays}</div>
            <div className="stat-label">天行程</div>
          </div>
          <div className="summary-stat">
            <div className="stat-num">{totalItems}</div>
            <div className="stat-label">个安排</div>
          </div>
          <div className="summary-stat">
            <div className="stat-num">{trip.accommodations?.length || 0}</div>
            <div className="stat-label">处住宿</div>
          </div>
          <div className="summary-stat">
            <div className="stat-num">{memberCount}</div>
            <div className="stat-label">位成员</div>
          </div>
        </div>

        {/* 预算对比 */}
        {trip.budgetTotal != null && trip.budgetTotal > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div
              className="flex-between"
              style={{ fontSize: 13, marginBottom: 4 }}
            >
              <span>💰 预算使用</span>
              <span>
                ¥{(totalExpense + costFromItems).toFixed(0)} / ¥
                {trip.budgetTotal}
                {"  ·  剩余 ¥"}
                {Math.max(
                  0,
                  trip.budgetTotal - (totalExpense + costFromItems)
                ).toFixed(0)}
              </span>
            </div>
            <div
              style={{
                height: 8,
                background: "#f0f0f0",
                borderRadius: 4,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${Math.min(100, ((totalExpense + costFromItems) / trip.budgetTotal) * 100)}%`,
                  background:
                    totalExpense + costFromItems > trip.budgetTotal
                      ? "#ef4444"
                      : "#52c41a",
                  borderRadius: 4,
                  transition: "width 0.3s",
                }}
              />
            </div>
          </div>
        )}

        {/* 地图路线总览：总览只画日程/住宿点与当天路线，不展示城际交通信息 */}
        {allLocations.length > 0 && (
          <>
            <Divider style={{ margin: "16px 0" }}>🗺️ 地图路线</Divider>
            <MapView
              locations={allLocations}
              intercity={[]}
              showIntercity={false}
            />
          </>
        )}

        {/* 花费统计 */}
        {expenses.length > 0 && (
          <>
            <Divider style={{ margin: "16px 0" }}>💰 花费统计</Divider>
            <div className="expense-summary" style={{ marginBottom: 12 }}>
              <div className="expense-stat-card">
                <div className="stat-label">总花费</div>
                <div className="stat-value">¥{totalExpense.toFixed(2)}</div>
              </div>
              <div className="expense-stat-card">
                <div className="stat-label">人均</div>
                <div className="stat-value">¥{perCapita.toFixed(2)}</div>
              </div>
              <div className="expense-stat-card">
                <div className="stat-label">笔数</div>
                <div className="stat-value" style={{ color: "#1677ff" }}>
                  {expenses.length}
                </div>
              </div>
            </div>
            {costFromItems > 0 && (
              <div
                style={{
                  textAlign: "center",
                  fontSize: 12,
                  color: "#9ca3af",
                  marginBottom: 12,
                }}
              >
                另有交通/住宿/日程项中预估 ¥{costFromItems.toFixed(2)} 未计入人均分摊
              </div>
            )}
          </>
        )}

        <Divider style={{ margin: "16px 0" }} />

        {/* 交通概要 */}
        {trip.transportations && trip.transportations.length > 0 && (
          <>
            <h3>🚗 交通</h3>
            {trip.transportations.map((t) => (
              <div
                key={t.id}
                style={{
                  display: "flex",
                  gap: 8,
                  padding: "8px 0",
                  borderBottom: "1px solid #f5f5f5",
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <span>{TRANSPORT_ICONS[t.transportType]}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  {t.type === "departure"
                    ? "出发"
                    : t.type === "return"
                      ? "返程"
                      : "城际"}{" "}
                  · {TRANSPORT_LABELS[t.transportType]}
                  {t.departurePlace && ` · ${t.departurePlace}`}
                  {t.arrivalPlace && ` → ${t.arrivalPlace}`}
                  {t.departureTime &&
                    ` · ${dayjs(t.departureTime).format("MM-DD HH:mm")}`}
                </span>
              </div>
            ))}
          </>
        )}

        {/* 每日行程 */}
        {trip.schedules?.map((schedule) => (
          <div key={schedule.id} style={{ marginBottom: 16 }}>
            <h3 style={{ marginBottom: 8, fontSize: 15 }}>
              第{schedule.dayIndex}天 ·{" "}
              {dayjs(schedule.date).format("MM月DD日 ddd")}
            </h3>
            {schedule.items && schedule.items.length > 0 ? (
              schedule.items.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    gap: 8,
                    padding: "6px 0",
                    paddingLeft: 16,
                    fontSize: 14,
                    color: "#4b5563",
                    flexWrap: "wrap",
                  }}
                >
                  <span>{ITEM_TYPE_ICONS[item.type]}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    {item.startTime && `${item.startTime.slice(0, 5)} `}
                    {item.title}
                    {item.locationName && ` · 📍 ${item.locationName}`}
                    {item.cost ? ` · ¥${item.cost}` : ""}
                    {item.transportToNext && ` · 🚗 ${item.transportToNext}`}
                  </span>
                </div>
              ))
            ) : (
              <div style={{ paddingLeft: 16, color: "#d1d5db" }}>暂无安排</div>
            )}
          </div>
        ))}

        <Divider />
        <div style={{ textAlign: "center", color: "#9ca3af" }}>
          <Typography.Text type="secondary">
            邀请码：{trip.inviteCode} · 分享给旅伴一起规划吧！
          </Typography.Text>
        </div>
      </Card>
    </div>
  );
}

// ==================== 地图 Tab ====================

function MapTab({ trip }: { trip: Trip }) {
  const [filterDay, setFilterDay] = useState<number | "all">("all");
  const [showLines, setShowLines] = useState(true);
  const [showIntercity, setShowIntercity] = useState(true);
  const [showHotels, setShowHotels] = useState(true);
  const [showSchedule, setShowSchedule] = useState(true);
  const [clusterByDate, setClusterByDate] = useState(false);

  // 城际交通段（6.10）：坐标齐全的段画跨城蓝线；按单天筛选时不显示（城际段不属于某一天）
  const intercity = useMemo(
    () => toIntercitySegments(trip.transportations),
    [trip.transportations]
  );

  // 按天收集坐标；住宿保留 dayIndex 供按天筛选展示，但不参与连线（MapView 内 hotel 不进连线分组）
  // 日程项按 sortOrder（同序再按 startTime）排序，保证连线顺序与实际行程顺序一致
  // useMemo 稳定 allLocations 引用：仅行程/住宿数据变化时重建，避免父组件普通重渲染触发 MapView 反复重建 + 动画重播
  const allLocations = useMemo<MapLocation[]>(() => {
    const dayMap = new Map<number, MapLocation[]>();
    const dayDateMap = new Map<number, string>();
    trip.schedules?.forEach((s) => {
      dayDateMap.set(s.dayIndex, s.date);
      [...(s.items || [])]
        .sort(
          (x, y) =>
            (x.sortOrder ?? 0) - (y.sortOrder ?? 0) ||
            String(x.startTime || "").localeCompare(String(y.startTime || ""))
        )
        .forEach((item) => {
          if (item.lat && item.lng) {
            const arr = dayMap.get(s.dayIndex) || [];
            arr.push({
              lat: item.lat,
              lng: item.lng,
              title: item.title,
              dayIndex: s.dayIndex,
              type: item.type,
              date: dayDateMap.get(s.dayIndex),
            });
            dayMap.set(s.dayIndex, arr);
          }
        });
    });
    trip.accommodations?.forEach((a) => {
      if (!(a.lat && a.lng)) return;
      let targetDay: number | undefined;
      dayDateMap.forEach((date, day) => {
        if (date && a.checkInDate && date.slice(0, 10) === a.checkInDate.slice(0, 10)) targetDay = day;
      });
      const loc: MapLocation = {
        lat: a.lat,
        lng: a.lng,
        title: a.name,
        dayIndex: targetDay ?? 0,
        type: "hotel",
      };
      const key = targetDay ?? 0;
      const arr = dayMap.get(key) || [];
      arr.push(loc);
      dayMap.set(key, arr);
    });
    const sortedDays = [...dayMap.keys()].sort((x, y) => x - y);
    return sortedDays.flatMap((d) => dayMap.get(d)!);
  }, [trip.schedules, trip.accommodations]);

  const dayOptions = trip.schedules?.map((s) => s.dayIndex) || [];
  // 按天 + 类型开关过滤：关闭「日程」只留住宿点，关闭「住宿」隐藏住宿点
  const filtered = useMemo<MapLocation[]>(() => {
    let list =
      filterDay === "all"
        ? allLocations
        : allLocations.filter((l) => (l.dayIndex || 0) === filterDay);
    if (!showSchedule) list = list.filter((l) => l.type === "hotel");
    if (!showHotels) list = list.filter((l) => l.type !== "hotel");
    return list;
  }, [allLocations, filterDay, showSchedule, showHotels]);

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <Select
          value={filterDay}
          onChange={(v) => setFilterDay(v)}
          style={{ width: 160 }}
        >
          <Select.Option value="all">全部天数</Select.Option>
          {dayOptions.map((d) => (
            <Select.Option key={d} value={d}>
              第{d}天
            </Select.Option>
          ))}
        </Select>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={showLines}
            onChange={(e) => setShowLines(e.target.checked)}
          />
          显示路线连线
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={showIntercity}
            onChange={(e) => setShowIntercity(e.target.checked)}
          />
          显示交通信息
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={showHotels}
            onChange={(e) => setShowHotels(e.target.checked)}
          />
          显示住宿点
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={showSchedule}
            onChange={(e) => setShowSchedule(e.target.checked)}
          />
          显示日程
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={clusterByDate}
            onChange={(e) => setClusterByDate(e.target.checked)}
          />
          按日期聚合
        </label>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginLeft: "auto" }}>
          {intercity.length > 0 && (
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
              <span style={{ width: 16, height: 0, borderTop: "3px solid #2f54eb" }} />
              城际移动
            </span>
          )}
          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
            <span style={{ width: 16, height: 0, borderTop: "2px dashed #8c8c8c" }} />
            跨天移动
          </span>
          {trip.accommodations?.some((a) => a.lat && a.lng) && (
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
              <span style={{ fontSize: 13, lineHeight: "16px" }}>{"\u{1F3E8}"}</span>
              住宿（只标点）
            </span>
          )}
          {dayOptions.map((d) => (
            <span
              key={d}
              style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: DAY_COLORS[(d - 1) % DAY_COLORS.length],
                }}
              />
              第{d}天
            </span>
          ))}
        </div>
      </div>
      <MapView
        locations={filtered}
        showPolylines={showLines}
        intercity={filterDay === "all" ? intercity : []}
        showIntercity={showIntercity && showSchedule}
        cluster={clusterByDate}
      />
    </div>
  );
}
