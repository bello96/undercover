import { tx } from "@twind/core";
import type { PlayerInfo, Role } from "../types/protocol";
import Avatar from "./Avatar";
import { colorForPlayer } from "../utils/playerColor";

interface Props {
  eliminatedId: string | null;
  eliminatedRole?: Role;
  players: PlayerInfo[];
}

const RED = "#eb5757";

/**
 * 出局揭晓覆盖层（分步悬念）：
 * - 头像弹入 → 名字升入 → 身份徽标延迟弹出（卧底红，平民中性）。
 * - eliminatedId 为 null → 「本轮平票，无人出局」。
 */
export default function RevealOverlay({ eliminatedId, eliminatedRole, players }: Props) {
  const eliminatedPlayer = players.find((p) => p.id === eliminatedId);
  const isUndercover = eliminatedRole === "undercover";

  return (
    <div
      className={tx(
        "fixed inset-0 z-40 flex items-center justify-center",
        "bg-semantic-overlay bg-opacity-70 animate-[uc-overlay-in_200ms_ease-out]",
      )}
    >
      <div
        className={tx(
          "bg-surface-1 border border-hairline rounded-2xl px-8 py-8",
          "max-w-sm w-full mx-4 flex flex-col items-center gap-5 text-center",
          "shadow-card-strong animate-[uc-pop-in_300ms_ease-out]",
        )}
      >
        {eliminatedId && eliminatedPlayer ? (
          <>
            <Avatar
              name={eliminatedPlayer.name}
              color={isUndercover ? RED : colorForPlayer(eliminatedPlayer.id, players)}
              size={72}
              ringColor={isUndercover ? RED : undefined}
              ringWidth={2}
              className="animate-[uc-pop_400ms_ease-out]"
            />
            <div
              className={tx("flex flex-col gap-1 animate-[uc-fade-up_300ms_ease-out_both]")}
              style={{ animationDelay: "150ms" }}
            >
              <p className={tx("text-caption text-ink-subtle uppercase tracking-[0.2em]")}>
                本轮出局
              </p>
              <p className={tx("text-headline font-display font-semibold text-ink")}>
                {eliminatedPlayer.name}
              </p>
            </div>

            {eliminatedRole ? (
              <div
                className={tx(
                  "px-5 py-2.5 rounded-lg border animate-[uc-pop-in_400ms_ease-out_both]",
                  isUndercover
                    ? "bg-surface-2 border-semantic-error text-semantic-error"
                    : "bg-surface-2 border-hairline text-ink-muted",
                )}
                style={{ animationDelay: "650ms" }}
              >
                <p className={tx("text-body font-medium")}>
                  {isUndercover ? "🎯 TA 是【卧底】" : "TA 是【平民】"}
                </p>
              </div>
            ) : (
              <p className={tx("text-body text-ink-muted")}>被投出局</p>
            )}
          </>
        ) : (
          <>
            <div
              className={tx(
                "w-16 h-16 rounded-full bg-surface-3 border-2 border-hairline-strong",
                "flex items-center justify-center text-display-md animate-[uc-pop_400ms_ease-out]",
              )}
            >
              <span>⚖️</span>
            </div>
            <div className={tx("flex flex-col gap-1")}>
              <p className={tx("text-caption text-ink-subtle uppercase tracking-[0.2em]")}>
                投票结果
              </p>
              <p className={tx("text-headline font-display font-semibold text-ink")}>本轮平票</p>
            </div>
            <p className={tx("text-body text-ink-muted")}>无人出局，继续下一轮</p>
          </>
        )}
      </div>
    </div>
  );
}
