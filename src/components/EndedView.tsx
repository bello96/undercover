import { tx } from "@twind/core";
import type { PlayerInfo, Role, Winner } from "../types/protocol";
import PlayerRing from "./PlayerRing";
import Confetti from "./Confetti";

const BOX =
  "bg-surface-1 border border-hairline rounded-xl shadow-card px-5 py-4 flex flex-col items-center gap-1.5 text-center";
const UNDERCOVER_CONFETTI = [
  "#eb5757",
  "#d65f6b",
  "#c45e9b",
  "#9b6ad2",
  "#7a7fad",
  "#828fff",
  "#5e6ad2",
];

interface Props {
  players: PlayerInfo[];
  myId: string;
  hostId: string;
  winner: Winner;
  undercoverId: string;
  civilianWord: string;
  undercoverWord: string;
  roles: Record<string, Role>;
  isHost: boolean;
  onNextGame: () => void;
  onLeave: () => void;
}

/** 结算中心视图：Confetti + 牌桌身份揭晓 + 底部词揭晓/再来一局/退出。 */
export default function EndedView({
  players,
  myId,
  hostId,
  winner,
  undercoverId,
  civilianWord,
  undercoverWord,
  roles,
  isHost,
  onNextGame,
  onLeave,
}: Props) {
  const isCivWin = winner === "civilian";
  const ucIdx = players.findIndex((p) => p.id === undercoverId);
  const ucLabel = ucIdx >= 0 ? `${ucIdx + 1}号 ${players[ucIdx].name}` : "";

  const center = (
    <div className={tx(BOX)}>
      <span
        className={tx(
          "text-headline font-display font-semibold animate-[uc-pop_500ms_ease-out]",
          isCivWin ? "text-semantic-success" : "text-semantic-error",
        )}
      >
        {isCivWin ? "🎉 平民胜利" : "🕵️ 卧底胜利"}
      </span>
      {ucLabel && <span className={tx("text-caption text-ink-subtle")}>卧底是 {ucLabel}</span>}
    </div>
  );

  return (
    <div className={tx("flex-1 flex flex-col gap-3 min-h-0 min-w-0")}>
      <Confetti colors={isCivWin ? undefined : UNDERCOVER_CONFETTI} />
      <PlayerRing
        players={players}
        myId={myId}
        hostId={hostId}
        phase="ended"
        roles={roles}
        centerNode={center}
      />
      <div
        className={tx(
          "bg-surface-1 border border-hairline rounded-xl px-4 py-3 flex items-center gap-3 shrink-0",
        )}
      >
        <div className={tx("flex gap-2 flex-1 min-w-0")}>
          <div
            className={tx(
              "flex-1 bg-surface-2 border border-hairline rounded-lg px-3 py-2 text-center min-w-0",
            )}
          >
            <p className={tx("text-caption text-ink-subtle")}>平民词</p>
            <p className={tx("text-body-sm font-display font-semibold text-ink truncate")}>
              {civilianWord}
            </p>
          </div>
          <div
            className={tx(
              "flex-1 bg-surface-2 border border-semantic-error border-opacity-60 rounded-lg px-3 py-2 text-center min-w-0",
            )}
          >
            <p className={tx("text-caption text-semantic-error")}>卧底词</p>
            <p
              className={tx("text-body-sm font-display font-semibold text-semantic-error truncate")}
            >
              {undercoverWord}
            </p>
          </div>
        </div>
        <div className={tx("flex flex-col gap-2 shrink-0")}>
          {isHost ? (
            <button
              onClick={onNextGame}
              className={tx(
                "px-4 py-2 rounded-lg text-button font-medium bg-primary text-on-primary",
                "hover:bg-primary-hover transition-all active:scale-[0.98] shadow-card whitespace-nowrap",
              )}
            >
              再来一局
            </button>
          ) : (
            <span className={tx("text-caption text-ink-subtle whitespace-nowrap text-center")}>
              等房主再来一局…
            </span>
          )}
          <button
            onClick={onLeave}
            className={tx(
              "px-4 py-2 rounded-lg text-button font-medium bg-surface-2 border border-hairline text-ink-muted",
              "hover:border-hairline-strong transition-all active:scale-[0.98] whitespace-nowrap",
            )}
          >
            返回首页
          </button>
        </div>
      </div>
    </div>
  );
}
