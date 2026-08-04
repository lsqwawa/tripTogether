import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Spin, Empty, Tag, Avatar, Tooltip, App as AntApp, Popconfirm } from "antd";
import {
  PlusOutlined,
  CalendarOutlined,
  TeamOutlined,
  EnvironmentOutlined,
  UserOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { tripApi } from "../api";
import { useUserStore } from "../stores/userStore";
import type { Trip } from "../types";
import { TRIP_STATUS_LABELS } from "../types";

export default function Home() {
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const user = useUserStore((s) => s.user);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTrips = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const data = await tripApi.list();
      setTrips(data);
    } catch (e) {
      message.error("加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrips();
  }, [user]);

  const handleDelete = async (e: React.MouseEvent, tripId: string) => {
    e.stopPropagation();
    try {
      await tripApi.delete(tripId);
      message.success("计划已删除");
      loadTrips();
    } catch {
      message.error("删除失败");
    }
  };

  // 未登录：引导登录
  if (!user) {
    return (
      <div className="empty-state" style={{ paddingTop: 100 }}>
        <div className="empty-icon">🧭</div>
        <p style={{ fontSize: 16, marginBottom: 8 }}>登录后查看你的旅行计划</p>
        <p style={{ marginBottom: 24 }}>和旅伴一起规划下一段旅程</p>
        <Button
          type="primary"
          size="large"
          icon={<UserOutlined />}
          onClick={() => navigate("/login")}
        >
          登录 / 注册
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex-between mb-16" style={{ flexWrap: "wrap", gap: 12 }}>
        <h2 style={{ margin: 0 }}>
          你好，{user.nickname} 👋
        </h2>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate("/trips/new")}
        >
          创建计划
        </Button>
      </div>

      {trips.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🧳</div>
          <p style={{ fontSize: 16, marginBottom: 8 }}>还没有旅行计划</p>
          <p style={{ marginBottom: 24 }}>
            创建一个，开始规划你的下一段旅程
          </p>
          <Button
            type="primary"
            size="large"
            icon={<PlusOutlined />}
            onClick={() => navigate("/trips/new")}
          >
            创建第一个计划
          </Button>
        </div>
      ) : (
        <div className="trip-grid">
          {trips.map((trip) => (
            <div
              key={trip.id}
              className="trip-card"
              onClick={() => navigate(`/trips/${trip.id}`)}
            >
              <div
                className="trip-card-cover"
                style={{
                  background: trip.coverImage
                    ? `url(${trip.coverImage})`
                    : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  position: "relative",
                }}
              >
                {!trip.coverImage && "🌍"}
                <Popconfirm
                  title="确认删除这个计划？"
                  description="所有数据将一并删除，不可撤销。"
                  onConfirm={(e) => {
                    e?.stopPropagation();
                    handleDelete(e as any, trip.id);
                  }}
                  onCancel={(e) => e?.stopPropagation()}
                  okText="删除"
                  cancelText="取消"
                  okButtonProps={{ danger: true }}
                >
                  <Button
                    danger
                    size="small"
                    type="primary"
                    icon={<DeleteOutlined />}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      opacity: 0.8,
                    }}
                  />
                </Popconfirm>
              </div>
              <div className="trip-card-body">
                <div className="trip-card-title-row">
                  <div className="trip-card-title">{trip.title}</div>
                  <Tag
                    color={
                      trip.status === "planning"
                        ? "blue"
                        : trip.status === "ongoing"
                        ? "green"
                        : "default"
                    }
                  >
                    {TRIP_STATUS_LABELS[trip.status]}
                  </Tag>
                </div>
                <div className="trip-card-meta">
                  <span className="trip-card-meta-item">
                    <CalendarOutlined />
                    {dayjs(trip.startDate).format("MM/DD")} -{" "}
                    {dayjs(trip.endDate).format("MM/DD")}
                  </span>
                  <span className="trip-card-meta-item">
                    <TeamOutlined />
                    {trip.members?.length || 1} 人
                  </span>
                </div>
                {trip.destination && (
                  <div className="trip-card-destination">
                    <EnvironmentOutlined /> {trip.destination}
                  </div>
                )}
                {trip.members && trip.members.length > 0 && (
                  <div className="trip-card-members">
                    <Avatar.Group maxCount={5} size="small">
                      {trip.members.map((m) => (
                        <Tooltip
                          key={m.id}
                          title={`${m.user?.nickname || "未知"} (${
                            m.role === "owner"
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
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
