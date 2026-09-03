import { Button, Space, Tag, Avatar, Tooltip } from "antd";
import {
  ArrowLeftOutlined,
  CopyOutlined,
  EditOutlined,
  DeleteOutlined,
  ShareAltOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { App as AntApp } from "antd";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import { Popconfirm } from "antd";
import type { Trip, WeatherDay } from "../../types";
import { tripApi } from "../../api";
import { TRIP_STATUS_LABELS } from "../../types";
import { copyText } from "../../utils/clipboard";
import ExportTripImage from "../../components/ExportTripImage";

interface TripHeaderProps {
  trip: Trip;
  weather: Record<string, WeatherDay>;
  isOwner: boolean;
  canEdit: boolean;
  onEdit: () => void;
  onOpenMembers: () => void;
}

export default function TripHeader({
  trip,
  weather,
  isOwner,
  onEdit,
  onOpenMembers,
}: TripHeaderProps) {
  const navigate = useNavigate();
  const { message } = AntApp.useApp();

  const copyInviteCode = async () => {
    const ok = await copyText(trip.inviteCode);
    if (ok) message.success("邀请码已复制！分享给旅伴吧");
    else message.error("复制失败，请手动选中邀请码复制");
  };

  const copyShareLink = async () => {
    const link = `${window.location.origin}${import.meta.env.BASE_URL}share/${trip.inviteCode}`;
    const ok = await copyText(link);
    if (ok) message.success("分享链接已复制！发给朋友即可查看行程");
    else message.error("复制失败，请手动复制浏览器地址栏链接");
  };

  const handleDelete = async () => {
    try {
      await tripApi.delete(trip.id);
      message.success("计划已删除");
      navigate("/");
    } catch {
      message.error("删除失败");
    }
  };

  return (
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
          <Button size="small" icon={<ShareAltOutlined />} onClick={copyShareLink}>
            分享链接
          </Button>
          <ExportTripImage trip={trip} weather={weather} />
          {isOwner && (
            <>
              <Button size="small" icon={<EditOutlined />} onClick={onEdit}>
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
              <ClockCircleOutlined /> {dayjs(trip.startDate).format("YYYY-MM-DD")} ~{" "}
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
          <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 4 }}>邀请码</div>
          <div className="invite-code-box" onClick={copyInviteCode} style={{ cursor: "pointer" }}>
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
                title={`${m.user?.nickname || "未知"} (${
                  m.role === "owner" ? "创建者" : m.role === "editor" ? "编辑者" : "查看者"
                })`}
              >
                <Avatar
                  style={{ backgroundColor: m.role === "owner" ? "#1677ff" : "#87d068" }}
                >
                  {m.user?.nickname?.[0] || "?"}
                </Avatar>
              </Tooltip>
            ))}
          </Avatar.Group>
          {isOwner && (
            <Button size="small" icon={<TeamOutlined />} onClick={onOpenMembers}>
              管理成员
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
