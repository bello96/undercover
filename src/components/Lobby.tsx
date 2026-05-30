import { useState } from "react";
import { tx } from "@twind/core";
import type { PlayerInfo, ClientMessage } from "../types/protocol";

interface Props {
  roomCode: string;
  players: PlayerInfo[];
  hostId: string;
  maxPlayers: number;
  myId: string;
  send: (msg: ClientMessage) => void;
}

export default function Lobby({ roomCode, players, hostId, maxPlayers, myId, send }: Props) {
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const me = players.find((p) => p.id === myId);
  const isHost = myId === hostId;
  const myReady = me?.ready ?? false;
  const playerCount = players.length;
  const isFull = playerCount >= maxPlayers;

  const nonHost = players.filter((p) => !p.isHost);
  const readyCount = nonHost.filter((p) => p.ready).length;
  const allNonHostReady = nonHost.every((p) => p.ready);
  const canStart = playerCount >= 3 && allNonHostReady;
  const neededCount = 3 - playerCount;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    });
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/${roomCode}`;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  };

  const handleToggleReady = () => {
    send({ type: "ready", ready: !myReady });
  };

  const handleStartGame = () => {
    if (!isHost || !canStart) {
      return;
    }
    send({ type: "startGame" });
  };

  return (
    <div className={tx("min-h-screen bg-canvas text-ink flex items-center justify-center p-4")}>
      <div
        className={tx(
          "w-full max-w-md bg-surface-1 border border-hairline rounded-xl p-8 flex flex-col gap-6",
        )}
      >
        {/* 房间号 */}
        <div className={tx("text-center flex flex-col items-center gap-3")}>
          <p className={tx("text-body-sm text-ink-subtle uppercase tracking-widest")}>房间号</p>
          <button
            onClick={handleCopyCode}
            className={tx(
              "relative inline-flex items-center gap-2 px-4 py-2 rounded-lg",
              "bg-surface-2 border border-hairline hover:border-hairline-strong",
              "transition-colors cursor-pointer group",
            )}
            title="点击复制房间号"
          >
            <span className={tx("text-display-md font-display font-semibold text-ink tracking-widest")}>
              {roomCode}
            </span>
            <span className={tx("text-ink-subtle text-caption group-hover:text-ink-muted transition-colors")}>
              {codeCopied ? "已复制" : "复制"}
            </span>
          </button>

          {/* 邀请链接（房间未满时显示） */}
          {!isFull && (
            <div className={tx("flex flex-col items-center gap-1.5 mt-1")}>
              <button
                onClick={handleCopyLink}
                className={tx(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-button font-medium",
                  "bg-surface-2 border border-hairline text-ink-muted",
                  "hover:text-ink hover:border-hairline-strong transition-colors",
                )}
              >
                🔗 {linkCopied ? "链接已复制" : "复制房间链接"}
              </button>
              <p className={tx("text-caption text-ink-tertiary")}>
                把链接发给好友，点开即可直接进房
              </p>
            </div>
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
                  "flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-2 border border-hairline",
                )}
              >
                <span
                  className={tx(
                    "w-7 h-7 rounded-full bg-surface-3 border border-hairline-strong shrink-0",
                    "flex items-center justify-center text-caption text-ink-subtle font-medium",
                  )}
                >
                  {player.name.slice(0, 1).toUpperCase()}
                </span>
                <span className={tx("text-body text-ink flex-1 truncate")}>{player.name}</span>
                {player.id === myId && (
                  <span className={tx("text-caption text-ink-subtle bg-surface-3 border border-hairline rounded px-1.5 py-0.5 shrink-0")}>
                    我
                  </span>
                )}
                {player.isHost ? (
                  <span className={tx("text-caption text-primary bg-surface-3 border border-hairline rounded px-1.5 py-0.5 shrink-0")}>
                    房主
                  </span>
                ) : player.ready ? (
                  <span className={tx("text-caption text-semantic-success bg-surface-3 border border-hairline rounded px-1.5 py-0.5 shrink-0")}>
                    ✓ 已准备
                  </span>
                ) : (
                  <span className={tx("text-caption text-ink-tertiary bg-surface-3 border border-hairline rounded px-1.5 py-0.5 shrink-0")}>
                    未准备
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* 操作区 */}
        <div className={tx("flex flex-col gap-2 items-center")}>
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
              <p className={tx("text-caption text-ink-subtle text-center")}>
                {playerCount < 3
                  ? `还差 ${neededCount} 人才能开始`
                  : allNonHostReady
                    ? "全员已准备，可以开始"
                    : `等待玩家准备（${readyCount}/${nonHost.length} 已准备）`}
              </p>
            </>
          ) : (
            <>
              <button
                onClick={handleToggleReady}
                className={tx(
                  "w-full px-4 py-3 rounded-lg text-button font-medium transition-colors",
                  myReady
                    ? "bg-surface-3 text-ink-muted border border-hairline-strong hover:text-ink cursor-pointer"
                    : "bg-primary text-on-primary hover:bg-primary-hover cursor-pointer",
                )}
              >
                {myReady ? "取消准备" : "准备"}
              </button>
              <p className={tx("text-caption text-ink-subtle text-center")}>
                {myReady ? "已准备，等待房主开始游戏…" : "点击准备，准备好后房主即可开始"}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
