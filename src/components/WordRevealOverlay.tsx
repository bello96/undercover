import { useState, useEffect } from "react";
import { tx } from "@twind/core";

interface Props {
  word: string;
  durationSec?: number;
  onDismiss: () => void;
}

/** 开局「你的词语」浮层：戏剧性入场，短倒计时后自动消失，点击亦可关闭。 */
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
        "bg-semantic-overlay bg-opacity-80 animate-[uc-overlay-in_200ms_ease-out]",
      )}
    >
      <div
        className={tx(
          "bg-surface-1 border border-hairline rounded-2xl px-12 py-10 shadow-card-strong",
          "flex flex-col items-center gap-4 text-center animate-[uc-rise_450ms_ease-out]",
        )}
      >
        <p className={tx("text-caption text-ink-subtle uppercase tracking-[0.2em]")}>你的词语</p>
        <p
          className={tx(
            "text-display-md font-display font-semibold text-primary tracking-tight",
            "animate-[uc-pop_500ms_ease-out]",
          )}
        >
          {word}
        </p>
        <p className={tx("text-body-sm text-ink-muted")}>记住它，用一句话描述但别说破</p>
        <p className={tx("text-caption text-ink-tertiary")}>{left}s 后进入描述 · 点击关闭</p>
      </div>
    </div>
  );
}
