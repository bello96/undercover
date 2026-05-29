import { tx } from "@twind/core";
import type { PlayerInfo, Role } from "../types/protocol";

interface Props {
  eliminatedId: string | null;
  eliminatedRole?: Role;
  players: PlayerInfo[];
}

/**
 * 出局揭晓覆盖层：
 * - eliminatedId 非空 → 展示「{名字} 被投出，TA 是【平民/卧底】」
 * - eliminatedId 为 null → 「本轮平票，无人出局」
 * - 卧底用 semantic-error 强调；平民用 primary
 * - 使用 semantic-overlay 做半透明遮罩背景
 */
export default function RevealOverlay({ eliminatedId, eliminatedRole, players }: Props) {
  const eliminatedPlayer = players.find((p) => p.id === eliminatedId);
  const isUndercover = eliminatedRole === "undercover";

  return (
    <div
      className={tx(
        "fixed inset-0 z-40 flex items-center justify-center",
        "bg-semantic-overlay bg-opacity-70",
      )}
    >
      <div
        className={tx(
          "bg-surface-1 border border-hairline rounded-xl px-8 py-8",
          "max-w-sm w-full mx-4 flex flex-col items-center gap-5 text-center",
          "shadow-card-strong",
        )}
      >
        {eliminatedId && eliminatedPlayer ? (
          <>
            {/* 头像圆 */}
            <div
              className={tx(
                "w-16 h-16 rounded-full flex items-center justify-center",
                "text-display-md font-display font-semibold",
                isUndercover
                  ? "bg-semantic-error text-on-primary"
                  : "bg-primary text-on-primary",
              )}
            >
              {eliminatedPlayer.name.slice(0, 1).toUpperCase()}
            </div>

            {/* 名字 */}
            <div className={tx("flex flex-col gap-1")}>
              <p className={tx("text-body-sm text-ink-subtle uppercase tracking-widest")}>
                本轮出局
              </p>
              <p className={tx("text-headline font-display font-semibold text-ink")}>
                {eliminatedPlayer.name}
              </p>
            </div>

            {/* 身份揭晓（仅在服务端提供 eliminatedRole 时展示） */}
            {eliminatedRole ? (
              <div
                className={tx(
                  "px-4 py-2 rounded-lg border",
                  isUndercover
                    ? "bg-surface-2 border-semantic-error text-semantic-error"
                    : "bg-surface-2 border-hairline text-ink-muted",
                )}
              >
                <p className={tx("text-body font-medium")}>
                  TA 是【{isUndercover ? "卧底" : "平民"}】
                </p>
              </div>
            ) : (
              <p className={tx("text-body text-ink-muted")}>
                被投出局
              </p>
            )}
          </>
        ) : (
          <>
            {/* 平票，无人出局 */}
            <div
              className={tx(
                "w-16 h-16 rounded-full bg-surface-3 border-2 border-hairline-strong",
                "flex items-center justify-center text-display-md",
              )}
            >
              <span>⚖️</span>
            </div>
            <div className={tx("flex flex-col gap-1")}>
              <p className={tx("text-body-sm text-ink-subtle uppercase tracking-widest")}>
                投票结果
              </p>
              <p className={tx("text-headline font-display font-semibold text-ink")}>
                本轮平票
              </p>
            </div>
            <p className={tx("text-body text-ink-muted")}>无人出局，继续下一轮</p>
          </>
        )}
      </div>
    </div>
  );
}
