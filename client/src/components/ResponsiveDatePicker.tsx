import type { CSSProperties } from "react";
import { DatePicker as AntDatePicker } from "antd";
import { DatePicker as MobileDatePicker } from "antd-mobile";
import dayjs, { type Dayjs } from "dayjs";
import { useIsMobile } from "../hooks/useIsMobile";

interface Props {
  value?: Dayjs | null;
  onChange?: (date: Dayjs | null) => void;
  /** 是否精确到分钟（日期+时间） */
  showTime?: boolean;
  format?: string;
  style?: CSSProperties;
  placeholder?: string;
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
 * 自适应日期选择器
 * - PC：Ant Design DatePicker（下拉面板，inputReadOnly 禁键盘）
 * - 移动端/触控/平板：antd-mobile DatePicker（底部弹起滚轮）
 */
export default function ResponsiveDatePicker({
  value,
  onChange,
  showTime,
  format = showTime ? "YYYY-MM-DD HH:mm" : "YYYY-MM-DD",
  style,
  placeholder = "请选择日期",
  disabled,
}: Props) {
  const isMobile = useIsMobile();

  if (!isMobile) {
    return (
      <AntDatePicker
        value={value}
        onChange={onChange}
        showTime={showTime}
        format={format}
        style={style}
        placeholder={placeholder}
        disabled={disabled}
        inputReadOnly
      />
    );
  }

  const precision = showTime ? "minute" : "day";
  return (
    <MobileDatePicker
      value={value ? value.toDate() : null}
      onConfirm={(d) => onChange?.(d ? dayjs(d) : null)}
      precision={precision}
    >
      {(_val, actions) => (
        <div
          onClick={() => !disabled && actions.open()}
          style={{
            ...triggerStyle,
            ...style,
            color: value ? "rgba(0,0,0,0.88)" : "rgba(0,0,0,0.25)",
            opacity: disabled ? 0.6 : 1,
            pointerEvents: disabled ? "none" : "auto",
          }}
        >
          {value ? value.format(format) : placeholder}
        </div>
      )}
    </MobileDatePicker>
  );
}
