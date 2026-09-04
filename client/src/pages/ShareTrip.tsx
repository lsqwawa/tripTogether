import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Spin, Button, Card, Divider, Tag, Avatar, Tooltip, Typography } from "antd";
import { ArrowLeftOutlined, LoginOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { tripApi } from "../api";
import type { Trip } from "../types";
import { TRIP_STATUS_LABELS } from "../types";
import MapView, { toIntercitySegments } from "../components/MapView";
import ExportTripImage from "../components/ExportTripImage";
import { collectTripLocations } from "../features/trip-overview/collectLocations";
import {
  StatsOverview,
  TransportSummary,
  AccommodationSummary,
  ScheduleSummary,
} from "../features/trip-overview/TripOverviewSections";

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
  const allLocations = collectTripLocations(trip);

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
        <StatsOverview trip={trip} />

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
            <TransportSummary trip={trip} showStatus />
          </>
        )}

        {/* 住宿概要 */}
        {trip.accommodations && trip.accommodations.length > 0 && (
          <>
            <Divider style={{ margin: "16px 0" }}>🏨 住宿</Divider>
            <AccommodationSummary trip={trip} />
          </>
        )}

        {/* 每日行程 */}
        <Divider style={{ margin: "16px 0" }}>📅 每日行程</Divider>
        <ScheduleSummary trip={trip} showStatus showImage />

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
