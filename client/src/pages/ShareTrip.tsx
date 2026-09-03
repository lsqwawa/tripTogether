import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Spin, Button, Card, Divider, Tag, Avatar, Tooltip, Typography, Empty } from "antd";
import {
  ArrowLeftOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  LoginOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { tripApi } from "../api";
import type { Trip } from "../types";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  TRANSPORT_LABELS,
  TRANSPORT_ICONS,
  ITEM_TYPE_LABELS,
  ITEM_TYPE_ICONS,
  TRIP_STATUS_LABELS,
} from "../types";
import MapView, { toIntercitySegments } from "../components/MapView";
import ExportTripImage from "../components/ExportTripImage";

export default function ShareTrip() {
  const { inviteCode } = useParams();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!inviteCode) return;
    (async () => {
      try {
        const data = await tripApi.getByShareCode(inviteCode.toUpperCase());
        setTrip(data);
      } catch (e: any) {
        setError(e?.response?.data?.error || "行程不存在或链接无效");
      } finally {
        setLoading(false);
      }
    })();
  }, [inviteCode]);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="empty-state">
        <div className="empty-icon">😕</div>
        <p>{error || "行程不存在"}</p>
        <Button type="primary" onClick={() => navigate("/")}>
          返回首页
        </Button>
      </div>
    );
  }

  // 收集有坐标的地点
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

  const totalDays = trip.schedules?.length || 0;
  const totalItems =
    trip.schedules?.reduce((acc, s) => acc + (s.items?.length || 0), 0) || 0;
  const costFromItems = [
    ...(trip.transportations || []),
    ...(trip.accommodations || []),
    ...(trip.schedules?.flatMap((s) => s.items || []) || []),
  ].reduce((acc, item: any) => acc + (item.cost || 0), 0);

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "20px 0" }}>
      {/* 顶部操作栏 */}
      <div className="flex-between mb-16" style={{ flexWrap: "wrap", gap: 8 }}>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate("/")}
        >
          返回首页
        </Button>
        <div style={{ display: "flex", gap: 8 }}>
          <ExportTripImage trip={trip} />
          <Button
            type="primary"
            icon={<LoginOutlined />}
            onClick={() => navigate(`/join?code=${trip.inviteCode}`)}
          >
            加入这个计划
          </Button>
        </div>
      </div>

      <Card>
        {/* 标题区 */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <h1 style={{ marginBottom: 8, fontSize: 24 }}>
            🧳 {trip.title}
          </h1>
          <Tag
            color={
              trip.status === "planning"
                ? "blue"
                : trip.status === "ongoing"
                ? "green"
                : "default"
            }
            style={{ marginBottom: 8 }}
          >
            {TRIP_STATUS_LABELS[trip.status]}
          </Tag>
          <div style={{ color: "#6b7280", fontSize: 13 }}>
            {dayjs(trip.startDate).format("YYYY年MM月DD日")} ~{" "}
            {dayjs(trip.endDate).format("YYYY年MM月DD日")}
            {trip.destination && ` · ${trip.destination}`}
          </div>
          {trip.description && (
            <div style={{ color: "#9ca3af", fontSize: 13, marginTop: 8 }}>
              {trip.description}
            </div>
          )}
        </div>

        {/* 成员 */}
        {trip.members && trip.members.length > 0 && (
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <Avatar.Group max={{ count: 8 }}>
              {trip.members.map((m) => (
                <Tooltip
                  key={m.id}
                  title={`${m.user?.nickname || "未知"} (${
                    m.role === "owner" ? "创建者" : "成员"
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
          </div>
        )}

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
            <div className="stat-num">{trip.members?.length || 0}</div>
            <div className="stat-label">位成员</div>
          </div>
        </div>

        {/* 地图路线 */}
        {allLocations.length > 0 && (
          <>
            <Divider style={{ margin: "16px 0" }}>🗺️ 地图路线</Divider>
            <MapView
              locations={allLocations}
              intercity={toIntercitySegments(trip.transportations)}
            />
          </>
        )}

        {/* 交通概要 */}
        {trip.transportations && trip.transportations.length > 0 && (
          <>
            <Divider style={{ margin: "16px 0" }}>🚗 交通</Divider>
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
                <Tag color={STATUS_COLORS[t.status]}>
                  {STATUS_LABELS[t.status]}
                </Tag>
              </div>
            ))}
          </>
        )}

        {/* 住宿概要 */}
        {trip.accommodations && trip.accommodations.length > 0 && (
          <>
            <Divider style={{ margin: "16px 0" }}>🏨 住宿</Divider>
            {trip.accommodations.map((a) => (
              <div
                key={a.id}
                style={{
                  display: "flex",
                  gap: 8,
                  padding: "8px 0",
                  borderBottom: "1px solid #f5f5f5",
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <span>🏨</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  {a.name}
                  {a.address && ` · 📍 ${a.address}`}
                  {` · ${dayjs(a.checkInDate).format("MM-DD")} ~ ${dayjs(a.checkOutDate).format("MM-DD")}`}
                  {a.cost ? ` · ¥${a.cost}` : ""}
                </span>
                <Tag color={STATUS_COLORS[a.status]}>
                  {STATUS_LABELS[a.status]}
                </Tag>
              </div>
            ))}
          </>
        )}

        {/* 每日行程 */}
        <Divider style={{ margin: "16px 0" }}>📅 每日行程</Divider>
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
                  <Tag color={STATUS_COLORS[item.status]} style={{ fontSize: 11 }}>
                    {STATUS_LABELS[item.status]}
                  </Tag>
                  {item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      style={{
                        width: "100%",
                        maxHeight: 160,
                        objectFit: "cover",
                        borderRadius: 6,
                        marginTop: 4,
                      }}
                    />
                  )}
                </div>
              ))
            ) : (
              <div style={{ paddingLeft: 16, color: "#d1d5db" }}>暂无安排</div>
            )}
          </div>
        ))}

        {/* 底部 */}
        <Divider />
        <div style={{ textAlign: "center" }}>
          <Typography.Text type="secondary">
            想一起规划？点击上方「加入这个计划」
          </Typography.Text>
        </div>
      </Card>
    </div>
  );
}
