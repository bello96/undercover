import { useState, useEffect } from "react";
import { tx } from "@twind/core";
import type { PlayerInfo } from "../types/protocol";

interface Props {
  players: PlayerInfo[];
  myId: string;
  votedPlayerIds: string[];
  tiebreakCandidates: string[];
  deadline?: number;
  onVote: (targetId: string) => void;
}

/**
 * 投票面板：
 * - 存活玩家可投除自己外所有存活玩家
 * - 加赛时只列 tiebreakCandidates 候选人
 * - 自己已投票 → 锁定 + 倒计时 + 等待提示
 * - 自己已出局 → 观战提示，无法投票
 */
export default function VotePanel({
  players,
  myId,
  votedPlayerIds,
  tiebreakCandidates,
  deadline,
  onVote,
}: Props) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!deadline) {
      setSecondsLeft(null);
      return;
    }

    const update = () => {
      const remaining = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setSecondsLeft(remaining);
    };

    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [deadline]);

  const me = players.find((p) => p.id === myId);
  const iAmAlive = me?.alive ?? false;
  const iHaveVoted = votedPlayerIds.includes(myId);
  const isTiebreak = tiebreakCandidates.length > 0;

  // 可投目标：存活玩家排除自己；加赛时只列候选人
  const votableTargets = isTiebreak
    ? players.filter((p) => p.alive && tiebreakCandidates.includes(p.id))
    : players.filter((p) => p.alive && p.id !== myId);

  // 已出局，只能观战
  if (!iAmAlive) {
    return (
      <div
        className={tx(
          "bg-surface-1 border border-hairline rounded-xl px-6 py-5",
          "flex flex-col items-center gap-2 text-center",
        )}
      >
        <p className={tx("text-body text-ink-muted")}>你已出局，无法投票（观战中）</p>
      </div>
    );
  }

  // 已投票：锁定 + 倒计时
  if (iHaveVoted) {
    return (
      <div
        className={tx(
          "bg-surface-1 border border-hairline rounded-xl px-6 py-5",
          "flex flex-col items-center gap-3 text-center",
        )}
      >
        <div
          className={tx(
            "w-8 h-8 rounded-full bg-semantic-success flex items-center justify-center shrink-0",
          )}
        >
          <svg
            className={tx("w-4 h-4 text-on-primary")}
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="3,8 6.5,11.5 13,4.5" />
          </svg>
        </div>
        <p className={tx("text-body font-medium text-ink")}>已投票，等待其他人…</p>
        {secondsLeft !== null && (
          <p
            className={tx(
              "text-caption font-mono tabular-nums",
              secondsLeft <= 10 ? "text-semantic-error" : "text-ink-subtle",
            )}
          >
            剩余 {secondsLeft}s
          </p>
        )}
        <p className={tx("text-body-sm text-ink-subtle")}>
          已有 {votedPlayerIds.length} / {players.filter((p) => p.alive).length} 人投票
        </p>
      </div>
    );
  }

  // 待投票
  return (
    <div className={tx("bg-surface-1 border border-hairline rounded-xl px-6 py-5 flex flex-col gap-4")}>
      {/* 加赛提示 */}
      {isTiebreak && (
        <div
          className={tx(
            "bg-surface-2 border border-hairline-strong rounded-lg px-4 py-3",
            "text-body-sm text-ink-muted text-center",
          )}
        >
          ⚖️ 平票，请在候选人中重新投票
        </div>
      )}

      <p className={tx("text-body-sm text-ink-subtle font-medium")}>
        请选择你认为是卧底的玩家投票出局：
      </p>

      <ul className={tx("flex flex-col gap-2")}>
        {votableTargets.map((target) => (
          <li key={target.id}>
            <button
              onClick={() => onVote(target.id)}
              className={tx(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg border",
                "bg-surface-2 border-hairline text-ink",
                "hover:border-primary hover:bg-surface-3 transition-colors",
                "text-body font-medium",
              )}
            >
              {/* 头像 */}
              <span
                className={tx(
                  "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
                  "bg-surface-3 border border-hairline-strong text-ink-subtle text-caption font-medium",
                )}
              >
                {target.name.slice(0, 1).toUpperCase()}
              </span>
              <span className={tx("flex-1 text-left")}>{target.name}</span>
              <span className={tx("text-caption text-ink-tertiary")}>投 TA</span>
            </button>
          </li>
        ))}
      </ul>

      {votableTargets.length === 0 && (
        <p className={tx("text-body-sm text-ink-subtle text-center py-2")}>
          暂无可投目标
        </p>
      )}
    </div>
  );
}
