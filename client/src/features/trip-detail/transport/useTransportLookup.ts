import { useEffect, useState } from "react";
import { transportLookupApi } from "../../../api";
import { getErrorMessage } from "../../../utils/error";

export interface TransportLookupState {
  type: "flight" | "train";
  data: any;
  source: string;
}

/** 监听「交通方式 + 预订信息」，命中正则即防抖查询班次 */
export function useTransportLookup(transportType: string | undefined, bookingInfo: string | undefined) {
  const [lookup, setLookup] = useState<TransportLookupState | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const resetLookup = () => {
    setLookup(null);
    setLookupError(null);
    setLookupLoading(false);
  };

  useEffect(() => {
    const code = (bookingInfo || "").trim();
    const type = transportType;
    if ((type === "flight" || type === "train") && code) {
      const re = type === "flight" ? /^[A-Za-z]{2}\d{1,4}$/ : /^[GCDZKTL]\d{1,4}$/i;
      if (!re.test(code)) {
        resetLookup();
        return;
      }
      setLookupLoading(true);
      setLookupError(null);
      const timer = setTimeout(async () => {
        try {
          const res = await transportLookupApi.get(type, code);
          setLookup({ type, data: res.data, source: res.source });
        } catch (e) {
          setLookup(null);
          setLookupError(getErrorMessage(e, (e as Error)?.message || "查询失败，请稍后重试"));
        } finally {
          setLookupLoading(false);
        }
      }, 500);
      return () => {
        clearTimeout(timer);
        setLookupLoading(false);
      };
    }
    resetLookup();
  }, [transportType, bookingInfo]);

  return { lookup, lookupLoading, lookupError, resetLookup };
}
