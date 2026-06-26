import type { CSSProperties, ReactNode } from "react";
import { tx } from "@twind/core";

interface Props {
  name: string;
  color: string;
  /** 直径（px），默认 44。字号按比例缩放。 */
  size?: number;
  /** 外描边颜色（boxShadow 实现，不占布局）。 */
  ringColor?: string;
  ringWidth?: number;
  /** 出局/未激活：降透明 + 去饱和。 */
  dimmed?: boolean;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  title?: string;
  /** 角标（座位号、皇冠、✓ 等），由调用方绝对定位。 */
  children?: ReactNode;
}

/**
 * 通用彩色头像：纯色圆底 + 首字母（白字）。
 * 全游戏统一用它，配合 playerColor 让每位玩家有稳定专属色。
 */
export default function Avatar({
  name,
  color,
  size = 44,
  ringColor,
  ringWidth = 2,
  dimmed = false,
  className,
  style,
  onClick,
  title,
  children,
}: Props) {
  const initial = name.trim().slice(0, 1).toUpperCase() || "?";

  return (
    <div
      onClick={onClick}
      title={title}
      className={tx(
        "relative rounded-full flex items-center justify-center shrink-0",
        "font-display font-semibold text-on-primary select-none",
        "transition-transform duration-200",
        onClick && "cursor-pointer hover:scale-105 active:scale-95",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
        background: color,
        boxShadow: ringColor ? `0 0 0 ${ringWidth}px ${ringColor}` : undefined,
        opacity: dimmed ? 0.45 : 1,
        filter: dimmed ? "grayscale(0.8)" : undefined,
        ...style,
      }}
    >
      {initial}
      {children}
    </div>
  );
}
