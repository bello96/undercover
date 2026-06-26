import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { tx } from "@twind/core";
import type { DescribeEntry, GamePhase, PlayerInfo, Role } from "../types/protocol";
import PlayerRing from "./PlayerRing";
import PhaseStepper from "./PhaseStepper";

// 与服务端 constants.MAX_DESCRIBE_LENGTH 保持一致
const MAX_DESCRIBE_LENGTH = 50;

const BOX =
  "bg-surface-1 border border-hairline rounded-xl shadow-card px-5 py-4 flex flex-col items-center gap-2 text-center";

interface VoteResultSnapshot {
  tally: Record<string, number>;
  eliminatedId: string | null;
  eliminatedRole?: Role;
}

interface Props {
  players: PlayerInfo[];
  myId: string;
  hostId: string;
  phase: GamePhase; // describing | voting | reveal
  descriptions: DescribeEntry[];
  round: number;
  votedPlayerIds: string[];
  tiebreakCandidates: string[];
  voteResult: VoteResultSnapshot | null;
  connected: boolean;
  onSubmitDescribe: (text: string) => void;
  onVote: (targetId: string) => void;
}

/** 游戏中（描述/投票/公示）中心视图：牌桌 + 圆心阶段内容 + 底部阶段条。 */
export default function GameView({
  players,
  myId,
  hostId,
  phase,
  descriptions,
  round,
  votedPlayerIds,
  tiebreakCandidates,
  voteResult,
  connected,
  onSubmitDescribe,
  onVote,
}: Props) {
  const [draft, setDraft] = useState("");
  const [myVoteTarget, setMyVoteTarget] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);

  // 轮次/阶段变化清空本地乐观态
  useEffect(() => {
    setDraft("");
    setMyVoteTarget(null);
    setJustSubmitted(false);
  }, [round, phase]);

  const me = players.find((p) => p.id === myId);
  const iAmAlive = me?.alive ?? false;
  const aliveCount = players.filter((p) => p.alive).length;
  const votedSet = new Set(votedPlayerIds);
  const descByPlayer = new Map(
    descriptions.filter((d) => d.round === round).map((d) => [d.playerId, d.text]),
  );
  const isTiebreak = tiebreakCandidates.length > 0;
  const tiebreakSet = new Set(tiebreakCandidates);

  const iHaveSubmitted = descByPlayer.has(myId) || justSubmitted;
  const iHaveVoted = votedSet.has(myId) || myVoteTarget !== null;
  const submittedAlive = players.filter(
    (p) => p.alive && (descByPlayer.has(p.id) || (p.id === myId && justSubmitted)),
  ).length;
  const votedAlive = players.filter(
    (p) => p.alive && (votedSet.has(p.id) || (p.id === myId && myVoteTarget !== null)),
  ).length;

  // 可投集合（允许改票：不排除已投自己）
  const votableIds = new Set<string>();
  if (phase === "voting" && connected && iAmAlive) {
    for (const p of players) {
      if (p.alive && p.id !== myId && (!isTiebreak || tiebreakSet.has(p.id))) {
        votableIds.add(p.id);
      }
    }
  }

  const handleVote = (id: string) => {
    if (!connected) {
      return;
    }
    setMyVoteTarget(id);
    onVote(id);
  };
  const handleSubmit = () => {
    const t = draft.trim();
    if (!t || !connected) {
      return;
    }
    setJustSubmitted(true);
    onSubmitDescribe(t);
    setDraft("");
  };

  const labelOf = (id: string | null | undefined): string => {
    if (!id) {
      return "";
    }
    const idx = players.findIndex((p) => p.id === id);
    return idx >= 0 ? `${idx + 1}号 ${players[idx].name}` : "";
  };
  const targetLabel = labelOf(myVoteTarget);
  const elimLabel = labelOf(voteResult?.eliminatedId);

  let center: ReactNode = null;
  if (phase === "describing") {
    center = (
      <div className={tx(BOX)}>
        {!iAmAlive ? (
          <span className={tx("text-body-sm text-ink-subtle")}>你已出局，观战中</span>
        ) : iHaveSubmitted ? (
          <>
            <span
              className={tx(
                "text-body-sm text-semantic-success font-medium animate-[uc-pop_300ms_ease-out]",
              )}
            >
              ✅ 已提交描述
            </span>
            <span className={tx("text-caption text-ink-subtle")}>
              等待其他人作答…（{submittedAlive}/{aliveCount}）
            </span>
          </>
        ) : (
          <>
            <span className={tx("text-body font-medium text-ink")}>用一句话描述你的词</span>
            <span className={tx("text-caption text-ink-subtle")}>（不能直接说出词语本身）</span>
            <div className={tx("w-full relative mt-1")}>
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                    handleSubmit();
                  }
                }}
                maxLength={MAX_DESCRIBE_LENGTH}
                placeholder={connected ? "请输入描述…" : "重连中…"}
                autoFocus
                disabled={!connected}
                className={tx(
                  "w-full px-3 py-2.5 pr-12 rounded-lg text-body-sm bg-surface-2 border border-hairline",
                  "text-ink placeholder:text-ink-tertiary outline-none transition-shadow transition-colors",
                  "focus:border-primary-focus focus:shadow-focus disabled:opacity-50",
                )}
              />
              <span
                className={tx(
                  "absolute right-3 top-1/2 -translate-y-1/2 text-caption text-ink-tertiary tabular-nums",
                )}
              >
                {draft.length}/{MAX_DESCRIBE_LENGTH}
              </span>
            </div>
            <button
              onClick={handleSubmit}
              disabled={!draft.trim() || !connected}
              className={tx(
                "w-full px-4 py-2.5 rounded-lg text-button font-medium transition-all",
                draft.trim() && connected
                  ? "bg-primary text-on-primary hover:bg-primary-hover active:scale-[0.98]"
                  : "bg-surface-3 text-ink-subtle cursor-not-allowed",
              )}
            >
              提交描述
            </button>
            <span className={tx("text-caption text-ink-tertiary")}>
              {connected ? "提交后不可修改" : "🔌 重连中，暂不可提交"}
            </span>
          </>
        )}
      </div>
    );
  } else if (phase === "voting") {
    center = (
      <div className={tx(BOX)}>
        {!iAmAlive ? (
          <span className={tx("text-body-sm text-ink-subtle")}>你已出局，无法投票（观战中）</span>
        ) : iHaveVoted ? (
          <>
            <span
              className={tx(
                "text-body-sm text-semantic-success font-medium animate-[uc-pop_300ms_ease-out]",
              )}
            >
              ✅ 你投了 {targetLabel}
            </span>
            <span className={tx("text-caption text-ink-subtle")}>
              点其他人那一格可改票 · 还差 {Math.max(0, aliveCount - votedAlive)} 人（{votedAlive}/
              {aliveCount}）
            </span>
            {isTiebreak && (
              <span className={tx("text-caption text-primary")}>⚖️ 平票加赛，只能投高亮候选人</span>
            )}
          </>
        ) : (
          <>
            <span className={tx("text-body font-medium text-ink")}>投出你认为的卧底</span>
            <span className={tx("text-caption text-ink-subtle")}>
              点击 TA 那一整格投票 · 不能投自己
            </span>
            {isTiebreak && (
              <span className={tx("text-caption text-primary")}>⚖️ 平票加赛，只能投高亮候选人</span>
            )}
          </>
        )}
      </div>
    );
  } else {
    // reveal —— 牌桌内联，不再全屏覆盖
    center = (
      <div className={tx(BOX)}>
        {voteResult?.eliminatedId ? (
          <>
            <span className={tx("text-body font-medium text-ink")}>{elimLabel} 出局</span>
            {voteResult.eliminatedRole && (
              <span
                className={tx(
                  "text-body-sm font-medium px-3 py-1 rounded-lg border",
                  voteResult.eliminatedRole === "undercover"
                    ? "text-semantic-error border-semantic-error bg-surface-2"
                    : "text-ink-muted border-hairline bg-surface-2",
                )}
              >
                {voteResult.eliminatedRole === "undercover" ? "🎯 TA 是【卧底】" : "TA 是【平民】"}
              </span>
            )}
          </>
        ) : (
          <>
            <span className={tx("text-body font-medium text-ink")}>本轮平票 ⚖️</span>
            <span className={tx("text-caption text-ink-subtle")}>无人出局，继续下一轮</span>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={tx("flex-1 flex flex-col gap-3 min-h-0 min-w-0")}>
      <PlayerRing
        players={players}
        myId={myId}
        hostId={hostId}
        phase={phase}
        descriptions={descriptions}
        round={round}
        votedPlayerIds={votedPlayerIds}
        voteResult={voteResult}
        clickableIds={votableIds}
        selectedId={myVoteTarget}
        onAvatarClick={handleVote}
        centerNode={center}
      />
      <PhaseStepper phase={phase} />
    </div>
  );
}
