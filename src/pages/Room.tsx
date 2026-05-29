import { useState, useRef, useEffect, useCallback } from "react";
import { tx } from "@twind/core";
import { useWebSocket } from "../hooks/useWebSocket";
import Lobby from "../components/Lobby";
import { PLAYER_ID_KEY } from "../App";
import type {
  GamePhase,
  PlayerInfo,
  DescribeEntry,
  ChatEntry,
  ServerMessage,
  Role,
  Winner,
} from "../types/protocol";

interface Props {
  roomCode: string;
  playerName: string;
  playerId?: string;
  onLeave: () => void;
}

interface VoteResultSnapshot {
  tally: Record<string, number>;
  eliminatedId: string | null;
  eliminatedRole?: Role;
  tiebreak?: { candidates: string[]; round: number };
}

interface GameOverSnapshot {
  winner: Winner;
  undercoverId: string;
  civilianWord: string;
  undercoverWord: string;
  roles: Record<string, Role>;
}

/** 聚合的房间视图状态 —— 消息分发后写入，组件从这里读。 */
interface RoomView {
  roomCode: string;
  hostId: string;
  phase: GamePhase;
  maxPlayers: number;
  myId: string | null;
  players: PlayerInfo[];
  round: number;
  currentSpeakerId: string | undefined;
  deadline: number | undefined;
  speakingOrder: string[];
  descriptions: DescribeEntry[];
  votedPlayerIds: string[];
  tiebreakCandidates: string[];
  yourWord: string | undefined;
  chatMessages: ChatEntry[];
  voteResult: VoteResultSnapshot | null;
  gameOver: GameOverSnapshot | null;
}

const INITIAL_ROOM_VIEW: RoomView = {
  roomCode: "",
  hostId: "",
  phase: "lobby",
  maxPlayers: 6,
  myId: null,
  players: [],
  round: 0,
  currentSpeakerId: undefined,
  deadline: undefined,
  speakingOrder: [],
  descriptions: [],
  votedPlayerIds: [],
  tiebreakCandidates: [],
  yourWord: undefined,
  chatMessages: [],
  voteResult: null,
  gameOver: null,
};

export default function Room({ roomCode, playerName, playerId, onLeave }: Props) {
  const [view, setView] = useState<RoomView>(INITIAL_ROOM_VIEW);
  const [joinError, setJoinError] = useState("");
  const [toast, setToast] = useState<{ message: string; id: number } | null>(null);

  // 是否曾成功加入（收到 roomState + myId）。重连时跳过 10s 超时。
  const hasJoinedOnceRef = useRef(false);

  const { connected, send, addListener, leave: wsLeave } = useWebSocket(
    roomCode,
    playerName,
    playerId,
  );

  const handleLeave = useCallback(() => {
    wsLeave();
    onLeave();
  }, [wsLeave, onLeave]);

  // ------------------------------------------------------------------
  // listener ref 模式：handler 每 render 重新赋值，闭包看到最新 state；
  // useEffect 依赖只有 addListener，注册一次，永不卸载。
  // 不可退化为依赖数组模式，否则 roomState 等关键消息会在 listener 重注册
  // 的空窗期丢失，导致客户端永远卡在「连接中」。
  // ------------------------------------------------------------------
  const messageHandlerRef = useRef<(msg: ServerMessage) => void>(() => {});

  messageHandlerRef.current = (msg: ServerMessage) => {
    switch (msg.type) {
      case "roomState": {
        // 关键：写入 sessionStorage 以便刷新后重连
        sessionStorage.setItem(PLAYER_ID_KEY, msg.yourId);
        setView({
          roomCode: msg.roomCode,
          hostId: msg.hostId,
          phase: msg.phase,
          maxPlayers: msg.maxPlayers,
          myId: msg.yourId,
          players: msg.players,
          round: msg.round,
          currentSpeakerId: msg.currentSpeakerId,
          deadline: msg.deadline,
          speakingOrder: msg.speakingOrder ?? [],
          descriptions: msg.descriptions ?? [],
          votedPlayerIds: msg.votedPlayerIds ?? [],
          tiebreakCandidates: msg.tiebreakCandidates ?? [],
          yourWord: msg.yourWord,
          chatMessages: msg.chatHistory ?? [],
          voteResult: null,
          gameOver: null,
        });
        break;
      }

      case "playerJoined": {
        setView((prev) => ({
          ...prev,
          players: [...prev.players, msg.player],
        }));
        break;
      }

      case "playerLeft": {
        if (msg.revealedRole) {
          const roleName = msg.revealedRole === "undercover" ? "卧底" : "平民";
          setView((prev) => {
            const leaving = prev.players.find((p) => p.id === msg.playerId);
            const name = leaving?.name ?? "玩家";
            setToast({ message: `${name}（${roleName}）离开了`, id: Date.now() });
            return {
              ...prev,
              players: prev.players.filter((p) => p.id !== msg.playerId),
            };
          });
        } else {
          setView((prev) => ({
            ...prev,
            players: prev.players.filter((p) => p.id !== msg.playerId),
          }));
        }
        break;
      }

      case "gameStarted": {
        setView((prev) => ({
          ...prev,
          yourWord: msg.yourWord,
          phase: "describing",
          speakingOrder: msg.speakingOrder,
          currentSpeakerId: msg.currentSpeakerId,
          deadline: msg.deadline,
          round: msg.round,
          voteResult: null,
          gameOver: null,
          descriptions: [],
          votedPlayerIds: [],
          tiebreakCandidates: [],
        }));
        break;
      }

      case "phaseChange": {
        setView((prev) => ({
          ...prev,
          phase: msg.phase,
          round: msg.round ?? prev.round,
          currentSpeakerId: msg.currentSpeakerId ?? prev.currentSpeakerId,
          deadline: msg.deadline ?? prev.deadline,
          speakingOrder: msg.speakingOrder ?? prev.speakingOrder,
          tiebreakCandidates: msg.tiebreakCandidates ?? [],
        }));
        break;
      }

      case "turnChange": {
        setView((prev) => ({
          ...prev,
          currentSpeakerId: msg.currentSpeakerId,
          deadline: msg.deadline,
        }));
        break;
      }

      case "describeUpdate": {
        setView((prev) => ({
          ...prev,
          descriptions: [
            ...prev.descriptions,
            { playerId: msg.playerId, text: msg.text, round: msg.round },
          ],
        }));
        break;
      }

      case "voteUpdate": {
        setView((prev) => ({
          ...prev,
          votedPlayerIds: prev.votedPlayerIds.includes(msg.voterId)
            ? prev.votedPlayerIds
            : [...prev.votedPlayerIds, msg.voterId],
        }));
        break;
      }

      case "voteResult": {
        setView((prev) => ({
          ...prev,
          voteResult: {
            tally: msg.tally,
            eliminatedId: msg.eliminatedId,
            eliminatedRole: msg.eliminatedRole,
            tiebreak: msg.tiebreak,
          },
        }));
        break;
      }

      case "gameOver": {
        setView((prev) => ({
          ...prev,
          phase: "ended",
          gameOver: {
            winner: msg.winner,
            undercoverId: msg.undercoverId,
            civilianWord: msg.civilianWord,
            undercoverWord: msg.undercoverWord,
            roles: msg.roles,
          },
        }));
        break;
      }

      case "chat": {
        setView((prev) => ({
          ...prev,
          chatMessages: [
            ...prev.chatMessages,
            {
              playerId: msg.playerId,
              playerName: msg.playerName,
              text: msg.text,
              timestamp: msg.timestamp,
            },
          ],
        }));
        break;
      }

      case "error": {
        // 未成功加入时走 joinError 路径（统一退出）；已加入则弹 toast
        if (!view.myId) {
          setJoinError(msg.message);
        } else {
          setToast({ message: msg.message, id: Date.now() });
        }
        break;
      }

      case "roomClosed": {
        // 走 joinError 路径，1.5s 后退出
        setJoinError(`房间已关闭：${msg.reason}`);
        break;
      }

      default:
        break;
    }
  };

  // 注册一次，永不卸载——关键！不要在依赖数组中包含任何 state
  useEffect(() => {
    return addListener((msg) => messageHandlerRef.current(msg));
  }, [addListener]);

  // ------------------------------------------------------------------
  // join 超时兜底：首次 10s 内仍无 myId → setJoinError → 统一退出。
  // 重连场景（hasJoinedOnce 为 true）跳过此超时。
  // ------------------------------------------------------------------
  useEffect(() => {
    if (view.myId !== null) {
      hasJoinedOnceRef.current = true;
      return;
    }
    if (hasJoinedOnceRef.current) {
      // 已加入过，这是重连等待，不超时
      return;
    }
    if (joinError) {
      return;
    }
    const timer = window.setTimeout(() => {
      setJoinError("加入房间超时，请检查网络或刷新页面");
    }, 10_000);
    return () => window.clearTimeout(timer);
  }, [view.myId, joinError]);

  // joinError 统一退出：1.5s 后调用 onLeave
  useEffect(() => {
    if (!joinError) {
      return;
    }
    const timer = window.setTimeout(() => onLeave(), 1500);
    return () => window.clearTimeout(timer);
  }, [joinError, onLeave]);

  // toast 自动消失
  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // ------------------------------------------------------------------
  // 渲染：未加入 / 出错 → 全屏提示；已加入断线 → 保留主 UI + 顶部 banner
  // ------------------------------------------------------------------
  if (!view.myId || joinError) {
    return (
      <div
        className={tx(
          "flex items-center justify-center min-h-screen bg-canvas text-ink",
        )}
      >
        <div className={tx("text-center")}>
          {joinError ? (
            <>
              <div className={tx("text-body-lg text-semantic-error mb-2 font-medium")}>
                {joinError}
              </div>
              <div className={tx("text-body-sm text-ink-subtle")}>即将返回首页...</div>
            </>
          ) : (
            <>
              <div
                className={tx(
                  "w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4",
                )}
              />
              <div className={tx("text-ink-muted")}>连接中...</div>
            </>
          )}
        </div>
      </div>
    );
  }

  const {
    phase,
    players,
    hostId,
    maxPlayers,
    myId,
    yourWord,
    descriptions,
    votedPlayerIds,
    round,
    currentSpeakerId,
    tiebreakCandidates,
    gameOver,
  } = view;

  // 通用：简版玩家列表（供占位视图展示）
  const simplePlayerList = (
    <ul className={tx("text-body-sm text-ink-subtle space-y-1")}>
      {players.map((p) => (
        <li key={p.id} className={tx("flex items-center gap-2")}>
          <span>{p.name}</span>
          {p.id === myId && <span className={tx("text-primary text-caption")}>(我)</span>}
          {p.isHost && <span className={tx("text-ink-subtle text-caption")}>[房主]</span>}
          {!p.alive && <span className={tx("text-ink-tertiary text-caption")}>[已出局]</span>}
        </li>
      ))}
    </ul>
  );

  return (
    <div className={tx("min-h-screen bg-canvas text-ink flex flex-col")}>
      {/* 重连 banner：已加入后断线才显示，不阻断主 UI */}
      {!connected && (
        <div
          className={tx(
            "bg-surface-2 border-b border-hairline text-center text-caption py-2",
            "text-ink-muted",
          )}
        >
          网络异常，正在重连...
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={tx(
            "fixed top-4 left-1/2 -translate-x-1/2 z-50",
            "bg-surface-2 border border-hairline text-ink text-body-sm",
            "px-4 py-2 rounded-lg shadow-lg",
          )}
        >
          {toast.message}
        </div>
      )}

      {/* 阶段路由 */}
      {phase === "lobby" && (
        <Lobby
          roomCode={roomCode}
          players={players}
          hostId={hostId}
          maxPlayers={maxPlayers}
          myId={myId}
          send={send}
        />
      )}

      {/* TODO(单元11-13): 替换为描述/投票/公布/结算视图 + ChatPanel */}
      {phase === "describing" && (
        <div
          className={tx(
            "flex-1 flex items-center justify-center p-8",
          )}
        >
          <div
            className={tx(
              "bg-surface-1 border border-hairline rounded-xl p-8 max-w-md w-full space-y-4",
            )}
          >
            <h2 className={tx("text-headline font-display font-semibold text-ink")}>
              描述阶段 — 第 {round} 轮
            </h2>
            {yourWord && (
              <p className={tx("text-body text-ink-muted")}>
                你的词：<span className={tx("text-ink font-medium")}>{yourWord}</span>
              </p>
            )}
            <p className={tx("text-body-sm text-ink-subtle")}>
              当前发言：{players.find((p) => p.id === currentSpeakerId)?.name ?? "—"}
            </p>
            <p className={tx("text-body-sm text-ink-subtle")}>
              已发言：{descriptions.length} 人
            </p>
            {simplePlayerList}
          </div>
        </div>
      )}

      {phase === "voting" && (
        <div
          className={tx(
            "flex-1 flex items-center justify-center p-8",
          )}
        >
          <div
            className={tx(
              "bg-surface-1 border border-hairline rounded-xl p-8 max-w-md w-full space-y-4",
            )}
          >
            <h2 className={tx("text-headline font-display font-semibold text-ink")}>
              投票阶段 — 第 {round} 轮
            </h2>
            {yourWord && (
              <p className={tx("text-body text-ink-muted")}>
                你的词：<span className={tx("text-ink font-medium")}>{yourWord}</span>
              </p>
            )}
            <p className={tx("text-body-sm text-ink-subtle")}>
              已投票：{votedPlayerIds.length} 人
            </p>
            {tiebreakCandidates.length > 0 && (
              <p className={tx("text-body-sm text-ink-subtle")}>
                平票加时赛候选：{tiebreakCandidates.join("、")}
              </p>
            )}
            {simplePlayerList}
          </div>
        </div>
      )}

      {phase === "reveal" && (
        <div
          className={tx(
            "flex-1 flex items-center justify-center p-8",
          )}
        >
          <div
            className={tx(
              "bg-surface-1 border border-hairline rounded-xl p-8 max-w-md w-full space-y-4",
            )}
          >
            <h2 className={tx("text-headline font-display font-semibold text-ink")}>
              公布阶段
            </h2>
            {yourWord && (
              <p className={tx("text-body text-ink-muted")}>
                你的词：<span className={tx("text-ink font-medium")}>{yourWord}</span>
              </p>
            )}
            {view.voteResult?.eliminatedId && (
              <p className={tx("text-body-sm text-ink-subtle")}>
                本轮出局：
                {players.find((p) => p.id === view.voteResult?.eliminatedId)?.name ?? "—"}
                {view.voteResult.eliminatedRole &&
                  `（${view.voteResult.eliminatedRole === "undercover" ? "卧底" : "平民"}）`}
              </p>
            )}
            {simplePlayerList}
          </div>
        </div>
      )}

      {phase === "ended" && (
        <div
          className={tx(
            "flex-1 flex items-center justify-center p-8",
          )}
        >
          <div
            className={tx(
              "bg-surface-1 border border-hairline rounded-xl p-8 max-w-md w-full space-y-4",
            )}
          >
            <h2 className={tx("text-headline font-display font-semibold text-ink")}>
              游戏结束
            </h2>
            {gameOver && (
              <>
                <p className={tx("text-body text-ink")}>
                  胜者：
                  <span className={tx("font-medium")}>
                    {gameOver.winner === "civilian" ? "平民" : "卧底"}
                  </span>
                </p>
                <p className={tx("text-body-sm text-ink-muted")}>
                  平民词：{gameOver.civilianWord} / 卧底词：{gameOver.undercoverWord}
                </p>
              </>
            )}
            {simplePlayerList}
            <button
              onClick={handleLeave}
              className={tx(
                "w-full px-4 py-2 rounded-lg text-button font-medium",
                "bg-surface-2 border border-hairline text-ink",
                "hover:border-hairline-strong transition-colors",
              )}
            >
              返回首页
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
