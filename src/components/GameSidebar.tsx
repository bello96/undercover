import { tx } from "@twind/core";
import type { GamePhase } from "../types/protocol";

interface Props {
  word?: string;
  eliminated: boolean;
  playerCount: number;
  maxPlayers: number;
  round: number;
  phase: GamePhase;
}

const PHASE_LABEL: Record<string, string> = {
  describing: "描述阶段",
  voting: "投票阶段",
  reveal: "公示结果",
  ended: "游戏结束",
  lobby: "等待开始",
};

/** 左侧信息栏：本轮词语（仅本人词，绝不显示卧底词）+ 游戏信息。 */
export default function GameSidebar({
  word,
  eliminated,
  playerCount,
  maxPlayers,
  round,
  phase,
}: Props) {
  return (
    <div className={tx("flex flex-col gap-3")}>
      {/* 本轮词语 */}
      <div className={tx("bg-surface-1 border border-hairline rounded-xl p-4 flex flex-col gap-3")}>
        <div className={tx("flex items-center gap-1.5")}>
          <span className={tx("text-body-sm font-medium text-ink-muted")}>本轮词语</span>
          <span
            className={tx("text-caption text-ink-tertiary")}
            title="只有你能看到自己的词，卧底词在结算时才揭晓"
          >
            ⓘ
          </span>
        </div>
        <div
          className={tx(
            "bg-surface-2 border border-hairline rounded-lg px-4 py-6 flex flex-col items-center gap-1.5",
          )}
        >
          {eliminated ? (
            <>
              <span className={tx("text-caption text-ink-subtle")}>你的状态</span>
              <span className={tx("text-subhead font-display font-semibold text-ink-muted")}>
                已出局 · 观战中
              </span>
            </>
          ) : (
            <>
              <span className={tx("text-caption text-ink-subtle")}>你的词</span>
              {word ? (
                <span
                  className={tx("text-headline font-display font-semibold text-primary tracking-tight")}
                >
                  {word}
                </span>
              ) : (
                <span className={tx("text-subhead text-ink-subtle")}>加载中…</span>
              )}
            </>
          )}
        </div>
      </div>

      {/* 游戏信息 */}
      <div className={tx("bg-surface-1 border border-hairline rounded-xl p-4 flex flex-col gap-3")}>
        <span className={tx("text-body-sm font-medium text-ink-muted")}>游戏信息</span>
        <dl className={tx("flex flex-col gap-2.5")}>
          <Row label="玩家人数" value={`${playerCount} / ${maxPlayers}`} />
          <Row label="卧底人数" value="1" />
          <Row label="当前轮次" value={`第 ${round} 轮`} />
          <Row label="游戏阶段" value={PHASE_LABEL[phase] ?? "—"} />
        </dl>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className={tx("flex items-center justify-between")}>
      <dt className={tx("text-body-sm text-ink-subtle")}>{label}</dt>
      <dd className={tx("text-body-sm text-ink font-medium")}>{value}</dd>
    </div>
  );
}
