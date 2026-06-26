import { useEffect, useRef } from "react";
import { tx } from "@twind/core";

export type ToastType = "error" | "info" | "success";

interface Props {
  message: string;
  type?: ToastType;
  onClose: () => void;
  duration?: number;
}

const TYPE_STYLES: Record<ToastType, string> = {
  error: "bg-surface-2 border-semantic-error text-semantic-error",
  success: "bg-surface-2 border-semantic-success text-semantic-success",
  info: "bg-surface-2 border-hairline text-ink",
};

const TYPE_ICONS: Record<ToastType, string> = {
  error: "⚠️",
  info: "ℹ️",
  success: "✅",
};

export default function Toast({ message, type = "info", onClose, duration = 3000 }: Props) {
  // onClose 是父组件内联箭头，每次父级 render 换引用。若放进 timer 的 effect 依赖，
  // 频繁重渲染会反复 clearTimeout+重设 → toast 永不消失。改用 ref 始终指向最新 onClose，
  // timer 仅在挂载时设一次（新 toast 靠父级 key 强制 remount 重新计时）。
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    const t = setTimeout(() => onCloseRef.current(), duration);
    return () => clearTimeout(t);
  }, [duration]);

  return (
    <div
      onClick={() => onCloseRef.current()}
      className={tx(
        "fixed top-4 right-4 z-[9999] px-4 py-3 rounded-lg border",
        "text-body-sm font-medium max-w-sm cursor-pointer",
        "flex items-center gap-2",
        "animate-[uc-toast-in_220ms_ease-out]",
        TYPE_STYLES[type],
      )}
    >
      <span>{TYPE_ICONS[type]}</span>
      <span>{message}</span>
    </div>
  );
}
