import { Tag } from "antd";
import dayjs from "dayjs";
import type { Trip } from "../../types";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  TRANSPORT_LABELS,
  TRANSPORT_ICONS,
  ITEM_TYPE_ICONS,
} from "../../types";

/** 统计概览 4 列卡片（总览页与分享页共用） */
export function StatsOverview({ trip }: { trip: Trip }) {
  const totalDays = trip.schedules?.length || 0;
  const totalItems =
    trip.schedules?.reduce((acc, s) => acc + (s.items?.length || 0), 0) || 0;

  return (
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
  );
}

/** 交通概要列表（总览页不显示状态标签，分享页显示） */
export function TransportSummary({
  trip,
  showStatus = false,
}: {
  trip: Trip;
  showStatus?: boolean;
}) {
  if (!trip.transportations || trip.transportations.length === 0) return null;
  return (
    <>
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
          {showStatus && (
            <Tag color={STATUS_COLORS[t.status]}>{STATUS_LABELS[t.status]}</Tag>
          )}
        </div>
      ))}
    </>
  );
}

/** 住宿概要列表（分享页展示，总览页暂未展示） */
export function AccommodationSummary({ trip }: { trip: Trip }) {
  if (!trip.accommodations || trip.accommodations.length === 0) return null;
  const sorted = [...trip.accommodations].sort((a, b) =>
    (a.checkInDate || "").localeCompare(b.checkInDate || "")
  );
  return (
    <>
      {sorted.map((a) => (
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
          <Tag color={STATUS_COLORS[a.status]}>{STATUS_LABELS[a.status]}</Tag>
        </div>
      ))}
    </>
  );
}

/** 每日行程列表（总览页不显示状态标签/图片，分享页显示） */
export function ScheduleSummary({
  trip,
  showStatus = false,
  showImage = false,
}: {
  trip: Trip;
  showStatus?: boolean;
  showImage?: boolean;
}) {
  return (
    <>
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
                {showStatus && (
                  <Tag color={STATUS_COLORS[item.status]} style={{ fontSize: 11 }}>
                    {STATUS_LABELS[item.status]}
                  </Tag>
                )}
                {showImage && item.imageUrl && (
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
    </>
  );
}
