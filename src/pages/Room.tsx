import { useState, useRef, useEffect, useCallback } from "react";
import { tx } from "@twind/core";
import { useWebSocket } from "../hooks/useWebSocket";
import Lobby from "../components/Lobby";
import WordCard from "../components/WordCard";
import PlayerList from "../components/PlayerList";
import DescribePanel from "../components/DescribePanel";
import VotePanel from "../components/VotePanel";
import RevealOverlay from "../components/RevealOverlay";
import GameOver from "../components/GameOver";
import Toast from "../components/Toast";
import ChatPanel from "../components/ChatPanel";
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
  const [toast, setToast] = useState<{ message: string; id: number; type: "error" | "info" | "success" } | null>(null);

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
            setToast({ message: `${name}（${roleName}）离开了`, id: Date.now(), type: "info" });
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
          // 离开 reveal 进入新阶段时清掉上轮出局数据，避免残留
          voteResult: null,
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
          setToast({ message: msg.message, id: Date.now(), type: "error" });
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

  // toast 自动消失由 <Toast> 组件内部通过 onClose 回调处理，此处无需额外 useEffect

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
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
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

      {/* 描述阶段 */}
      {phase === "describing" && (
        <div className={tx("flex-1 p-4 md:p-8 max-w-2xl mx-auto w-full flex flex-col gap-4")}>
          {/* 阶段标题 */}
          <h2 className={tx("text-headline font-display font-semibold text-ink")}>
            描述阶段 — 第 {round} 轮
          </h2>

          {/* 词卡：只显示词，绝不显示身份 */}
          <WordCard
            word={yourWord}
            eliminated={!players.find((p) => p.id === myId)?.alive}
          />

          {/* 玩家列表：高亮当前发言者 + 倒计时 */}
          <PlayerList
            players={players}
            myId={myId}
            currentSpeakerId={currentSpeakerId}
            deadline={view.deadline}
            phase={phase}
          />

          {/* 描述面板：本轮记录 + 输入区 */}
          <DescribePanel
            descriptions={descriptions}
            round={round}
            players={players}
            isMyTurn={currentSpeakerId === myId}
            currentSpeakerName={players.find((p) => p.id === currentSpeakerId)?.name}
            onSubmit={(text) => send({ type: "describe", text })}
          />

          {/* 聊天面板 */}
          <ChatPanel
            messages={view.chatMessages}
            myId={view.myId}
            onSend={(text) => send({ type: "chat", text })}
          />
        </div>
      )}

      {phase === "voting" && (
        <div className={tx("flex-1 p-4 md:p-8 max-w-2xl mx-auto w-full flex flex-col gap-4")}>
          {/* 阶段标题 */}
          <h2 className={tx("text-headline font-display font-semibold text-ink")}>
            投票阶段 — 第 {round} 轮
          </h2>

          {/* 词卡：供参考，不显示身份 */}
          <WordCard
            word={yourWord}
            eliminated={!players.find((p) => p.id === myId)?.alive}
          />

          {/* 玩家列表：显示已投票徽标 */}
          <PlayerList
            players={players}
            myId={myId}
            phase={phase}
            votedPlayerIds={votedPlayerIds}
          />

          {/* 投票面板 */}
          <VotePanel
            players={players}
            myId={myId}
            votedPlayerIds={votedPlayerIds}
            tiebreakCandidates={tiebreakCandidates}
            deadline={view.deadline}
            onVote={(targetId) => send({ type: "vote", targetId })}
          />

          {/* 聊天面板 */}
          <ChatPanel
            messages={view.chatMessages}
            myId={view.myId}
            onSend={(text) => send({ type: "chat", text })}
          />
        </div>
      )}

      {phase === "reveal" && (
        <div className={tx("flex-1 p-4 md:p-8 max-w-2xl mx-auto w-full flex flex-col gap-4")}>
          {/* 阶段标题 */}
          <h2 className={tx("text-headline font-display font-semibold text-ink")}>
            公布阶段
          </h2>

          {/* 玩家列表：反映最新存活状态 */}
          <PlayerList
            players={players}
            myId={myId}
            phase={phase}
          />

          {/* 出局揭晓覆盖层 */}
          {view.voteResult !== null && (
            <RevealOverlay
              eliminatedId={view.voteResult.eliminatedId}
              eliminatedRole={view.voteResult.eliminatedRole}
              players={players}
            />
          )}

          {/* 聊天面板 */}
          <ChatPanel
            messages={view.chatMessages}
            myId={view.myId}
            onSend={(text) => send({ type: "chat", text })}
          />
        </div>
      )}

      {phase === "ended" && gameOver !== null && (
        <GameOver
          winner={gameOver.winner}
          undercoverId={gameOver.undercoverId}
          civilianWord={gameOver.civilianWord}
          undercoverWord={gameOver.undercoverWord}
          roles={gameOver.roles}
          players={players}
          isHost={hostId === myId}
          onNextGame={() => send({ type: "nextGame" })}
          onLeave={handleLeave}
        />
      )}
    </div>
  );
}
