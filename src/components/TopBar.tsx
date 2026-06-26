import { tx } from "@twind/core";
import type { GamePhase } from "../types/protocol";
import CircleTimer from "./CircleTimer";

interface Props {
  roomCode: string;
  round: number;
  phase: GamePhase;
  deadline?: number;
  minPlayers: number;
  maxPlayers: number;
  onLeave: () => void;
  onShowRules: () => void;
}

const PHASE_LABEL: Record<string, string> = {
  describing: "描述阶段",
  voting: "投票阶段",
  reveal: "公示结果",
  ended: "游戏结束",
  lobby: "等待开始",
};

/** 顶部栏：左品牌+房间 / 中圆环倒计时+阶段 / 右规则+退出。 */
export default function TopBar({
  roomCode,
  round,
  phase,
  deadline,
  minPlayers,
  maxPlayers,
  onLeave,
  onShowRules,
}: Props) {
  const phaseLabel = PHASE_LABEL[phase] ?? "";

  return (
    <div
      className={tx(
        "flex items-center gap-3 px-4 py-2.5 border-b border-hairline bg-surface-1 shrink-0",
      )}
    >
      {/* 左：品牌 + 房间 */}
      <div className={tx("flex items-center gap-2.5 min-w-0")}>
        <div
          className={tx(
            "w-9 h-9 rounded-lg bg-primary flex items-center justify-center text-body-lg shrink-0",
          )}
        >
          🕵️
        </div>
        <div className={tx("flex flex-col gap-0.5 min-w-0")}>
          <span className={tx("text-body-sm font-semibold text-ink leading-none")}>谁是卧底</span>
          <div className={tx("flex items-center gap-1.5")}>
            <span className={tx("text-caption font-mono text-ink-subtle")}>房间 {roomCode}</span>
            <span
              className={tx(
                "text-[10px] text-ink-tertiary bg-surface-3 border border-hairline rounded px-1 py-0.5",
              )}
            >
              {minPlayers}-{maxPlayers}人
            </span>
          </div>
        </div>
      </div>

      {/* 中：圆环倒计时 + 阶段 */}
      <div className={tx("flex-1 flex items-center justify-center gap-3")}>
        <CircleTimer deadline={deadline} phase={phase} />
        <div className={tx("flex flex-col")}>
          <span className={tx("text-body-sm font-medium text-ink")}>{phaseLabel}</span>
          <span className={tx("text-caption text-ink-subtle tabular-nums")}>第 {round} 轮</span>
        </div>
      </div>

      {/* 右：规则 + 退出 */}
      <button
        onClick={onShowRules}
        className={tx(
          "flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg shrink-0 transition-all active:scale-95",
          "text-ink-subtle hover:text-ink hover:bg-surface-3",
        )}
      >
        <span className={tx("text-body")}>📖</span>
        <span className={tx("text-caption")}>规则</span>
      </button>
      <button
        onClick={onLeave}
        className={tx(
          "flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg shrink-0 transition-all active:scale-95",
          "text-semantic-error hover:bg-surface-3",
        )}
      >
        <span className={tx("text-body")}>🚪</span>
        <span className={tx("text-caption")}>退出</span>
      </button>
    </div>
  );
}
