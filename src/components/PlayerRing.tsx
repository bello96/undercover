import type { ReactNode } from "react";
import { tx } from "@twind/core";
import type { DescribeEntry, GamePhase, PlayerInfo, Role } from "../types/protocol";
import Avatar from "./Avatar";
import { colorForIndex } from "../utils/playerColor";

const GOLD = "#e3b341"; // 房主描边金（彩色头像上可见，保留）
const RED = "#d92d20"; // 卧底揭晓描边（亮底友好红）
const PRIMARY = "#5e6ad2";
const INK = "#16181d"; // 本人头像描边：亮色模式近黑
const HAIRLINE = "#d0d4da"; // 默认头像描边：亮色模式浅灰

const CLAMP_2: React.CSSProperties = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

interface VoteResultSnapshot {
  tally: Record<string, number>;
  eliminatedId: string | null;
  eliminatedRole?: Role;
}

interface Props {
  players: PlayerInfo[];
  myId: string;
  hostId: string;
  phase: GamePhase;
  descriptions?: DescribeEntry[];
  round?: number;
  votedPlayerIds?: string[];
  voteResult?: VoteResultSnapshot | null;
  /** ended 阶段揭晓的身份表 */
  roles?: Record<string, Role> | null;
  /** voting：可点（可投）的玩家 id 集合 —— 整槽可点 */
  clickableIds?: Set<string>;
  /** voting：我当前选中的投票目标（强高亮） */
  selectedId?: string | null;
  onAvatarClick?: (id: string) => void;
  /** 圆心内容（各阶段不同：开始/描述/投票/结算…） */
  centerNode?: ReactNode;
}

/**
 * 共享「环形牌桌」：头像沿圆周排布，圆心放阶段内容。
 * 大厅/描述/投票/公示/结算全部复用，保证「同一张桌子」的统一观感。
 */
export default function PlayerRing({
  players,
  myId,
  hostId,
  phase,
  descriptions = [],
  round = 0,
  votedPlayerIds = [],
  voteResult = null,
  roles = null,
  clickableIds,
  selectedId = null,
  onAvatarClick,
  centerNode,
}: Props) {
  const n = players.length || 1;
  const descByPlayer = new Map(
    descriptions.filter((d) => d.round === round).map((d) => [d.playerId, d.text]),
  );
  const votedSet = new Set(votedPlayerIds);

  return (
    <div className={tx("flex-1 flex items-center justify-center min-h-0 w-full")}>
      <div className={tx("relative w-full max-w-[560px]")} style={{ aspectRatio: "1 / 1" }}>
        {players.map((p, i) => {
          const angle = (-90 + (360 / n) * i) * (Math.PI / 180);
          const radius = 40;
          const left = 50 + radius * Math.cos(angle);
          const top = 50 + radius * Math.sin(angle);

          const isMe = p.id === myId;
          const isHostPlayer = p.id === hostId;
          const seat = i + 1;
          const clickable = !!clickableIds?.has(p.id);
          const selected = selectedId === p.id;
          const text = descByPlayer.get(p.id);
          const isEliminatedReveal = phase === "reveal" && voteResult?.eliminatedId === p.id;
          const revealedRole: Role | undefined = roles
            ? roles[p.id]
            : isEliminatedReveal
              ? voteResult?.eliminatedRole
              : undefined;
          const isUC = revealedRole === "undercover";
          const showRole = (phase === "ended" || isEliminatedReveal) && !!revealedRole;
          const tally = phase === "reveal" ? voteResult?.tally[p.id] : undefined;

          // 状态文案
          let status: { text: string; cls: string } | null = null;
          if (phase === "lobby") {
            status = isHostPlayer
              ? { text: "房主", cls: "text-primary" }
              : p.ready
                ? { text: "已准备", cls: "text-semantic-success" }
                : { text: "未准备", cls: "text-ink-tertiary" };
          } else if (showRole) {
            status = isUC
              ? { text: "卧底", cls: "text-semantic-error" }
              : { text: "平民", cls: "text-ink-muted" };
          } else if (!p.alive) {
            status = { text: "已出局", cls: "text-ink-tertiary" };
          } else if (phase === "describing") {
            status = descByPlayer.has(p.id)
              ? { text: "已描述", cls: "text-semantic-success" }
              : { text: "描述中…", cls: "text-primary" };
          } else if (phase === "voting") {
            status = votedSet.has(p.id)
              ? { text: "已投票", cls: "text-semantic-success" }
              : { text: "思考中…", cls: "text-ink-subtle" };
          }
          const waiting =
            (phase === "describing" && p.alive && !descByPlayer.has(p.id)) ||
            (phase === "voting" && p.alive && !votedSet.has(p.id));

          // 描边语义：揭晓卧底红 > 选中紫(粗) > 可投紫 > 本人亮 > 大厅房主金 > 默认
          let ringColor = HAIRLINE;
          let ringWidth = 1;
          if (showRole && isUC) {
            ringColor = RED;
            ringWidth = 2;
          } else if (selected) {
            ringColor = PRIMARY;
            ringWidth = 3;
          } else if (clickable) {
            ringColor = PRIMARY;
            ringWidth = 2;
          } else if (isMe) {
            ringColor = INK;
            ringWidth = 2;
          } else if (isHostPlayer && phase === "lobby") {
            ringColor = GOLD;
            ringWidth = 2;
          }

          const avatarColor = showRole && isUC ? RED : colorForIndex(i);
          const dimmed = !p.alive && !isEliminatedReveal && phase !== "ended" && phase !== "lobby";
          const slotClickable = clickable && !!onAvatarClick;

          return (
            <div
              key={p.id}
              onClick={slotClickable ? () => onAvatarClick!(p.id) : undefined}
              className={tx(
                "absolute flex flex-col items-center gap-1 w-[112px] -translate-x-1/2 -translate-y-1/2 rounded-xl p-1.5 transition-all",
                slotClickable && "cursor-pointer hover:bg-surface-2",
                selected && "bg-surface-2 ring-1 ring-primary",
              )}
              style={{ left: `${left}%`, top: `${top}%` }}
            >
              <Avatar
                name={p.name}
                color={avatarColor}
                size={44}
                ringColor={ringColor}
                ringWidth={ringWidth}
                dimmed={dimmed}
                className={
                  isEliminatedReveal && isUC ? "animate-[uc-shake_500ms_ease-in-out]" : undefined
                }
              >
                {isHostPlayer && (
                  <span className={tx("absolute -top-3 left-1/2 -translate-x-1/2 text-caption")}>
                    👑
                  </span>
                )}
                <span
                  className={tx(
                    "absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-surface-1 border border-hairline-strong",
                    "flex items-center justify-center text-[9px] text-ink-subtle tabular-nums",
                  )}
                >
                  {seat}
                </span>
                {selected && (
                  <span
                    className={tx(
                      "absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full bg-primary text-on-primary",
                      "flex items-center justify-center text-[9px] animate-[uc-pop_300ms_ease-out]",
                    )}
                  >
                    ✓
                  </span>
                )}
              </Avatar>

              <div className={tx("flex flex-col items-center gap-0.5 w-full")}>
                <span className={tx("text-caption text-ink-muted max-w-full truncate")}>
                  {seat}号 {p.name}
                </span>
                <div className={tx("flex items-center gap-1")}>
                  {status && (
                    <span
                      className={tx(
                        "text-[11px] font-medium",
                        status.cls,
                        waiting && "animate-[uc-breathe_1.6s_ease-in-out_infinite]",
                      )}
                    >
                      {status.text}
                    </span>
                  )}
                  {typeof tally === "number" && tally > 0 && (
                    <span
                      className={tx("text-[11px] text-ink-subtle animate-[uc-pop_300ms_ease-out]")}
                    >
                      · {tally}票
                    </span>
                  )}
                  {isMe && (
                    <span
                      className={tx(
                        "text-[10px] text-ink-subtle bg-surface-3 border border-hairline rounded px-1",
                      )}
                    >
                      我
                    </span>
                  )}
                </div>
                {selected && (
                  <span className={tx("text-[10px] text-primary font-medium")}>你投的</span>
                )}
              </div>

              {text ? (
                <div
                  className={tx(
                    "w-full text-[11px] leading-snug rounded-md px-2 py-1 break-words text-center",
                    "bg-surface-2 border border-hairline text-ink animate-[uc-fade-up_300ms_ease-out]",
                  )}
                  style={{ ...CLAMP_2, borderLeft: `2px solid ${colorForIndex(i)}` }}
                  title={text}
                >
                  {text}
                </div>
              ) : null}
            </div>
          );
        })}

        <div
          className={tx(
            "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[58%] max-w-[300px]",
          )}
        >
          {centerNode}
        </div>
      </div>
    </div>
  );
}
