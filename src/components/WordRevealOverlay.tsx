import { useState, useEffect } from "react";
import { tx } from "@twind/core";

interface Props {
  word: string;
  durationSec?: number;
  onDismiss: () => void;
}

/** 开局「你的词语」浮层：短倒计时后自动消失，点击亦可关闭。 */
export default function WordRevealOverlay({ word, durationSec = 5, onDismiss }: Props) {
  const [left, setLeft] = useState(durationSec);

  useEffect(() => {
    const timeout = window.setTimeout(onDismiss, durationSec * 1000);
    const interval = window.setInterval(() => {
      setLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, [durationSec, onDismiss]);

  return (
    <div
      onClick={onDismiss}
      className={tx(
        "fixed inset-0 z-50 flex items-center justify-center cursor-pointer",
        "bg-semantic-overlay bg-opacity-80",
      )}
    >
      <div
        className={tx(
          "bg-surface-1 border border-hairline rounded-xl px-10 py-8 shadow-card-strong",
          "flex flex-col items-center gap-4 text-center",
        )}
      >
        <p className={tx("text-body-sm text-ink-subtle uppercase tracking-widest")}>你的词语</p>
        <p className={tx("text-display-md font-display font-semibold text-ink tracking-tight")}>
          {word}
        </p>
        <p className={tx("text-caption text-ink-tertiary")}>{left}s 后开始 · 点击关闭</p>
      </div>
    </div>
  );
}
