import { useState, useEffect } from "react";
import { tx } from "@twind/core";
import type { GamePhase } from "../types/protocol";

// 各阶段总时长（秒），与 worker/src/constants.ts 的 DESCRIBE_MS/VOTE_MS/REVEAL_MS 对应。
const PHASE_TOTAL_SEC: Partial<Record<GamePhase, number>> = {
  describing: 45,
  voting: 30,
  reveal: 5,
};

const GOLD = "#c0871c"; // 倒计时金：亮底加深以保证可读
const RED = "#d92d20"; // 最后 10s 转红（亮底友好红）
const TRACK = "#e6e9ed"; // 轨道：亮色模式浅灰

/** 顶部圆环倒计时：金色环 + 中央剩余秒数，最后 10s 转红并呼吸；无倒计时阶段显示静态环。 */
export default function CircleTimer({ deadline, phase }: { deadline?: number; phase: GamePhase }) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!deadline) {
      setSecondsLeft(null);
      return;
    }
    const update = () => setSecondsLeft(Math.max(0, Math.round((deadline - Date.now()) / 1000)));
    update();
    const interval = window.setInterval(update, 250);
    return () => window.clearInterval(interval);
  }, [deadline]);

  const totalSec = PHASE_TOTAL_SEC[phase] ?? null;
  const active = secondsLeft !== null && totalSec !== null;
  const fraction = active ? Math.min(1, Math.max(0, secondsLeft! / totalSec!)) : 0;
  const low = active && secondsLeft! <= 10;
  const color = low ? RED : GOLD;

  const r = 45;
  const circumference = 2 * Math.PI * r;
  const dashoffset = circumference * (1 - fraction);

  return (
    <div
      className={tx(
        "relative w-[64px] h-[64px] shrink-0",
        low && "animate-[uc-breathe_1s_ease-in-out_infinite]",
      )}
    >
      <svg
        viewBox="0 0 100 100"
        className={tx("w-full h-full")}
        style={{ transform: "rotate(-90deg)" }}
      >
        <circle cx="50" cy="50" r={r} fill="none" stroke={TRACK} strokeWidth="6" />
        {active && (
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashoffset}
            style={{ transition: "stroke-dashoffset 0.25s linear, stroke 0.3s linear" }}
          />
        )}
      </svg>
      <div className={tx("absolute inset-0 flex items-center justify-center")}>
        {active ? (
          <span
            className={tx("font-mono font-semibold tabular-nums text-subhead")}
            style={{ color }}
          >
            {secondsLeft}
            <span className={tx("text-caption")}>s</span>
          </span>
        ) : (
          <span className={tx("text-ink-tertiary text-body-sm")}>—</span>
        )}
      </div>
    </div>
  );
}
