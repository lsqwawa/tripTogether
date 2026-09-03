import { useState, type CSSProperties } from "react";
import { DatePicker } from "antd";
import { CalendarPicker } from "antd-mobile";
import dayjs, { type Dayjs } from "dayjs";
import { useIsMobile } from "../hooks/useIsMobile";

const { RangePicker: AntRangePicker } = DatePicker;

interface Props {
  value?: [Dayjs | null, Dayjs | null] | null;
  onChange?: (dates: [Dayjs | null, Dayjs | null] | null) => void;
  format?: string;
  style?: CSSProperties;
  /** 禁用日期（如过去日期），两端均生效 */
  disabledDate?: (current: Dayjs) => boolean;
  disabled?: boolean;
}

// 移动端触发区：模拟 antd Input 外观
const triggerStyle: CSSProperties = {
  width: "100%",
  height: 32,
  lineHeight: "30px",
  padding: "0 11px",
  border: "1px solid #d9d9d9",
  borderRadius: 6,
  background: "#fff",
  cursor: "pointer",
  fontSize: 14,
  boxSizing: "border-box",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

/**
 * 自适应日期范围选择器
 * - PC：Ant Design RangePicker（下拉面板，inputReadOnly 禁键盘）
 * - 移动端/触控/平板：antd-mobile CalendarPicker（底部弹起范围日历）
 */
export default function ResponsiveRangePicker({
  value,
  onChange,
  format = "YYYY-MM-DD",
  style,
  disabledDate,
  disabled,
}: Props) {
  const isMobile = useIsMobile();
  const [visible, setVisible] = useState(false);

  if (!isMobile) {
    return (
      <AntRangePicker
        value={value}
        onChange={onChange}
        format={format}
        style={style}
        disabledDate={disabledDate}
        disabled={disabled}
        inputReadOnly
      />
    );
  }

  const start = value?.[0] ?? null;
  const end = value?.[1] ?? null;
  const hasRange = start && end;

  return (
    <>
      <div
        onClick={() => !disabled && setVisible(true)}
        style={{
          ...triggerStyle,
          ...style,
          color: hasRange ? "rgba(0,0,0,0.88)" : "rgba(0,0,0,0.25)",
          opacity: disabled ? 0.6 : 1,
        }}
      >
        {hasRange
          ? `${start.format(format)} ~ ${end.format(format)}`
          : "请选择日期范围"}
      </div>
      <CalendarPicker
        visible={visible}
        onClose={() => setVisible(false)}
        selectionMode="range"
        value={hasRange ? [start.toDate(), end.toDate()] : null}
        shouldDisableDate={
          disabledDate ? (d) => disabledDate(dayjs(d)) : undefined
        }
        onConfirm={(val) => {
          if (val) {
            onChange?.([dayjs(val[0]), dayjs(val[1])]);
          }
          setVisible(false);
        }}
      />
    </>
  );
}
