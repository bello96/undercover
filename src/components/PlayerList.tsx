import { useState, useEffect } from "react";
import { tx } from "@twind/core";
import type { GamePhase, PlayerInfo } from "../types/protocol";

interface Props {
  players: PlayerInfo[];
  myId: string;
  currentSpeakerId?: string;
  deadline?: number;
  votedPlayerIds?: string[];
  phase: GamePhase;
}

/**
 * 通用玩家列表：描述/投票两视图共用。
 * - 当前发言者高亮 + 发言倒计时（基于 deadline）
 * - 出局玩家置灰 + 标记「出局」
 * - host 标「房主」徽标，自己标「我」
 * - 投票阶段：已投票者显示「已投票」徽标
 */
export default function PlayerList({
  players,
  myId,
  currentSpeakerId,
  deadline,
  votedPlayerIds = [],
  phase,
}: Props) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!deadline || !currentSpeakerId) {
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
  }, [deadline, currentSpeakerId]);

  return (
    <div>
      <p className={tx("text-body-sm text-ink-subtle mb-2 font-medium")}>
        玩家（{players.filter((p) => p.alive).length} 存活）
      </p>
      <ul className={tx("flex flex-col gap-2")}>
        {players.map((player) => {
          const isCurrent = player.id === currentSpeakerId;
          const isMe = player.id === myId;
          const hasVoted = votedPlayerIds.includes(player.id);
          const showVotedBadge = phase === "voting" && hasVoted;

          return (
            <li
              key={player.id}
              className={tx(
                "flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors",
                isCurrent
                  ? "bg-surface-2 border-primary"
                  : "bg-surface-2 border-hairline",
                !player.alive && "opacity-50",
              )}
            >
              {/* 首字母头像 */}
              <span
                className={tx(
                  "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
                  "text-caption font-medium",
                  isCurrent
                    ? "bg-primary text-on-primary"
                    : "bg-surface-3 border border-hairline-strong text-ink-subtle",
                )}
              >
                {player.name.slice(0, 1).toUpperCase()}
              </span>

              {/* 名字 */}
              <span
                className={tx(
                  "text-body flex-1 truncate",
                  player.alive ? "text-ink" : "text-ink-tertiary",
                )}
              >
                {player.name}
              </span>

              {/* 右侧徽标区 */}
              <div className={tx("flex items-center gap-1.5 shrink-0")}>
                {/* 倒计时（仅当前发言者 + deadline 有效） */}
                {isCurrent && secondsLeft !== null && (
                  <span
                    className={tx(
                      "text-caption font-mono tabular-nums",
                      secondsLeft <= 10 ? "text-semantic-error" : "text-ink-muted",
                    )}
                  >
                    {secondsLeft}s
                  </span>
                )}

                {isMe && (
                  <span
                    className={tx(
                      "text-caption text-ink-subtle bg-surface-3 border border-hairline",
                      "rounded px-1.5 py-0.5",
                    )}
                  >
                    我
                  </span>
                )}

                {player.isHost && (
                  <span
                    className={tx(
                      "text-caption text-primary bg-surface-3 border border-hairline",
                      "rounded px-1.5 py-0.5",
                    )}
                  >
                    房主
                  </span>
                )}

                {!player.alive && (
                  <span
                    className={tx(
                      "text-caption text-ink-tertiary bg-surface-3 border border-hairline",
                      "rounded px-1.5 py-0.5",
                    )}
                  >
                    出局
                  </span>
                )}

                {showVotedBadge && (
                  <span
                    className={tx(
                      "text-caption text-semantic-success bg-surface-3 border border-hairline",
                      "rounded px-1.5 py-0.5",
                    )}
                  >
                    已投票
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
