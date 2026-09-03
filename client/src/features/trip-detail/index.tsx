import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Spin, Tabs, Button } from "antd";
import { App as AntApp } from "antd";
import type { Trip } from "../../types";
import { tripApi } from "../../api";
import ProgressBoard from "../../components/ProgressBoard";
import ExpensesTab from "../../components/ExpensesTab";
import ChecklistTab from "../../components/ChecklistTab";
import MembersModal from "../../components/MembersModal";
import TripHeader from "./TripHeader";
import EditTripModal from "./EditTripModal";
import { useTripPermission } from "./useTripPermission";
import { useTripWeather } from "./useTripWeather";
import ScheduleTab from "./schedule/ScheduleTab";
import TransportTab from "./transport/TransportTab";
import AccommodationTab from "./accommodation/AccommodationTab";
import SummaryTab from "./summary/SummaryTab";
import MapTab from "./map/MapTab";

export default function TripDetail() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [membersModalOpen, setMembersModalOpen] = useState(false);

  const { isOwner, canEdit } = useTripPermission(trip);
  const weatherByDate = useTripWeather(trip);

  const loadTrip = useCallback(async () => {
    if (!tripId) {
      setLoading(false);
      return;
    }
    try {
      const data = await tripApi.get(tripId);
      setTrip(data);
    } catch {
      message.error("加载失败");
    } finally {
      setLoading(false);
    }
  }, [tripId, message]);

  useEffect(() => {
    loadTrip();
  }, [loadTrip]);

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

  return (
    <div>
      <TripHeader
        trip={trip}
        weather={weatherByDate}
        isOwner={isOwner}
        canEdit={canEdit}
        onEdit={() => setEditModalOpen(true)}
        onOpenMembers={() => setMembersModalOpen(true)}
      />

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
        destroyOnHidden
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
              <ScheduleTab trip={trip} onUpdate={loadTrip} readOnly={!canEdit} weather={weatherByDate} />
            ),
          },
          {
            key: "transport",
            label: "🚗 交通",
            children: <TransportTab trip={trip} onUpdate={loadTrip} readOnly={!canEdit} />,
          },
          {
            key: "accommodation",
            label: "🏨 住宿",
            children: <AccommodationTab trip={trip} onUpdate={loadTrip} readOnly={!canEdit} />,
          },
          {
            key: "expense",
            label: "💰 花费",
            children: <ExpensesTab trip={trip} onUpdate={loadTrip} readOnly={!canEdit} />,
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
          },
        ]}
      />

      <EditTripModal
        trip={trip}
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSaved={loadTrip}
      />

      <MembersModal
        trip={trip}
        open={membersModalOpen}
        onClose={() => setMembersModalOpen(false)}
        onUpdated={loadTrip}
      />
    </div>
  );
}
