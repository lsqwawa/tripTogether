/**
 * 端型判断：是否按移动端（触控/小屏）交互渲染
 * 覆盖边界：
 * - 手机/平板 UA（iPhone / iPad / Android / HarmonyOS / tablet 等）
 * - Windows 触屏小屏设备（如 Surface）→ 同移动端
 * - 明确桌面设备（Windows/Mac/Linux 非触屏或大屏）→ PC 端
 * - 小屏（视口宽 <= 768px）→ 桌面浏览器缩窄窗口时的响应式降级
 *
 * 注意：优先排除明确桌面设备，避免触屏 PC（带触摸屏的笔记本）
 * 被 maxTouchPoints / pointer:coarse 误判为移动端。
 */
export function detectMobile(): boolean {
  if (typeof window === "undefined") return false;

  const ua = navigator.userAgent.toLowerCase();

  // 1. 明确移动设备（手机）
  const isMobile =
    /iphone|ipod|android.*mobile|mobile|blackberry|windows phone/i.test(ua);
  if (isMobile) return true;

  // 2. 平板（含 iPad、Android 平板）
  const isTablet = /ipad|tablet|android(?!.*mobile)/i.test(ua);
  if (isTablet) return true;

  // 3. 触控 + 小屏检测
  const hasTouch =
    (navigator.maxTouchPoints ?? 0) > 0 || "ontouchstart" in window;
  const isCoarse =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;
  const isSmallScreen = window.innerWidth <= 768;

  // 4. Windows 触屏小屏设备（如 Surface）→ 移动端
  if (/windows nt/i.test(ua) && hasTouch && isSmallScreen) return true;

  // 5. 明确桌面设备 → 优先排除
  if (/windows nt|linux x86_64|ubuntu|fedora|debian/i.test(ua)) {
    return false;
  }
  // Mac 特殊处理：iPadOS 13+ Safari UA 伪装 Mac（不含 ipad 关键词），
  // 用触控特征区分——iPad 有触控，真实 Mac 无触控
  if (/macintosh/i.test(ua)) {
    return hasTouch;
  }

  // 6. 其余情况：触屏+小屏 或 粗指针+小屏 → 移动端
  if ((hasTouch || isCoarse) && isSmallScreen) return true;

  return false;
}
