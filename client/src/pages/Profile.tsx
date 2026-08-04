import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Avatar,
  Button,
  Modal,
  Input,
  message,
  Spin,
  Empty,
  Card,
  Tag,
  Row,
  Col,
  Statistic,
} from "antd";
import {
  EditOutlined,
  LogoutOutlined,
  CalendarOutlined,
  TeamOutlined,
  EnvironmentOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useUserStore } from "../stores/userStore";
import { userApi } from "../api";
import type { Trip } from "../types";
import { TRIP_STATUS_LABELS } from "../types";

export default function Profile() {
  const navigate = useNavigate();
  const user = useUserStore((s) => s.user);
  const updateProfile = useUserStore((s) => s.updateProfile);
  const logout = useUserStore((s) => s.logout);

  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [nickname, setNickname] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      loadTrips();
    }
  }, [user]);

  // 如果 localStorage 里有 userId 但 store 里还没 user，说明还在初始化中
  const [initializing, setInitializing] = useState(true);
  useEffect(() => {
    // 给 init() 一点时间跑完
    const t = setTimeout(() => setInitializing(false), 500);
    return () => clearTimeout(t);
  }, []);

  const loadTrips = async () => {
    setLoading(true);
    try {
      const data = await userApi.myTrips();
      setTrips(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openEdit = () => {
    if (!user) return;
    setNickname(user.nickname);
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!nickname.trim()) {
      message.warning("昵称不能为空");
      return;
    }
    if (nickname.length > 20) {
      message.warning("昵称不能超过 20 个字符");
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ nickname: nickname.trim() });
      message.success("昵称已更新");
      setEditOpen(false);
    } catch (e: any) {
      const msg = e?.response?.data?.error || "更新失败";
      message.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Modal.confirm({
      title: "确定要退出登录吗？",
      content: "退出后你仍可以重新登录",
      okText: "退出",
      cancelText: "取消",
      okButtonProps: { danger: true },
      onOk: () => {
        logout();
        navigate("/");
      },
    });
  };

  if (!user) {
    if (initializing) {
      return (
        <div style={{ textAlign: "center", padding: 80 }}>
          <Spin size="large" />
        </div>
      );
    }
    // 初始化完成后仍然没 user，才跳登录
    navigate("/login");
    return null;
  }

  // 统计
  const ownCount = trips.filter((t) =>
    t.members?.some((m) => m.userId === user.id && m.role === "owner")
  ).length;
  const memberCount = trips.length;

  return (
    <div>
      {/* 头部信息 */}
      <div className="profile-header">
        <Avatar
          size={64}
          style={{
            backgroundColor: "#fff",
            color: "#1677ff",
            fontSize: 28,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {user.nickname?.[0] || "U"}
        </Avatar>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2>{user.nickname}</h2>
          <p>
            加入于 {dayjs(user.createdAt).format("YYYY-MM-DD")}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button
            icon={<EditOutlined />}
            onClick={openEdit}
            style={{ background: "rgba(255,255,255,0.2)", color: "#fff", border: "none" }}
          >
            改昵称
          </Button>
          <Button
            icon={<LogoutOutlined />}
            onClick={handleLogout}
            danger
          >
            退出
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={8}>
          <Card>
            <Statistic title="参与计划" value={memberCount} suffix="个" />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card>
            <Statistic title="我创建的" value={ownCount} suffix="个" />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="即将出行"
              value={
                trips.filter(
                  (t) =>
                    t.status !== "completed" &&
                    dayjs(t.endDate).isAfter(dayjs())
                ).length
              }
              suffix="个"
            />
          </Card>
        </Col>
      </Row>

      {/* 我的旅行 */}
      <div className="flex-between mb-16">
        <h2 style={{ margin: 0 }}>我的旅行</h2>
        <Button
          type="primary"
          onClick={() => navigate("/trips/new")}
        >
          + 创建新计划
        </Button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40 }}>
          <Spin />
        </div>
      ) : trips.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🧳</div>
          <p>还没有参与任何旅行计划</p>
          <Button
            type="primary"
            style={{ marginTop: 16 }}
            onClick={() => navigate("/trips/new")}
          >
            创建第一个计划
          </Button>
        </div>
      ) : (
        <div className="trip-grid">
          {trips.map((trip) => {
            const isOwner = trip.members?.some(
              (m) => m.userId === user.id && m.role === "owner"
            );
            return (
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
                  }}
                >
                  {!trip.coverImage && "🌍"}
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
                      {trip.members?.length || 1}人
                    </span>
                    {isOwner && <Tag color="gold">创建者</Tag>}
                  </div>
                  {trip.destination && (
                    <div className="trip-card-destination">
                      <EnvironmentOutlined /> {trip.destination}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 改昵称弹窗 */}
      <Modal
        title="修改昵称"
        open={editOpen}
        onOk={handleSave}
        onCancel={() => setEditOpen(false)}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
      >
        <Input
          size="large"
          prefix={<EditOutlined />}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={20}
          placeholder="新昵称"
          allowClear
        />
        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            color: "#9ca3af",
          }}
        >
          同一昵称对应同一账号，请确认后再修改
        </div>
      </Modal>
    </div>
  );
}
