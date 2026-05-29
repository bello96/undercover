import { useState } from "react";
import { tx } from "@twind/core";
import type { PlayerInfo } from "../types/protocol";
import type { ClientMessage } from "../types/protocol";

interface Props {
  roomCode: string;
  players: PlayerInfo[];
  hostId: string;
  maxPlayers: number;
  myId: string;
  send: (msg: ClientMessage) => void;
}

export default function Lobby({ roomCode, players, hostId, maxPlayers, myId, send }: Props) {
  const [copyHint, setCopyHint] = useState(false);

  const isHost = myId === hostId;
  const playerCount = players.length;
  const canStart = playerCount >= 3;
  const neededCount = 3 - playerCount;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopyHint(true);
      setTimeout(() => setCopyHint(false), 2000);
    });
  };

  const handleStartGame = () => {
    if (!isHost || !canStart) {
      return;
    }
    send({ type: "startGame" });
  };

  return (
    <div
      className={tx(
        "min-h-screen bg-canvas text-ink flex items-center justify-center p-4",
      )}
    >
      <div
        className={tx(
          "w-full max-w-md bg-surface-1 border border-hairline rounded-xl p-8 flex flex-col gap-6",
        )}
      >
        {/* 房间号 */}
        <div className={tx("text-center")}>
          <p className={tx("text-body-sm text-ink-subtle mb-2 uppercase tracking-widest")}>
            房间号
          </p>
          <button
            onClick={handleCopyCode}
            className={tx(
              "relative inline-flex items-center gap-2 px-4 py-2 rounded-lg",
              "bg-surface-2 border border-hairline hover:border-hairline-strong",
              "transition-colors cursor-pointer group",
            )}
            title="点击复制房间号"
          >
            <span
              className={tx(
                "text-display-md font-display font-semibold text-ink tracking-widest",
              )}
            >
              {roomCode}
            </span>
            <span className={tx("text-ink-subtle text-caption group-hover:text-ink-muted transition-colors")}>
              {copyHint ? "已复制" : "复制"}
            </span>
          </button>
          {copyHint && (
            <p className={tx("text-caption text-semantic-success mt-1")}>
              房间号已复制到剪贴板
            </p>
          )}
        </div>

        {/* 玩家列表 */}
        <div>
          <div className={tx("flex items-center justify-between mb-3")}>
            <span className={tx("text-body-sm text-ink-muted font-medium")}>玩家</span>
            <span className={tx("text-body-sm text-ink-subtle")}>
              {playerCount} / {maxPlayers}
            </span>
          </div>
          <ul className={tx("flex flex-col gap-2")}>
            {players.map((player) => (
              <li
                key={player.id}
                className={tx(
                  "flex items-center gap-3 px-3 py-2 rounded-lg",
                  "bg-surface-2 border border-hairline",
                )}
              >
                <span
                  className={tx(
                    "w-7 h-7 rounded-full bg-surface-3 border border-hairline-strong",
                    "flex items-center justify-center text-caption text-ink-subtle font-medium",
                    "shrink-0",
                  )}
                >
                  {player.name.slice(0, 1).toUpperCase()}
                </span>
                <span className={tx("text-body text-ink flex-1 truncate")}>
                  {player.name}
                </span>
                {player.id === myId && (
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
                      "rounded px-1.5 py-0.5 shrink-0",
                    )}
                  >
                    房主
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* 操作区 */}
        <div className={tx("flex flex-col gap-3 items-center")}>
          {isHost ? (
            <>
              <button
                onClick={handleStartGame}
                disabled={!canStart}
                className={tx(
                  "w-full px-4 py-3 rounded-lg text-button font-medium transition-colors",
                  canStart
                    ? "bg-primary text-on-primary hover:bg-primary-hover cursor-pointer"
                    : "bg-surface-3 text-ink-subtle border border-hairline cursor-not-allowed",
                )}
              >
                开始游戏
              </button>
              {!canStart && (
                <p className={tx("text-caption text-ink-subtle text-center")}>
                  {neededCount > 0
                    ? `还差 ${neededCount} 人才能开始`
                    : "至少需要 3 名玩家"}
                </p>
              )}
            </>
          ) : (
            <p className={tx("text-body-sm text-ink-subtle text-center")}>
              等待房主开始游戏...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
