import { Button, Spin, Tag } from "antd";
import type { TransportLookupState } from "./useTransportLookup";

interface TransportLookupPreviewProps {
  lookup: TransportLookupState | null;
  loading: boolean;
  error: string | null;
  onBackfill: () => void;
}

/** 班次查询结果卡片：显示航班/车次信息，支持回填到表单 */
export default function TransportLookupPreview({
  lookup,
  loading,
  error,
  onBackfill,
}: TransportLookupPreviewProps) {
  return (
    <>
      {loading && (
        <div style={{ color: "#999", fontSize: 13, marginBottom: 8 }}>
          <Spin size="small" /> 查询中…
        </div>
      )}
      {error && (
        <div style={{ color: "#e53e3e", fontSize: 12, marginBottom: 8 }}>{error}</div>
      )}
      {lookup && (
        <div
          style={{
            background: "#f7f8fa",
            borderRadius: 8,
            padding: 12,
            marginBottom: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <span style={{ fontWeight: 600 }}>
              {lookup.type === "flight" ? "✈️ 航班信息" : "🚄 车次信息"}{" "}
              {lookup.data.flightNumber || lookup.data.trainNumber}
            </span>
            {lookup.source === "mock" && <Tag color="orange">演示数据</Tag>}
            {lookup.source === "12306" && <Tag color="green">12306</Tag>}
          </div>
          {lookup.type === "flight" ? (
            <div style={{ fontSize: 13, lineHeight: 1.9 }}>
              {lookup.data.airline && <div>航司：{lookup.data.airline}</div>}
              <div>
                出发：{lookup.data.departure?.airport}（{lookup.data.departure?.iata}）
                {lookup.data.departure?.terminal ? ` T${lookup.data.departure.terminal}` : ""}
                {lookup.data.departure?.gate ? ` · 登机口 ${lookup.data.departure.gate}` : ""}
              </div>
              <div>到达：{lookup.data.arrival?.airport}（{lookup.data.arrival?.iata}）</div>
              {lookup.data.status && <div>状态：{lookup.data.status}</div>}
            </div>
          ) : (
            <div style={{ fontSize: 13, lineHeight: 1.9 }}>
              <div>
                {lookup.data.fromStation} → {lookup.data.toStation}
              </div>
              <div>日期：{lookup.data.date} · 停靠 {lookup.data.stopCount} 站</div>
              {lookup.data.timetable?.length > 0 && (
                <div>
                  经停：
                  {lookup.data.timetable.slice(0, 3).map((s: any) => s.station).join(" / ")}
                  {lookup.data.timetable.length > 3 ? " …" : ""}
                </div>
              )}
            </div>
          )}
          <Button
            size="small"
            type="link"
            onClick={onBackfill}
            style={{ paddingLeft: 0, marginTop: 4 }}
          >
            回填到表单
          </Button>
        </div>
      )}
    </>
  );
}
