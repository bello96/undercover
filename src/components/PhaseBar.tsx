import { useState, useEffect } from "react";
import { tx } from "@twind/core";
import type { GamePhase } from "../types/protocol";

interface Props {
  roomCode: string;
  round: number;
  phase: GamePhase;
  deadline?: number;
  aliveCount: number;
  totalCount: number;
  onLeave: () => void;
}

const PHASE_LABEL: Record<string, string> = {
  describing: "描述阶段",
  voting: "投票阶段",
  reveal: "公布阶段",
};

/** 顶部状态条：房号 / 轮次·阶段 / 倒计时 / 人数·卧底数 / 离开。 */
export default function PhaseBar({
  roomCode,
  round,
  phase,
  deadline,
  aliveCount,
  totalCount,
  onLeave,
}: Props) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!deadline) {
      setSecondsLeft(null);
      return;
    }
    const update = () => setSecondsLeft(Math.max(0, Math.round((deadline - Date.now()) / 1000)));
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [deadline]);

  const showTimer = secondsLeft !== null && (phase === "describing" || phase === "voting");

  return (
    <div
      className={tx(
        "flex items-center gap-3 flex-wrap bg-surface-1 border border-hairline rounded-lg px-4 py-2.5",
      )}
    >
      <span className={tx("text-body-sm font-mono text-ink-muted")}>房间 {roomCode}</span>
      <span className={tx("text-body-sm text-ink font-medium")}>
        第 {round} 轮 · {PHASE_LABEL[phase] ?? ""}
      </span>
      {showTimer && (
        <span
          className={tx(
            "text-body-sm font-mono tabular-nums",
            secondsLeft! <= 10 ? "text-semantic-error" : "text-ink-muted",
          )}
        >
          ⏱ {secondsLeft}s
        </span>
      )}
      <span className={tx("text-caption text-ink-subtle")}>
        {aliveCount} 存活 · 共 {totalCount} 人 · 1 卧底
      </span>
      <button
        onClick={onLeave}
        className={tx(
          "ml-auto text-caption text-ink-subtle border border-hairline rounded px-2.5 py-1",
          "hover:text-ink hover:border-hairline-strong transition-colors",
        )}
      >
        离开
      </button>
    </div>
  );
}
