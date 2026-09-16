import { useRef, useState } from "react";
import { Modal, Button, App as AntApp, Space } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import html2canvas from "html2canvas";
import dayjs from "dayjs";
import type { Trip, WeatherDay } from "../types";
import {
  TRANSPORT_LABELS,
  TRANSPORT_ICONS,
  ITEM_TYPE_ICONS,
  TRIP_STATUS_LABELS,
} from "../types";

interface Props {
  trip: Trip;
  weather?: Record<string, WeatherDay>;
}

/**
 * 行程一键导出分享长图：渲染导出专用模板（纯内联样式，不含地图/外部图片，
 * 避免 WebGL 无法截图与跨域污染 canvas），html2canvas 转 PNG 下载。
 */
export default function ExportTripImage({ trip, weather }: Props) {
  const { message } = AntApp.useApp();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const generate = async (): Promise<string | null> => {
    if (!ref.current) return null;
    try {
      const canvas = await html2canvas(ref.current, {
        backgroundColor: "#f5f6fa",
        scale: 2,
      });
      return canvas.toDataURL("image/png");
    } catch {
      return null;
    }
  };

  const handleDownload = async () => {
    setBusy(true);
    const url = await generate();
    setBusy(false);
    if (!url) {
      message.error("生成失败，请重试");
      return;
    }
    const a = document.createElement("a");
    a.href = url;
    a.download = `${trip.title}-行程长图.png`;
    a.click();
    message.success("已生成，若未自动下载请长按预览图保存");
  };

  const days = trip.schedules || [];
  const transportations = trip.transportations || [];
  const accommodations = [...(trip.accommodations || [])].sort((a, b) =>
    (a.checkInDate || "").localeCompare(b.checkInDate || "")
  );
  const members = trip.members || [];

  return (
    <>
      <Button size="small" onClick={() => setOpen(true)}>
        导出长图
      </Button>
      <Modal
        title="导出行程长图"
        open={open}
        onCancel={() => setOpen(false)}
        width={800}
        footer={
          <Space>
            <Button onClick={() => setOpen(false)}>关闭</Button>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              loading={busy}
              onClick={handleDownload}
            >
              下载图片
            </Button>
          </Space>
        }
      >
        <div
          style={{
            maxHeight: "65vh",
            overflow: "auto",
            background: "#f5f6fa",
            padding: 12,
            borderRadius: 8,
          }}
        >
          {/* ===== 导出模板（750 宽，截图区域） ===== */}
          <div
            ref={ref}
            style={{
              width: 750,
              margin: "0 auto",
              background: "#f5f6fa",
              padding: "24px 0",
              fontFamily:
                "-apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif",
            }}
          >
            {/* 头图 */}
            <div
              style={{
                margin: "0 24px",
                borderRadius: 16,
                padding: "28px 24px",
                background: "linear-gradient(135deg, #1677ff 0%, #69b1ff 100%)",
                color: "#fff",
              }}
            >
              <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 10 }}>
                🧳 {trip.title}
              </div>
              <div style={{ fontSize: 15, opacity: 0.95, lineHeight: 1.8 }}>
                {dayjs(trip.startDate).format("YYYY年MM月DD日")} ~{" "}
                {dayjs(trip.endDate).format("MM月DD日")}
                {trip.destination && ` · ${trip.destination}`}
                {" · "}
                {TRIP_STATUS_LABELS[trip.status] || trip.status}
              </div>
              {members.length > 0 && (
                <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap" }}>
                  {members.map((m) => (
                    <span
                      key={m.id}
                      style={{
                        background: "rgba(255,255,255,0.22)",
                        borderRadius: 999,
                        padding: "3px 12px",
                        fontSize: 13,
                        marginRight: 8,
                        marginBottom: 6,
                      }}
                    >
                      {m.user?.nickname || "成员"}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* 主体 */}
            <div
              style={{
                margin: "16px 24px 0",
                borderRadius: 16,
                background: "#fff",
                padding: "20px 24px",
              }}
            >
              {/* 交通概要 */}
              {transportations.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      color: "#374151",
                      marginBottom: 10,
                    }}
                  >
                    🚗 交通安排
                  </div>
                  {transportations.map((t) => (
                    <div
                      key={t.id}
                      style={{
                        fontSize: 14,
                        color: "#4b5563",
                        padding: "5px 0",
                        borderBottom: "1px solid #f3f4f6",
                      }}
                    >
                      {TRANSPORT_ICONS[t.transportType]}{" "}
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
                    </div>
                  ))}
                </div>
              )}

              {/* 每日行程 */}
              {days.map((schedule) => (
                <div key={schedule.id} style={{ marginBottom: 18 }}>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      color: "#374151",
                      marginBottom: 8,
                    }}
                  >
                    第{schedule.dayIndex}天 ·{" "}
                    {dayjs(schedule.date).format("MM月DD日 ddd")}
                    {weather?.[schedule.date] && (
                      <span
                        style={{
                          marginLeft: 8,
                          fontWeight: 400,
                          color: "#6b7280",
                          fontSize: 14,
                        }}
                      >
                        {weather[schedule.date].icon} {weather[schedule.date].tmax}
                        °/{weather[schedule.date].tmin}°
                      </span>
                    )}
                  </div>
                  {schedule.items && schedule.items.length > 0 ? (
                    schedule.items.map((item) => (
                      <div key={item.id}>
                        <div
                          style={{
                            fontSize: 14,
                            color: "#4b5563",
                            padding: "4px 0 4px 14px",
                          }}
                        >
                          {ITEM_TYPE_ICONS[item.type]}{" "}
                          {item.startTime && `${item.startTime.slice(0, 5)} `}
                          {item.title}
                          {item.locationName && ` · 📍${item.locationName}`}
                          {item.cost ? ` · ¥${item.cost}` : ""}
                        </div>
                        {item.transportToNext && (
                          <div
                            style={{
                              fontSize: 12,
                              color: "#9ca3af",
                              padding: "0 0 4px 36px",
                            }}
                          >
                            🚗 到下一站：{item.transportToNext}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: 13, color: "#d1d5db", paddingLeft: 14 }}>
                      暂无安排
                    </div>
                  )}
                </div>
              ))}

              {/* 住宿概要 */}
              {accommodations.length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      color: "#374151",
                      marginBottom: 8,
                    }}
                  >
                    🏨 住宿安排
                  </div>
                  {accommodations.map((a) => (
                    <div
                      key={a.id}
                      style={{
                        fontSize: 14,
                        color: "#4b5563",
                        padding: "5px 0",
                        borderBottom: "1px solid #f3f4f6",
                      }}
                    >
                      {a.name} ·{" "}
                      {dayjs(a.checkInDate).format("MM-DD")} ~{" "}
                      {dayjs(a.checkOutDate).format("MM-DD")}
                      {a.address && ` · 📍${a.address}`}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 页脚 */}
            <div
              style={{
                margin: "16px 24px 0",
                borderRadius: 16,
                background: "#fff",
                padding: "16px 24px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 14, color: "#6b7280" }}>
                邀请码{" "}
                <span
                  style={{
                    fontWeight: 700,
                    color: "#1677ff",
                    letterSpacing: 2,
                    fontSize: 16,
                  }}
                >
                  {trip.inviteCode}
                </span>{" "}
                · 来 TripTogether 一起规划吧
              </div>
              <div style={{ fontSize: 12, color: "#c0c4cc", marginTop: 6 }}>
                生成于 {dayjs().format("YYYY-MM-DD")}
              </div>
            </div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 8 }}>
          提示：长图不含地图路线（浏览器限制无法截取）；手机端可长按预览图保存。
        </div>
      </Modal>
    </>
  );
}
