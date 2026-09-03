import { useEffect, useMemo, useState } from "react";
import { Card, Divider, Typography } from "antd";
import dayjs from "dayjs";
import type { Trip, ExpenseStats } from "../../../types";
import {
  TRANSPORT_LABELS,
  TRANSPORT_ICONS,
  ITEM_TYPE_ICONS,
} from "../../../types";
import { expenseApi } from "../../../api";
import MapView from "../../../components/MapView";

interface SummaryTabProps {
  trip: Trip;
}

export default function SummaryTab({ trip }: SummaryTabProps) {
  const costFromItems = [
    ...(trip.transportations || []),
    ...(trip.accommodations || []),
    ...(trip.schedules?.flatMap((s) => s.items || []) || []),
  ].reduce((acc, item: { cost?: number }) => acc + (item.cost || 0), 0);

  // 花费总额/人均以前后端 stats 为准（仅计合法分摊笔），与 ExpensesTab 口径一致
  const [stats, setStats] = useState<ExpenseStats | null>(null);
  useEffect(() => {
    let cancelled = false;
    expenseApi.stats(trip.id).then((s) => {
      if (!cancelled) setStats(s);
    }).catch(() => {
      /* 拉取失败则回退为不显示花费统计，静默降级 */
    });
    return () => {
      cancelled = true;
    };
  }, [trip.id]);

  const expenses = trip.expenses || [];
  const totalExpense = stats?.total ?? 0;
  const memberCount = trip.members?.length || 1;
  const perCapita = stats?.perCapita ?? 0;

  const totalDays = trip.schedules?.length || 0;
  const totalItems =
    trip.schedules?.reduce((acc, s) => acc + (s.items?.length || 0), 0) || 0;

  // 收集所有有坐标的地点（useMemo 稳定引用）
  const allLocations = useMemo(() => {
    const locs: Array<{
      lat: number;
      lng: number;
      title: string;
      dayIndex?: number;
      type: string;
      date?: string;
    }> = [];

    trip.accommodations?.forEach((a) => {
      if (a.lat && a.lng) {
        locs.push({ lat: a.lat, lng: a.lng, title: a.name, type: "hotel" });
      }
    });

    trip.schedules?.forEach((s) => {
      s.items?.forEach((item) => {
        if (item.lat && item.lng) {
          locs.push({
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
    return locs;
  }, [trip.schedules, trip.accommodations]);

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
            <div className="flex-between" style={{ fontSize: 13, marginBottom: 4 }}>
              <span>💰 预算使用</span>
              <span>
                ¥{(totalExpense + costFromItems).toFixed(0)} / ¥{trip.budgetTotal}
                {"  ·  剩余 ¥"}
                {Math.max(0, trip.budgetTotal - (totalExpense + costFromItems)).toFixed(0)}
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
                    totalExpense + costFromItems > trip.budgetTotal ? "#ef4444" : "#52c41a",
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
            <MapView locations={allLocations} intercity={[]} showIntercity={false} />
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
                  {t.type === "departure" ? "出发" : t.type === "return" ? "返程" : "城际"}{" "}
                  · {TRANSPORT_LABELS[t.transportType]}
                  {t.departurePlace && ` · ${t.departurePlace}`}
                  {t.arrivalPlace && ` → ${t.arrivalPlace}`}
                  {t.departureTime && ` · ${dayjs(t.departureTime).format("MM-DD HH:mm")}`}
                </span>
              </div>
            ))}
          </>
        )}

        {/* 每日行程 */}
        {trip.schedules?.map((schedule) => (
          <div key={schedule.id} style={{ marginBottom: 16 }}>
            <h3 style={{ marginBottom: 8, fontSize: 15 }}>
              第{schedule.dayIndex}天 · {dayjs(schedule.date).format("MM月DD日 ddd")}
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
