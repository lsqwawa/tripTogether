import { Tag, Tooltip, Progress } from "antd";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  TRANSPORT_ICONS,
  TRANSPORT_LABELS,
} from "../types";
import type { Trip } from "../types";

interface Props {
  trip: Trip;
}

export default function ProgressBoard({ trip }: Props) {
  // 计算各环节状态
  const departures = trip.transportations?.filter(
    (t) => t.type === "departure"
  );
  const returns = trip.transportations?.filter(
    (t) => t.type === "return"
  );
  const accommodations = trip.accommodations;
  const schedules = trip.schedules;

  const departureStatus = getSectionStatus(departures);
  const returnStatus = getSectionStatus(returns);
  const accommodationStatus = getSectionStatus(accommodations);
  const scheduleStatus = getScheduleStatus(schedules);

  // 整体完成度：以「可规划单元」为粒度（交通 + 住宿 + 所有日程项）
  const allUnits: Array<{ status: string }> = [
    ...(trip.transportations || []),
    ...(trip.accommodations || []),
    ...(trip.schedules || []).flatMap(
      (s) => (s.items || []) as Array<{ status: string }>
    ),
  ];
  const totalUnits = allUnits.length;
  const doneUnits = allUnits.filter((u) =>
    ["confirmed", "completed", "done"].includes(u.status)
  ).length;
  const overallPercent =
    totalUnits === 0 ? 0 : Math.round((doneUnits / totalUnits) * 100);

  const sections = [
    {
      icon: "🚀",
      title: "出发交通",
      status: departureStatus,
      detail:
        departures && departures.length > 0
          ? departures
              .map(
                (d) =>
                  `${TRANSPORT_ICONS[d.transportType]} ${
                    TRANSPORT_LABELS[d.transportType]
                  }`
              )
              .join("、")
          : "尚未规划",
    },
    {
      icon: "🏨",
      title: "住宿安排",
      status: accommodationStatus,
      detail:
        accommodations && accommodations.length > 0
          ? `${accommodations.length} 处住宿`
          : "尚未规划",
    },
    {
      icon: "📅",
      title: "每日日程",
      status: scheduleStatus,
      detail:
        schedules && schedules.length > 0
          ? `${schedules.length} 天 · ${schedules.reduce(
              (acc, s) => acc + (s.items?.length || 0),
              0
            )} 个安排`
          : "尚未规划",
    },
    {
      icon: "🏠",
      title: "返程交通",
      status: returnStatus,
      detail:
        returns && returns.length > 0
          ? returns
              .map(
                (r) =>
                  `${TRANSPORT_ICONS[r.transportType]} ${
                    TRANSPORT_LABELS[r.transportType]
                  }`
              )
              .join("、")
          : "尚未规划",
    },
  ];

  return (
    <div>
      {/* 整体规划完成度：独占一行 */}
      <div style={{ marginBottom: 16 }}>
        <div
          className="flex-between"
          style={{ fontSize: 13, marginBottom: 6 }}
        >
          <span>📊 整体规划完成度</span>
          <span style={{ color: "#6b7280" }}>
            {totalUnits === 0
              ? "暂无规划内容"
              : `${overallPercent}% · ${doneUnits}/${totalUnits} 项已完成`}
          </span>
        </div>
        <Progress
          percent={overallPercent}
          showInfo={false}
          strokeColor={overallPercent === 100 ? "#52c41a" : "#1677ff"}
        />
      </div>

      {/* 四个环节卡片：桌面端自适应列数，移动端固定 2 列 */}
      <div className="progress-board">
        {sections.map((s) => (
          <div
            key={s.title}
            className={`progress-card ${s.status === "completed" ? "done" : ""}`}
          >
            <div className="card-header">
              <span className="card-icon">{s.icon}</span>
              <Tag color={STATUS_COLORS[s.status] || "default"}>
                {STATUS_LABELS[s.status] || s.status}
              </Tag>
            </div>
            <div className="card-title">{s.title}</div>
            <div
              style={{ fontSize: 13, color: "#999", marginTop: 4 }}
            >
              {s.detail}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function getSectionStatus(
  items?: Array<{ status: string }>
): string {
  if (!items || items.length === 0) return "pending";
  const allDone = items.every(
    (i) => i.status === "confirmed" || i.status === "completed" || i.status === "done"
  );
  if (allDone) return "confirmed";
  const anyBooked = items.some(
    (i) => i.status === "booked" || i.status === "confirmed"
  );
  if (anyBooked) return "booked";
  return "pending";
}

function getScheduleStatus(
  schedules?: Array<{ items?: Array<{ status: string }> }>
): string {
  if (!schedules || schedules.length === 0) return "pending";
  const totalItems = schedules.reduce(
    (acc, s) => acc + (s.items?.length || 0),
    0
  );
  if (totalItems === 0) return "pending";
  const doneItems = schedules.reduce(
    (acc, s) =>
      acc +
      (s.items?.filter(
        (i) =>
          i.status === "confirmed" ||
          i.status === "completed" ||
          i.status === "done"
      ).length || 0),
    0
  );
  if (doneItems === totalItems) return "confirmed";
  if (doneItems > 0) return "booked";
  return "pending";
}
