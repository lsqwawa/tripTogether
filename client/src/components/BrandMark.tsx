/**
 * 品牌标识：应用名文案与徽标图标的**单一来源**。
 *
 * 徽标直接引用站点 favicon（`public/favicon.svg`），与浏览器标签页图标同源 ——
 * 日后只要替换 favicon，顶栏与登录页会一起更新，不必再改组件。
 *
 * ⚠️ favicon 画布四周带透明留白：实测 128px 与 512px 两个尺寸下，徽标本体都只占
 * 画布约 75%（单边留白 12.5%）。所以 `size` 表示**徽标可见边长**，组件内部按此反推
 * img 盒子尺寸，否则直接用 size 当 img 宽度会让徽标看起来比预期小一圈。
 */

/** 应用名（中文） */
export const APP_NAME = "畅行";

/** 应用名（英文）—— 作为副标题 */
export const APP_NAME_EN = "TripTogether";

/** 一句话定位，登录页用 */
export const APP_TAGLINE = "和旅伴一起规划下一段旅程";

const MARK_SRC = `${import.meta.env.BASE_URL}favicon.svg`;

/** favicon 画布单边透明留白占比（128px / 512px 实测一致） */
const CANVAS_PADDING = 0.125;

interface BrandMarkProps {
  /** 徽标**可见**边长（px） */
  size?: number;
  className?: string;
}

export default function BrandMark({ size = 30, className }: BrandMarkProps) {
  const box = Math.round(size / (1 - CANVAS_PADDING * 2));
  return (
    <img
      src={MARK_SRC}
      // 徽标旁始终有「畅行」文字，对读屏器重复播报无意义，故作装饰性图片处理
      alt=""
      width={box}
      height={box}
      className={className}
      style={{ display: "block", flexShrink: 0 }}
    />
  );
}
