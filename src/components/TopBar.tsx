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

/** 顶部栏：左房间标题 / 中圆环倒计时+阶段 / 右规则+退出。 */
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
      {/* 左：返回 + 房间标题 */}
      <button
        onClick={onLeave}
        aria-label="返回"
        className={tx(
          "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-body-lg",
          "text-ink-subtle hover:text-ink hover:bg-surface-3 transition-colors",
        )}
      >
        ‹
      </button>
      <div className={tx("flex flex-col gap-1 min-w-0")}>
        <div className={tx("flex items-center gap-2")}>
          <span className={tx("text-caption font-mono text-ink-subtle")}>房间 {roomCode}</span>
          <span className={tx("text-body-sm font-semibold text-ink")}>谁是卧底</span>
        </div>
        <div className={tx("flex items-center gap-1.5")}>
          <span
            className={tx(
              "text-caption text-ink-subtle bg-surface-3 border border-hairline rounded px-1.5 py-0.5",
            )}
          >
            {minPlayers}-{maxPlayers} 人局
          </span>
          <span className={tx("text-caption text-ink-tertiary")}>
            第 {round} 轮 / {phaseLabel}
          </span>
        </div>
      </div>

      {/* 中：圆环倒计时 + 阶段 */}
      <div className={tx("flex-1 flex items-center justify-center gap-3")}>
        <CircleTimer deadline={deadline} phase={phase} />
        <div className={tx("flex flex-col")}>
          <span className={tx("text-body-sm font-medium text-ink")}>{phaseLabel}</span>
          <span className={tx("text-caption text-ink-subtle")}>第 {round} 轮</span>
        </div>
      </div>

      {/* 右：规则 + 退出 */}
      <button
        onClick={onShowRules}
        className={tx(
          "flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg shrink-0",
          "text-ink-subtle hover:text-ink hover:bg-surface-3 transition-colors",
        )}
      >
        <span className={tx("text-body")}>📖</span>
        <span className={tx("text-caption")}>规则</span>
      </button>
      <button
        onClick={onLeave}
        className={tx(
          "flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg shrink-0",
          "text-semantic-error hover:bg-surface-3 transition-colors",
        )}
      >
        <span className={tx("text-body")}>🚪</span>
        <span className={tx("text-caption")}>退出房间</span>
      </button>
    </div>
  );
}
