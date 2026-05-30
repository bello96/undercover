import { useState } from "react";
import { tx } from "@twind/core";
import type { GamePhase, PlayerInfo, Role } from "../types/protocol";

// 与服务端 constants.MAX_DESCRIBE_LENGTH 保持一致
const MAX_DESCRIBE_LENGTH = 50;
const GOLD = "#e3b341";
const PRIMARY = "#5e6ad2";
const HAIRLINE = "#23252a";
const HAIRLINE_STRONG = "#34343a";

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
  submittedIds: string[];
  votedPlayerIds: string[];
  tiebreakCandidates: string[];
  voteResult: VoteResultSnapshot | null;
  onSubmitDescribe: (text: string) => void;
  onVote: (targetId: string) => void;
}

/**
 * 中央环形玩家布局（会玩同款）：
 * - 头像沿圆周均匀排布，房主带皇冠+金环，本人蓝环；只显示状态（描述中/已描述/已投票…），描述文本走右侧信息流。
 * - 中央随阶段切换：描述输入 / 投票提示 / 公示。
 * - voting：点击他人头像投票（存活、非自己、合法目标）。
 */
export default function PlayerCircle({
  players,
  myId,
  hostId,
  phase,
  submittedIds,
  votedPlayerIds,
  tiebreakCandidates,
  voteResult,
  onSubmitDescribe,
  onVote,
}: Props) {
  const [draft, setDraft] = useState("");

  const me = players.find((p) => p.id === myId);
  const iAmAlive = me?.alive ?? false;
  const aliveCount = players.filter((p) => p.alive).length;
  const submittedSet = new Set(submittedIds);
  const votedSet = new Set(votedPlayerIds);
  const tiebreakSet = new Set(tiebreakCandidates);
  const iHaveSubmitted = submittedSet.has(myId);
  const iHaveVoted = votedSet.has(myId);
  const isTiebreak = tiebreakCandidates.length > 0;

  const submittedAlive = players.filter((p) => p.alive && submittedSet.has(p.id)).length;
  const votedAlive = players.filter((p) => p.alive && votedSet.has(p.id)).length;

  const canVoteTarget = (t: PlayerInfo): boolean => {
    return (
      phase === "voting" &&
      iAmAlive &&
      !iHaveVoted &&
      t.alive &&
      t.id !== myId &&
      (!isTiebreak || tiebreakSet.has(t.id))
    );
  };

  const handleSubmitDraft = () => {
    const text = draft.trim();
    if (!text) {
      return;
    }
    onSubmitDescribe(text);
    setDraft("");
  };

  const n = players.length;

  return (
    <div className={tx("flex-1 flex items-center justify-center min-h-0 w-full")}>
      <div className={tx("relative w-full max-w-[540px]")} style={{ aspectRatio: "1 / 1" }}>
        {/* 玩家头像环 */}
        {players.map((p, i) => {
          const angle = (-90 + (360 / n) * i) * (Math.PI / 180);
          const radius = 40; // 百分比半径
          const left = 50 + radius * Math.cos(angle);
          const top = 50 + radius * Math.sin(angle);

          const isMe = p.id === myId;
          const isHost = p.id === hostId;
          const seat = i + 1;
          const clickable = canVoteTarget(p);
          const voted = votedSet.has(p.id);
          const submitted = submittedSet.has(p.id);
          const isEliminatedReveal = phase === "reveal" && voteResult?.eliminatedId === p.id;
          const revealUndercover = isEliminatedReveal && voteResult?.eliminatedRole === "undercover";
          const tally = phase === "reveal" ? voteResult?.tally[p.id] : undefined;
          const isCandidate = isTiebreak && tiebreakSet.has(p.id);

          // 状态文案
          let status: { text: string; cls: string } | null = null;
          if (!p.alive && !isEliminatedReveal) {
            status = { text: "已出局", cls: "text-ink-tertiary" };
          } else if (isEliminatedReveal && voteResult?.eliminatedRole) {
            status = revealUndercover
              ? { text: "卧底", cls: "text-semantic-error" }
              : { text: "平民", cls: "text-ink-muted" };
          } else if (phase === "describing") {
            status = submitted
              ? { text: "已描述", cls: "text-semantic-success" }
              : { text: "描述中", cls: "text-primary" };
          } else if (phase === "voting") {
            status = voted
              ? { text: "已投票", cls: "text-semantic-success" }
              : { text: "思考中", cls: "text-ink-subtle" };
          }

          // 头像描边优先级：出局揭晓红 > 房主金 > 本人蓝 > 加赛候选 > 默认
          let ring = `0 0 0 1px ${HAIRLINE}`;
          if (isHost) {
            ring = `0 0 0 2px ${GOLD}`;
          } else if (isMe) {
            ring = `0 0 0 2px ${PRIMARY}`;
          } else if (isCandidate && phase === "voting") {
            ring = `0 0 0 2px ${HAIRLINE_STRONG}`;
          }

          return (
            <div
              key={p.id}
              className={tx(
                "absolute flex flex-col items-center gap-1 w-[88px] -translate-x-1/2 -translate-y-1/2",
              )}
              style={{ left: `${left}%`, top: `${top}%` }}
            >
              <div
                onClick={clickable ? () => onVote(p.id) : undefined}
                className={tx(
                  "relative w-14 h-14 rounded-full flex items-center justify-center transition-all",
                  "text-subhead font-display font-semibold",
                  !p.alive && "opacity-40",
                  revealUndercover ? "bg-semantic-error text-on-primary" : "bg-surface-3 text-ink-muted",
                  clickable && "cursor-pointer hover:scale-105",
                )}
                style={{ boxShadow: ring }}
              >
                {p.name.slice(0, 1).toUpperCase()}
                {isHost && (
                  <span className={tx("absolute -top-3.5 left-1/2 -translate-x-1/2 text-caption")}>
                    👑
                  </span>
                )}
                <span
                  className={tx(
                    "absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-surface-1 border border-hairline-strong",
                    "flex items-center justify-center text-[10px] text-ink-subtle",
                  )}
                >
                  {seat}
                </span>
              </div>
              <span className={tx("text-caption text-ink-muted max-w-[88px] truncate text-center")}>
                {seat}号 {p.name}
              </span>
              <div className={tx("flex items-center gap-1")}>
                {status && (
                  <span className={tx("text-[11px] font-medium", status.cls)}>{status.text}</span>
                )}
                {typeof tally === "number" && tally > 0 && (
                  <span className={tx("text-[11px] text-ink-subtle")}>· {tally}票</span>
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
            </div>
          );
        })}

        {/* 中央：描述输入 / 投票提示 / 公示 */}
        <div
          className={tx(
            "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
            "w-[58%] max-w-[300px] flex flex-col items-center gap-2 text-center",
          )}
        >
          {phase === "describing" &&
            (iAmAlive ? (
              iHaveSubmitted ? (
                <div className={tx("flex flex-col items-center gap-1")}>
                  <span className={tx("text-body-sm text-semantic-success font-medium")}>
                    ✅ 已提交描述
                  </span>
                  <span className={tx("text-caption text-ink-subtle")}>
                    等待其他人作答…（{submittedAlive}/{aliveCount}）
                  </span>
                </div>
              ) : (
                <>
                  <span className={tx("text-body font-medium text-ink")}>用一句话描述你的词</span>
                  <span className={tx("text-caption text-ink-subtle")}>（不能直接说出词语本身）</span>
                  <div className={tx("w-full relative mt-1")}>
                    <input
                      type="text"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                          handleSubmitDraft();
                        }
                      }}
                      maxLength={MAX_DESCRIBE_LENGTH}
                      placeholder="请输入描述…"
                      autoFocus
                      className={tx(
                        "w-full px-3 py-2.5 pr-12 rounded-lg text-body-sm bg-surface-2 border border-hairline",
                        "text-ink placeholder:text-ink-tertiary focus:outline-none focus:border-primary transition-colors",
                      )}
                    />
                    <span
                      className={tx(
                        "absolute right-3 top-1/2 -translate-y-1/2 text-caption text-ink-tertiary",
                      )}
                    >
                      {draft.length}/{MAX_DESCRIBE_LENGTH}
                    </span>
                  </div>
                  <button
                    onClick={handleSubmitDraft}
                    disabled={!draft.trim()}
                    className={tx(
                      "w-full px-4 py-2.5 rounded-lg text-button font-medium transition-colors",
                      draft.trim()
                        ? "bg-primary text-on-primary hover:bg-primary-hover"
                        : "bg-surface-3 text-ink-subtle cursor-not-allowed",
                    )}
                  >
                    提交描述
                  </button>
                  <span className={tx("text-caption text-ink-tertiary")}>提交后不可修改</span>
                </>
              )
            ) : (
              <span className={tx("text-body-sm text-ink-subtle")}>你已出局，观战中</span>
            ))}

          {phase === "voting" && (
            <div className={tx("flex flex-col items-center gap-1")}>
              {!iAmAlive ? (
                <span className={tx("text-body-sm text-ink-subtle")}>
                  你已出局，无法投票（观战中）
                </span>
              ) : iHaveVoted ? (
                <>
                  <span className={tx("text-body-sm text-semantic-success font-medium")}>✅ 已投票</span>
                  <span className={tx("text-caption text-ink-subtle")}>
                    等待其他人…（{votedAlive}/{aliveCount}）
                  </span>
                </>
              ) : (
                <>
                  <span className={tx("text-body font-medium text-ink")}>投出你认为的卧底</span>
                  <span className={tx("text-caption text-ink-subtle")}>点击头像投票 · 不能投自己</span>
                  {isTiebreak && (
                    <span className={tx("text-caption text-primary mt-1")}>
                      ⚖️ 平票加赛，只能投高亮候选人
                    </span>
                  )}
                </>
              )}
            </div>
          )}

          {phase === "reveal" && (
            <span className={tx("text-body-sm text-ink-subtle")}>本轮结果公示中…</span>
          )}
        </div>
      </div>
    </div>
  );
}
