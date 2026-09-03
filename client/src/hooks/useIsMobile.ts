import { useEffect, useState } from "react";
import { detectMobile } from "../utils/isMobile";

/**
 * 响应式端型 hook：返回当前是否移动端（触控/小屏）
 * 监听窗口尺寸与方向变化，旋转/缩放窗口时自动更新
 */
export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState<boolean>(() => detectMobile());

  useEffect(() => {
    const update = () => setMobile(detectMobile());
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return mobile;
}
