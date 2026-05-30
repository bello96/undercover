import { useState } from "react";
import { tx } from "@twind/core";
import type { DescribeEntry, GamePhase, PlayerInfo, Role } from "../types/protocol";

// 与服务端 constants.MAX_DESCRIBE_LENGTH 保持一致
const MAX_DESCRIBE_LENGTH = 50;

interface VoteResultSnapshot {
  tally: Record<string, number>;
  eliminatedId: string | null;
  eliminatedRole?: Role;
}

interface Props {
  players: PlayerInfo[];
  myId: string;
  phase: GamePhase;
  descriptions: DescribeEntry[];
  round: number;
  votedPlayerIds: string[];
  tiebreakCandidates: string[];
  voteResult: VoteResultSnapshot | null;
  onSubmitDescribe: (text: string) => void;
  onVote: (targetId: string) => void;
}

/**
 * 玩家卡网格（会玩同款·同时作答）：
 * - describing：每张卡显示该玩家本轮描述；未提交者显示「✏️ 正在输入…」；底部为本人作答输入条。
 * - voting：卡可点投票（存活、非自己、合法目标），已投票者显示徽标。
 * - reveal：出局者卡亮身份（卧底/平民）+ 显示各自票数。
 */
export default function PlayerCards({
  players,
  myId,
  phase,
  descriptions,
  round,
  votedPlayerIds,
  tiebreakCandidates,
  voteResult,
  onSubmitDescribe,
  onVote,
}: Props) {
  const [draft, setDraft] = useState("");

  const roundDescriptions = descriptions.filter((d) => d.round === round);
  const descByPlayer = new Map(roundDescriptions.map((d) => [d.playerId, d.text]));

  const me = players.find((p) => p.id === myId);
  const iAmAlive = me?.alive ?? false;
  const aliveCount = players.filter((p) => p.alive).length;
  const iHaveSubmitted = descByPlayer.has(myId);
  const iHaveVoted = votedPlayerIds.includes(myId);
  const isTiebreak = tiebreakCandidates.length > 0;

  const submittedAlive = players.filter((p) => p.alive && descByPlayer.has(p.id)).length;
  const votedAlive = players.filter((p) => p.alive && votedPlayerIds.includes(p.id)).length;

  const canVoteTarget = (t: PlayerInfo): boolean => {
    return (
      phase === "voting" &&
      iAmAlive &&
      !iHaveVoted &&
      t.alive &&
      t.id !== myId &&
      (!isTiebreak || tiebreakCandidates.includes(t.id))
    );
  };

  const handleSubmitDraft = () => {
    const text = draft.trim();
    if (!text) {
      return;
    }
    onSubmitDescribe(text);
    setDraft("");
  };

  return (
    <div className={tx("flex flex-col gap-3")}>
      {/* 状态行 */}
      <div className={tx("flex items-center justify-between flex-wrap gap-2")}>
        <p className={tx("text-body-sm text-ink-subtle font-medium")}>
          玩家（{aliveCount} 存活）
        </p>
        {phase === "describing" && (
          <span className={tx("text-caption text-ink-tertiary")}>
            已作答 {submittedAlive} / {aliveCount}
          </span>
        )}
        {phase === "voting" && (
          <span className={tx("text-caption text-ink-tertiary")}>
            已投票 {votedAlive} / {aliveCount}
          </span>
        )}
      </div>

      {/* 加赛提示 */}
      {phase === "voting" && isTiebreak && (
        <div
          className={tx(
            "bg-surface-2 border border-hairline-strong rounded-lg px-3 py-2",
            "text-caption text-ink-muted text-center",
          )}
        >
          ⚖️ 平票，请在高亮候选人中重新投票
        </div>
      )}

      {/* 玩家卡网格 */}
      <div className={tx("grid grid-cols-1 sm:grid-cols-2 gap-2.5")}>
        {players.map((p) => {
          const isMe = p.id === myId;
          const text = descByPlayer.get(p.id);
          const clickable = canVoteTarget(p);
          const voted = votedPlayerIds.includes(p.id);
          const isEliminatedReveal = phase === "reveal" && voteResult?.eliminatedId === p.id;
          const revealUndercover = isEliminatedReveal && voteResult?.eliminatedRole === "undercover";
          const tallyCount = phase === "reveal" ? voteResult?.tally[p.id] : undefined;
          const isCandidate = isTiebreak && tiebreakCandidates.includes(p.id);

          return (
            <div
              key={p.id}
              onClick={clickable ? () => onVote(p.id) : undefined}
              className={tx(
                "rounded-lg border p-3 flex flex-col gap-2 transition-colors",
                !p.alive && "opacity-50",
                isEliminatedReveal
                  ? revealUndercover
                    ? "bg-surface-2 border-semantic-error"
                    : "bg-surface-2 border-primary"
                  : "bg-surface-2 border-hairline",
                clickable && "cursor-pointer hover:border-primary hover:bg-surface-3",
                phase === "voting" && isCandidate && !isEliminatedReveal && "border-hairline-strong",
              )}
            >
              {/* 头像 + 名字 + 徽标 */}
              <div className={tx("flex items-center gap-2")}>
                <span
                  className={tx(
                    "w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-caption font-medium",
                    revealUndercover
                      ? "bg-semantic-error text-on-primary"
                      : "bg-surface-3 border border-hairline-strong text-ink-subtle",
                  )}
                >
                  {p.name.slice(0, 1).toUpperCase()}
                </span>
                <span
                  className={tx(
                    "text-body-sm flex-1 truncate",
                    p.alive ? "text-ink" : "text-ink-tertiary",
                  )}
                >
                  {p.name}
                </span>
                <div className={tx("flex items-center gap-1 shrink-0")}>
                  {isMe && (
                    <span className={tx("text-caption text-ink-subtle bg-surface-3 border border-hairline rounded px-1 py-0.5")}>
                      我
                    </span>
                  )}
                  {p.isHost && (
                    <span className={tx("text-caption text-primary bg-surface-3 border border-hairline rounded px-1 py-0.5")}>
                      房主
                    </span>
                  )}
                  {phase === "voting" && voted && (
                    <span className={tx("text-caption text-semantic-success bg-surface-3 border border-hairline rounded px-1 py-0.5")}>
                      已投票
                    </span>
                  )}
                  {typeof tallyCount === "number" && tallyCount > 0 && (
                    <span className={tx("text-caption text-ink-muted bg-surface-3 border border-hairline rounded px-1 py-0.5")}>
                      {tallyCount} 票
                    </span>
                  )}
                </div>
              </div>

              {/* 描述气泡 */}
              <div
                className={tx(
                  "rounded-md px-2.5 py-1.5 text-body-sm min-h-[2rem] flex items-center break-words",
                  text ? "bg-surface-1 text-ink" : "bg-surface-1 text-ink-tertiary italic",
                )}
              >
                {text
                  ? text
                  : !p.alive
                    ? "（已出局）"
                    : phase === "describing"
                      ? "✏️ 正在输入…"
                      : "（未描述）"}
              </div>

              {/* reveal 身份揭晓 */}
              {isEliminatedReveal && voteResult?.eliminatedRole && (
                <span
                  className={tx(
                    "text-caption font-medium text-center rounded px-2 py-0.5 border",
                    revealUndercover
                      ? "text-semantic-error border-semantic-error bg-surface-1"
                      : "text-ink-muted border-hairline bg-surface-1",
                  )}
                >
                  TA 是【{revealUndercover ? "卧底" : "平民"}】
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* 底部操作区：描述输入 / 投票提示 */}
      {phase === "describing" && (
        <div className={tx("bg-surface-1 border border-hairline rounded-lg p-3")}>
          {!iAmAlive ? (
            <p className={tx("text-body-sm text-ink-subtle text-center")}>你已出局，观战中</p>
          ) : iHaveSubmitted ? (
            <p className={tx("text-body-sm text-ink-muted text-center")}>
              ✅ 已提交，等待其他人作答…（{submittedAlive} / {aliveCount}）
            </p>
          ) : (
            <div className={tx("flex flex-col gap-1.5")}>
              <p className={tx("text-body-sm text-primary font-medium")}>
                用一句话描述你的词（不能直说词本身）
              </p>
              <div className={tx("flex gap-2")}>
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                      handleSubmitDraft();
                    }
                  }}
                  maxLength={MAX_DESCRIBE_LENGTH}
                  placeholder="最多 50 字…"
                  autoFocus
                  className={tx(
                    "flex-1 px-3 py-2 rounded-md text-body-sm bg-surface-2 border border-hairline text-ink",
                    "placeholder:text-ink-tertiary focus:outline-none focus:border-primary transition-colors",
                  )}
                />
                <button
                  onClick={handleSubmitDraft}
                  disabled={!draft.trim()}
                  className={tx(
                    "px-4 py-2 rounded-md text-button font-medium transition-colors shrink-0",
                    draft.trim()
                      ? "bg-primary text-on-primary hover:bg-primary-hover"
                      : "bg-surface-3 text-ink-subtle border border-hairline cursor-not-allowed",
                  )}
                >
                  提交
                </button>
              </div>
              <p className={tx("text-caption text-ink-tertiary text-right")}>
                {draft.length} / {MAX_DESCRIBE_LENGTH}
              </p>
            </div>
          )}
        </div>
      )}

      {phase === "voting" && (
        <div className={tx("bg-surface-1 border border-hairline rounded-lg p-3 text-center")}>
          {!iAmAlive ? (
            <p className={tx("text-body-sm text-ink-subtle")}>你已出局，无法投票（观战中）</p>
          ) : iHaveVoted ? (
            <p className={tx("text-body-sm text-ink-muted")}>
              ✅ 已投票，等待其他人…（{votedAlive} / {aliveCount}）
            </p>
          ) : (
            <p className={tx("text-body-sm text-primary font-medium")}>
              点击上方头像，投出你认为的卧底（不能投自己）
            </p>
          )}
        </div>
      )}
    </div>
  );
}
