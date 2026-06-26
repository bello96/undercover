import { useState, useEffect } from "react";
import { tx } from "@twind/core";
import type { DescribeEntry, GamePhase, PlayerInfo, Role } from "../types/protocol";
import Avatar from "./Avatar";
import { colorForIndex } from "../utils/playerColor";

// 与服务端 constants.MAX_DESCRIBE_LENGTH 保持一致
const MAX_DESCRIBE_LENGTH = 50;
const GOLD = "#e3b341";
const RED = "#eb5757";
const PRIMARY = "#5e6ad2";
const INK = "#f7f8f8";
const HAIRLINE = "#23252a";

// 描述气泡裁剪到 2 行
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
  descriptions: DescribeEntry[];
  round: number;
  votedPlayerIds: string[];
  tiebreakCandidates: string[];
  voteResult: VoteResultSnapshot | null;
  connected: boolean;
  onSubmitDescribe: (text: string) => void;
  onVote: (targetId: string) => void;
}

/**
 * 中央环形玩家布局：
 * - 头像沿圆周均匀排布，每人专属色（房主皇冠 + 金环，本人亮环）；描述显示在头像下方。
 * - voting：点击可投头像（紫环高亮），点击即乐观标记，并以「你投的」本地确认目标。
 * - 未行动的存活者状态文字呼吸提示「还在等 TA」。
 */
export default function PlayerCircle({
  players,
  myId,
  hostId,
  phase,
  descriptions,
  round,
  votedPlayerIds,
  tiebreakCandidates,
  voteResult,
  connected,
  onSubmitDescribe,
  onVote,
}: Props) {
  const [draft, setDraft] = useState("");
  // 乐观反馈：提交描述/投票后立即本地置态，不等服务端回显
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [myVoteTarget, setMyVoteTarget] = useState<string | null>(null);

  // 轮次/阶段变化时清空本地乐观态
  useEffect(() => {
    setJustSubmitted(false);
    setMyVoteTarget(null);
    setDraft("");
  }, [round, phase]);

  const roundDescriptions = descriptions.filter((d) => d.round === round);
  const descByPlayer = new Map(roundDescriptions.map((d) => [d.playerId, d.text]));

  const me = players.find((p) => p.id === myId);
  const iAmAlive = me?.alive ?? false;
  const aliveCount = players.filter((p) => p.alive).length;
  const votedSet = new Set(votedPlayerIds);
  const tiebreakSet = new Set(tiebreakCandidates);
  const iHaveSubmitted = descByPlayer.has(myId) || justSubmitted;
  const iHaveVoted = votedSet.has(myId) || myVoteTarget !== null;
  const isTiebreak = tiebreakCandidates.length > 0;

  const submittedAlive = players.filter(
    (p) => p.alive && (descByPlayer.has(p.id) || (p.id === myId && justSubmitted)),
  ).length;
  const votedAlive = players.filter(
    (p) => p.alive && (votedSet.has(p.id) || (p.id === myId && myVoteTarget !== null)),
  ).length;

  const canVoteTarget = (t: PlayerInfo): boolean => {
    return (
      phase === "voting" &&
      connected &&
      iAmAlive &&
      !iHaveVoted &&
      t.alive &&
      t.id !== myId &&
      (!isTiebreak || tiebreakSet.has(t.id))
    );
  };

  const handleVote = (targetId: string) => {
    setMyVoteTarget(targetId);
    onVote(targetId);
  };

  const handleSubmitDraft = () => {
    const text = draft.trim();
    if (!text || !connected) {
      return;
    }
    setJustSubmitted(true);
    onSubmitDescribe(text);
    setDraft("");
  };

  const n = players.length;

  return (
    <div className={tx("flex-1 flex items-center justify-center min-h-0 w-full")}>
      <div className={tx("relative w-full max-w-[560px]")} style={{ aspectRatio: "1 / 1" }}>
        {/* 玩家头像环 */}
        {players.map((p, i) => {
          const angle = (-90 + (360 / n) * i) * (Math.PI / 180);
          const radius = 40; // 百分比半径
          const left = 50 + radius * Math.cos(angle);
          const top = 50 + radius * Math.sin(angle);

          const isMe = p.id === myId;
          const isHostPlayer = p.id === hostId;
          const seat = i + 1;
          const clickable = canVoteTarget(p);
          const voted = votedSet.has(p.id) || (p.id === myId && myVoteTarget !== null);
          const described = descByPlayer.has(p.id) || (p.id === myId && justSubmitted);
          const text = descByPlayer.get(p.id);
          const isEliminatedReveal = phase === "reveal" && voteResult?.eliminatedId === p.id;
          const revealUndercover =
            isEliminatedReveal && voteResult?.eliminatedRole === "undercover";
          const tally = phase === "reveal" ? voteResult?.tally[p.id] : undefined;
          const isCandidate = isTiebreak && tiebreakSet.has(p.id);
          const iVotedThis = myVoteTarget === p.id;
          const acted = phase === "describing" ? described : phase === "voting" ? voted : false;
          const waiting =
            (phase === "describing" || phase === "voting") &&
            p.alive &&
            !acted &&
            !isEliminatedReveal;

          // 状态文案
          let status: { text: string; cls: string } | null = null;
          if (!p.alive && !isEliminatedReveal) {
            status = { text: "已出局", cls: "text-ink-tertiary" };
          } else if (isEliminatedReveal && voteResult?.eliminatedRole) {
            status = revealUndercover
              ? { text: "卧底", cls: "text-semantic-error" }
              : { text: "平民", cls: "text-ink-muted" };
          } else if (phase === "describing") {
            status = described
              ? { text: "已描述", cls: "text-semantic-success" }
              : { text: "描述中…", cls: "text-primary" };
          } else if (phase === "voting") {
            status = voted
              ? { text: "已投票", cls: "text-semantic-success" }
              : { text: "思考中…", cls: "text-ink-subtle" };
          }

          // 头像描边语义：出局揭晓红 > 本人亮环 > 可投/加赛候选紫 > 房主金 > 默认细线
          let ringColor = HAIRLINE;
          let ringWidth = 1;
          if (revealUndercover) {
            ringColor = RED;
            ringWidth = 2;
          } else if (isMe) {
            ringColor = INK;
            ringWidth = 2;
          } else if (clickable || (isCandidate && phase === "voting")) {
            ringColor = PRIMARY;
            ringWidth = 2;
          } else if (isHostPlayer) {
            ringColor = GOLD;
            ringWidth = 2;
          }

          const avatarColor = revealUndercover ? RED : colorForIndex(i);

          return (
            <div
              key={p.id}
              className={tx(
                "absolute flex flex-col items-center gap-1 w-[108px] -translate-x-1/2 -translate-y-1/2",
              )}
              style={{ left: `${left}%`, top: `${top}%` }}
            >
              <Avatar
                name={p.name}
                color={avatarColor}
                size={44}
                ringColor={ringColor}
                ringWidth={ringWidth}
                dimmed={!p.alive && !isEliminatedReveal}
                onClick={clickable ? () => handleVote(p.id) : undefined}
                title={clickable ? `投票给 ${p.name}` : p.name}
                className={revealUndercover ? "animate-[uc-shake_500ms_ease-in-out]" : undefined}
              >
                {isHostPlayer && (
                  <span className={tx("absolute -top-3 left-1/2 -translate-x-1/2 text-caption")}>
                    👑
                  </span>
                )}
                {/* 座位号 */}
                <span
                  className={tx(
                    "absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-surface-1 border border-hairline-strong",
                    "flex items-center justify-center text-[9px] text-ink-subtle tabular-nums",
                  )}
                >
                  {seat}
                </span>
                {/* 我投的目标：左上角对勾 */}
                {iVotedThis && (
                  <span
                    className={tx(
                      "absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full bg-primary text-on-primary",
                      "flex items-center justify-center text-[9px] animate-[uc-pop_300ms_ease-out]",
                    )}
                    title="你投了 TA"
                  >
                    ✓
                  </span>
                )}
              </Avatar>

              {/* 名字 + 状态 */}
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
                {iVotedThis && <span className={tx("text-[10px] text-primary")}>你投的</span>}
              </div>

              {/* 描述气泡（显示在头像下方，左侧配玩家色） */}
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

        {/* 中央：描述输入 / 投票提示 / 公示 */}
        <div
          className={tx(
            "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[56%] max-w-[280px]",
          )}
        >
          <div
            className={tx(
              "bg-surface-1 border border-hairline rounded-xl shadow-card",
              "px-5 py-4 flex flex-col items-center gap-2 text-center",
            )}
          >
            {phase === "describing" &&
              (iAmAlive ? (
                iHaveSubmitted ? (
                  <>
                    <span
                      className={tx(
                        "text-body-sm text-semantic-success font-medium animate-[uc-pop_300ms_ease-out]",
                      )}
                    >
                      ✅ 已提交描述
                    </span>
                    <span className={tx("text-caption text-ink-subtle")}>
                      等待其他人作答…（{submittedAlive}/{aliveCount}）
                    </span>
                  </>
                ) : (
                  <>
                    <span className={tx("text-body font-medium text-ink")}>用一句话描述你的词</span>
                    <span className={tx("text-caption text-ink-subtle")}>
                      （不能直接说出词语本身）
                    </span>
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
                        placeholder={connected ? "请输入描述…" : "重连中…"}
                        autoFocus
                        disabled={!connected}
                        className={tx(
                          "w-full px-3 py-2.5 pr-12 rounded-lg text-body-sm bg-surface-2 border border-hairline",
                          "text-ink placeholder:text-ink-tertiary outline-none transition-shadow transition-colors",
                          "focus:border-primary-focus focus:shadow-focus disabled:opacity-50",
                        )}
                      />
                      <span
                        className={tx(
                          "absolute right-3 top-1/2 -translate-y-1/2 text-caption text-ink-tertiary tabular-nums",
                        )}
                      >
                        {draft.length}/{MAX_DESCRIBE_LENGTH}
                      </span>
                    </div>
                    <button
                      onClick={handleSubmitDraft}
                      disabled={!draft.trim() || !connected}
                      className={tx(
                        "w-full px-4 py-2.5 rounded-lg text-button font-medium transition-all",
                        draft.trim() && connected
                          ? "bg-primary text-on-primary hover:bg-primary-hover active:scale-[0.98]"
                          : "bg-surface-3 text-ink-subtle cursor-not-allowed",
                      )}
                    >
                      提交描述
                    </button>
                    <span className={tx("text-caption text-ink-tertiary")}>
                      {connected ? "提交后不可修改" : "🔌 重连中，暂不可提交"}
                    </span>
                  </>
                )
              ) : (
                <span className={tx("text-body-sm text-ink-subtle")}>你已出局，观战中</span>
              ))}

            {phase === "voting" &&
              (!iAmAlive ? (
                <span className={tx("text-body-sm text-ink-subtle")}>
                  你已出局，无法投票（观战中）
                </span>
              ) : iHaveVoted ? (
                <>
                  <span
                    className={tx(
                      "text-body-sm text-semantic-success font-medium animate-[uc-pop_300ms_ease-out]",
                    )}
                  >
                    ✅ 已投票
                  </span>
                  <span className={tx("text-caption text-ink-subtle")}>
                    等待其他人…（{votedAlive}/{aliveCount}）
                  </span>
                </>
              ) : (
                <>
                  <span className={tx("text-body font-medium text-ink")}>投出你认为的卧底</span>
                  <span className={tx("text-caption text-ink-subtle")}>
                    点击头像投票 · 不能投自己
                  </span>
                  {isTiebreak && (
                    <span className={tx("text-caption text-primary mt-1")}>
                      ⚖️ 平票加赛，只能投高亮候选人
                    </span>
                  )}
                </>
              ))}

            {phase === "reveal" && (
              <span className={tx("text-body-sm text-ink-subtle")}>本轮结果公示中…</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
