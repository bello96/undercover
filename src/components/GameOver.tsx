import { tx } from "@twind/core";
import type { PlayerInfo, Role, Winner } from "../types/protocol";
import Confetti from "./Confetti";
import Avatar from "./Avatar";
import { colorForPlayer } from "../utils/playerColor";

interface Props {
  winner: Winner;
  undercoverId: string;
  civilianWord: string;
  undercoverWord: string;
  roles: Record<string, Role>;
  players: PlayerInfo[];
  isHost: boolean;
  onNextGame: () => void;
  onLeave: () => void;
}

const RED = "#eb5757";
// 卧底胜利用冷色/红紫彩屑，平民胜利用默认明亮色。
const UNDERCOVER_CONFETTI = [
  "#eb5757",
  "#d65f6b",
  "#c45e9b",
  "#9b6ad2",
  "#7a7fad",
  "#828fff",
  "#5e6ad2",
];

/**
 * 结算画面：Confetti 庆祝 + 胜负横幅弹入 + 词揭晓 + 每位玩家身份/词（错落入场）。
 */
export default function GameOver({
  winner,
  undercoverId,
  civilianWord,
  undercoverWord,
  roles,
  players,
  isHost,
  onNextGame,
  onLeave,
}: Props) {
  const isCivilianWin = winner === "civilian";
  const undercoverPlayer = players.find((p) => p.id === undercoverId);

  return (
    <div
      className={tx(
        "fixed inset-0 z-40 flex items-center justify-center",
        "bg-semantic-overlay bg-opacity-80 animate-[uc-overlay-in_250ms_ease-out]",
      )}
    >
      <Confetti colors={isCivilianWin ? undefined : UNDERCOVER_CONFETTI} />
      <div
        className={tx(
          "bg-surface-1 border border-hairline rounded-2xl",
          "max-w-lg w-full mx-4 overflow-y-auto max-h-[92vh]",
          "flex flex-col gap-0 shadow-card-strong animate-[uc-pop-in_350ms_ease-out]",
        )}
      >
        {/* 胜负横幅 */}
        <div
          className={tx(
            "px-8 py-8 text-center rounded-t-2xl",
            isCivilianWin
              ? "bg-semantic-success bg-opacity-10 border-b border-semantic-success border-opacity-30"
              : "bg-semantic-error bg-opacity-10 border-b border-semantic-error border-opacity-30",
          )}
        >
          <p
            className={tx(
              "text-display-md font-display font-semibold animate-[uc-pop_500ms_ease-out]",
              isCivilianWin ? "text-semantic-success" : "text-semantic-error",
            )}
          >
            {isCivilianWin ? "🎉 平民胜利！" : "🕵️ 卧底胜利！"}
          </p>
          {undercoverPlayer && (
            <p className={tx("text-body-sm text-ink-subtle mt-2")}>
              卧底是：<span className={tx("text-ink font-medium")}>{undercoverPlayer.name}</span>
            </p>
          )}
        </div>

        {/* 词语揭晓 */}
        <div className={tx("px-8 py-5 border-b border-hairline flex gap-4 justify-center")}>
          <div
            className={tx(
              "flex-1 bg-surface-2 border border-hairline rounded-lg px-4 py-3 text-center",
              "animate-[uc-fade-up_400ms_ease-out_both]",
            )}
            style={{ animationDelay: "200ms" }}
          >
            <p className={tx("text-caption text-ink-subtle uppercase tracking-wider mb-1")}>
              平民词
            </p>
            <p className={tx("text-subhead font-display font-semibold text-ink")}>{civilianWord}</p>
          </div>
          <div
            className={tx(
              "flex-1 bg-surface-2 border border-semantic-error border-opacity-60 rounded-lg px-4 py-3 text-center",
              "animate-[uc-fade-up_400ms_ease-out_both]",
            )}
            style={{ animationDelay: "300ms" }}
          >
            <p className={tx("text-caption text-semantic-error uppercase tracking-wider mb-1")}>
              卧底词
            </p>
            <p className={tx("text-subhead font-display font-semibold text-semantic-error")}>
              {undercoverWord}
            </p>
          </div>
        </div>

        {/* 玩家列表：名字 + 身份 + 词 */}
        <div className={tx("px-8 py-5 flex flex-col gap-2")}>
          <p className={tx("text-body-sm text-ink-subtle font-medium mb-1")}>所有玩家</p>
          <ul className={tx("flex flex-col gap-2")}>
            {players.map((player, i) => {
              const role = roles[player.id];
              const isUndercover = role === "undercover";
              const word = isUndercover ? undercoverWord : civilianWord;
              const isTheUndercover = player.id === undercoverId;

              return (
                <li
                  key={player.id}
                  className={tx(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg border animate-[uc-fade-up_400ms_ease-out_both]",
                    isTheUndercover
                      ? "bg-surface-2 border-semantic-error border-opacity-60"
                      : "bg-surface-2 border-hairline",
                  )}
                  style={{ animationDelay: `${400 + i * 70}ms` }}
                >
                  <Avatar
                    name={player.name}
                    color={isTheUndercover ? RED : colorForPlayer(player.id, players)}
                    size={30}
                  />
                  <span className={tx("text-body flex-1 truncate text-ink font-medium")}>
                    {player.name}
                  </span>
                  <div className={tx("flex items-center gap-2 shrink-0")}>
                    <span
                      className={tx(
                        "text-caption rounded px-1.5 py-0.5 border",
                        isUndercover
                          ? "text-semantic-error border-semantic-error border-opacity-50 bg-surface-3"
                          : "text-ink-subtle border-hairline bg-surface-3",
                      )}
                    >
                      {isUndercover ? "卧底" : "平民"}
                    </span>
                    <span className={tx("text-body-sm text-ink-muted")}>{word}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* 操作区 */}
        <div className={tx("px-8 py-6 border-t border-hairline flex flex-col gap-3 rounded-b-2xl")}>
          {isHost ? (
            <button
              onClick={onNextGame}
              className={tx(
                "w-full px-4 py-3 rounded-lg text-button font-medium",
                "bg-primary text-on-primary hover:bg-primary-hover transition-all active:scale-[0.98] shadow-card",
              )}
            >
              再来一局
            </button>
          ) : (
            <p className={tx("text-center text-body-sm text-ink-subtle py-1")}>
              等待房主开始新一局…
            </p>
          )}
          <button
            onClick={onLeave}
            className={tx(
              "w-full px-4 py-2 rounded-lg text-button font-medium",
              "bg-surface-2 border border-hairline text-ink-muted",
              "hover:border-hairline-strong transition-all active:scale-[0.98]",
            )}
          >
            返回首页
          </button>
        </div>
      </div>
    </div>
  );
}
