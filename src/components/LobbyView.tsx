import { tx } from "@twind/core";
import type { PlayerInfo } from "../types/protocol";
import PlayerRing from "./PlayerRing";

const BOX =
  "bg-surface-1 border border-hairline rounded-xl shadow-card px-5 py-4 flex flex-col items-center gap-1.5 text-center";

interface Props {
  players: PlayerInfo[];
  myId: string;
  hostId: string;
  maxPlayers: number;
  onToggleReady: (ready: boolean) => void;
  onStartGame: () => void;
}

/** 大厅中心视图：牌桌（玩家就位 + 准备态）+ 底部准备/开始动作栏。 */
export default function LobbyView({
  players,
  myId,
  hostId,
  maxPlayers,
  onToggleReady,
  onStartGame,
}: Props) {
  const me = players.find((p) => p.id === myId);
  const isHost = myId === hostId;
  const myReady = me?.ready ?? false;
  const count = players.length;
  const nonHost = players.filter((p) => !p.isHost);
  const readyCount = nonHost.filter((p) => p.ready).length;
  const allReady = nonHost.every((p) => p.ready);
  const canStart = count >= 3 && allReady;

  const center = (
    <div className={tx(BOX)}>
      <span className={tx("text-[26px]")}>🕵️</span>
      <span className={tx("text-body font-medium text-ink")}>等待玩家就位</span>
      <span className={tx("text-caption text-ink-subtle tabular-nums")}>
        {count}/{maxPlayers} 人在房 · {readyCount}/{nonHost.length} 已准备
      </span>
    </div>
  );

  return (
    <div className={tx("flex-1 flex flex-col gap-3 min-h-0 min-w-0")}>
      <PlayerRing players={players} myId={myId} hostId={hostId} phase="lobby" centerNode={center} />
      <div
        className={tx(
          "bg-surface-1 border border-hairline rounded-xl px-4 py-3 flex flex-col items-center gap-2 shrink-0",
        )}
      >
        {isHost ? (
          <>
            <button
              onClick={onStartGame}
              disabled={!canStart}
              className={tx(
                "w-full max-w-xs px-4 py-3 rounded-lg text-button font-medium transition-all",
                canStart
                  ? "bg-primary text-on-primary hover:bg-primary-hover active:scale-[0.98] shadow-card"
                  : "bg-surface-3 text-ink-subtle border border-hairline cursor-not-allowed",
              )}
            >
              开始游戏
            </button>
            <span className={tx("text-caption text-ink-subtle")}>
              {count < 3
                ? `还差 ${3 - count} 人才能开始`
                : allReady
                  ? "全员已准备，可以开始"
                  : `等待玩家准备（${readyCount}/${nonHost.length}）`}
            </span>
          </>
        ) : (
          <>
            <button
              onClick={() => onToggleReady(!myReady)}
              className={tx(
                "w-full max-w-xs px-4 py-3 rounded-lg text-button font-medium transition-all active:scale-[0.98]",
                myReady
                  ? "bg-surface-3 text-ink-muted border border-hairline-strong hover:text-ink"
                  : "bg-primary text-on-primary hover:bg-primary-hover shadow-card",
              )}
            >
              {myReady ? "取消准备" : "准备"}
            </button>
            <span className={tx("text-caption text-ink-subtle")}>
              {myReady ? "已准备，等待房主开始游戏…" : "点击准备，准备好后房主即可开始"}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
